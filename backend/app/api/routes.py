from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File
from app.models.schemas import TransactionOut, TriageAction, AuditLog
from app.database import transactions_collection, audit_collection
from app.services.ml_pipeline import run_full_pipeline
import pandas as pd
import io
from datetime import datetime

router = APIRouter()

@router.post("/ingest")
async def ingest_transactions(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    contents = await file.read()
    df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
    
    # Run the exact Jupyter pipeline
    try:
        scored_df = run_full_pipeline(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")
    
    # Prepare for MongoDB
    records = scored_df.to_dict('records')
    
    # Clear old collection for demo purposes
    await transactions_collection.delete_many({})
    
    # Insert new
    for record in records:
        record['status'] = 'Review'
        # Convert timestamp to string if it's datetime to avoid serialization issues
        if isinstance(record['timestamp'], pd.Timestamp):
            record['timestamp'] = record['timestamp'].isoformat()
            
    if records:
        await transactions_collection.insert_many(records)
    
    fraud_count = len(scored_df[scored_df['is_fraud'] == 1])
    return {"message": f"Ingested {len(records)} transactions. Flagged {fraud_count} as potential fraud."}

@router.get("/queue", response_model=list[dict])
async def get_queue():
    # Fetch top flagged items in Review status
    cursor = transactions_collection.find({"is_fraud": 1, "status": "Review"}).sort("anomaly_score", -1).limit(1000)
    transactions = await cursor.to_list(length=1000)
    for tx in transactions:
        tx["_id"] = str(tx["_id"])
    return transactions

@router.get("/transactions/{transaction_id}")
async def get_transaction(transaction_id: str):
    tx = await transactions_collection.find_one({"transaction_id": transaction_id})
    if tx:
        tx["_id"] = str(tx["_id"])
        return tx
    raise HTTPException(status_code=404, detail="Transaction not found")

@router.post("/triage/{transaction_id}")
async def triage_transaction(transaction_id: str, action: TriageAction):
    tx = await transactions_collection.find_one({"transaction_id": transaction_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    decision = action.decision.upper()
    if decision not in ["APPROVE", "BLOCK", "ESCALATE"]:
        raise HTTPException(status_code=400, detail="Invalid decision")
        
    status_map = {
        "APPROVE": "Approved",
        "BLOCK": "Blocked",
        "ESCALATE": "Escalated"
    }
    new_status = status_map[decision]
    
    await transactions_collection.update_one(
        {"transaction_id": transaction_id},
        {"$set": {"status": new_status}}
    )
    
    # Audit Log
    audit_entry = {
        "transaction_id": transaction_id,
        "decision": decision,
        "timestamp": datetime.utcnow(),
        "risk_score": tx.get("anomaly_score", 0),
        "amount": tx.get("amount", 0)
      }
    await audit_collection.insert_one(audit_entry)
    
    return {"message": "Triage successful", "new_status": new_status}

@router.get("/ledger")
async def get_ledger(decision: str = None):
    query = {}
    if decision and decision.upper() != 'ALL':
        query["decision"] = decision.upper()
        
    cursor = audit_collection.find(query).sort("timestamp", -1).limit(100)
    logs = await cursor.to_list(length=100)
    for log in logs:
        log["_id"] = str(log["_id"])
    return logs
