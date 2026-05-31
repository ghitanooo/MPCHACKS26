from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime


class TransactionOut(BaseModel):
    id: str = Field(alias="_id")
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
    anomaly_score: float = 0
    is_fraud: int = 0
    fraud_confidence: str = "normal"
    votes: int = 0
    signals: List[str] = []
    status: str = "Review"
    model_scores: Optional[dict] = {}
    model_votes: Optional[dict] = {}
    shap_top_features: Optional[list] = []
    evidence_snapshot: Optional[dict] = {}
    decision_at: Optional[str] = None

    class Config:
        populate_by_name = True


class TriageAction(BaseModel):
    decision: str  # "APPROVE", "BLOCK", "ESCALATE"


class AuditLog(BaseModel):
    transaction_id: str
    decision: str
    timestamp: datetime
    risk_score: float
    amount: float


class ExplanationOut(BaseModel):
    summary: str
    why_suspicious: List[str]
    key_signals: List[str]
    recommended_action: str
    reason: str
