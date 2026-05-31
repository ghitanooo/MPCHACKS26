import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "fraud_platform")

client = AsyncIOMotorClient(MONGODB_URL)
db = client[DB_NAME]

transactions_collection = db["transactions"]
audit_collection = db["audit_ledger"]
