import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = "mongodb+srv://yaliboustibi_db_user:MPC123@mpc-hack.mtkwtuz.mongodb.net/?appName=MPC-HACK"
client = AsyncIOMotorClient(MONGO_URL)
db = client.fraud_hunter

transactions_collection = db.get_collection("transactions")
audit_collection = db.get_collection("audit_ledger")
