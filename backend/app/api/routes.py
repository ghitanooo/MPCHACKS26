from fastapi import APIRouter, HTTPException, UploadFile, File
from app.models.schemas import TriageAction, ExplanationOut
from app.database import transactions_collection, audit_collection
from app.services.ml_pipeline import run_full_pipeline, explain_transaction_with_claude
import pandas as pd
import io
from datetime import datetime, timezone

router = APIRouter()


def _serialize(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    # Ensure timestamp is a string
    if isinstance(doc.get("timestamp"), pd.Timestamp):
        doc["timestamp"] = doc["timestamp"].isoformat()
    return doc


@router.post("/ingest")
async def ingest_transactions(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    contents = await file.read()
    try:
        df = pd.read_csv(io.StringIO(contents.decode("utf-8")))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV parse error: {e}")

    try:
        scored_df = run_full_pipeline(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline error: {e}")

    records = scored_df.to_dict("records")
    for rec in records:
        rec["status"] = "Review"
        if isinstance(rec.get("timestamp"), pd.Timestamp):
            rec["timestamp"] = rec["timestamp"].isoformat()
        # Convert numpy types that MongoDB can't handle
        for k, v in list(rec.items()):
            if isinstance(v, float) and (v != v):  # NaN
                rec[k] = None

    await transactions_collection.delete_many({})
    await audit_collection.delete_many({})
    if records:
        await transactions_collection.insert_many(records)

    fraud_count = int(scored_df["is_fraud"].sum())
    return {
        "message": f"Ingested {len(records)} transactions. Flagged {fraud_count} as potential fraud.",
        "total": len(records),
        "flagged": fraud_count,
    }


@router.get("/queue")
async def get_queue():
    # FIFO: oldest first
    cursor = transactions_collection.find(
        {"is_fraud": 1, "status": "Review"}
    ).sort("timestamp", 1).limit(1000)
    txns = await cursor.to_list(length=1000)
    return [_serialize(tx) for tx in txns]


@router.get("/stats")
async def get_stats():
    remaining = await transactions_collection.count_documents({"is_fraud": 1, "status": "Review"})
    return {"remaining": remaining}


@router.get("/transactions/{transaction_id}")
async def get_transaction(transaction_id: str):
    tx = await transactions_collection.find_one({"transaction_id": transaction_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return _serialize(tx)


@router.post("/triage/{transaction_id}")
async def triage_transaction(transaction_id: str, action: TriageAction):
    tx = await transactions_collection.find_one({"transaction_id": transaction_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    decision = action.decision.upper()
    if decision not in ("APPROVE", "BLOCK", "ESCALATE"):
        raise HTTPException(status_code=400, detail="Invalid decision")

    status_map = {"APPROVE": "Approved", "BLOCK": "Blocked", "ESCALATE": "Escalated"}
    new_status = status_map[decision]
    decision_at = datetime.now(timezone.utc).isoformat()

    await transactions_collection.update_one(
        {"transaction_id": transaction_id},
        {"$set": {"status": new_status, "decision_at": decision_at}},
    )

    await audit_collection.insert_one({
        "transaction_id": transaction_id,
        "decision":       decision,
        "timestamp":      datetime.now(timezone.utc),
        "risk_score":     tx.get("anomaly_score", 0),
        "amount":         tx.get("amount", 0),
        "card_id":        tx.get("card_id", ""),
        "merchant_name":  tx.get("merchant_name", ""),
    })

    return {"message": "Triage successful", "new_status": new_status}


@router.get("/ledger")
async def get_ledger(decision: str = None):
    query = {}
    if decision and decision.upper() != "ALL":
        query["decision"] = decision.upper()

    cursor = audit_collection.find(query).sort("timestamp", -1).limit(200)
    logs = await cursor.to_list(length=200)
    for log in logs:
        log["_id"] = str(log["_id"])
        if isinstance(log.get("timestamp"), datetime):
            log["timestamp"] = log["timestamp"].isoformat()
    return logs


@router.get("/history")
async def get_history(decision: str = None):
    """Returns reviewed transactions with full evidence data for replay."""
    query: dict = {"status": {"$in": ["Approved", "Blocked", "Escalated"]}}
    if decision and decision.upper() != "ALL":
        status_map = {"APPROVE": "Approved", "BLOCK": "Blocked", "ESCALATE": "Escalated"}
        mapped = status_map.get(decision.upper())
        if mapped:
            query = {"status": mapped}

    cursor = transactions_collection.find(query).sort("decision_at", -1).limit(200)
    txns = await cursor.to_list(length=200)
    return [_serialize(tx) for tx in txns]


@router.get("/transactions/{transaction_id}/explain", response_model=ExplanationOut)
async def get_transaction_explanation(transaction_id: str):
    # Check if explanation already cached on document
    tx = await transactions_collection.find_one({"transaction_id": transaction_id})
    if tx and tx.get("explanation"):
        return tx["explanation"]

    result = explain_transaction_with_claude(transaction_id)

    # Cache on document
    if tx:
        await transactions_collection.update_one(
            {"transaction_id": transaction_id},
            {"$set": {"explanation": result}},
        )

    return result
