from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class TransactionBase(BaseModel):
    transaction_id: str
    timestamp: str
    card_id: str
    amount: float
    merchant_name: str
    merchant_category: str
    channel: str
    cardholder_country: str
    merchant_country: str
    device_id: Optional[str] = None
    ip_address: Optional[str] = None

class TransactionOut(TransactionBase):
    id: str = Field(alias="_id")
    anomaly_score: float
    is_fraud: int
    fraud_confidence: str
    votes: int
    signals: List[str] = []
    status: str = "Review" # 'Review', 'Approved', 'Blocked', 'Escalated'
    
    class Config:
        populate_by_name = True

class TriageAction(BaseModel):
    decision: str # "APPROVE", "BLOCK", "ESCALATE"

class AuditLog(BaseModel):
    transaction_id: str
    decision: str
    timestamp: datetime
    risk_score: float
    amount: float
