from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.database import transactions_collection, audit_collection

app = FastAPI(
    title="Fraud Hunter API",
    version="2.4.0",
    description="Enterprise Triage Backend"
)

# CORS config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

# @app.on_event("startup")
# async def clear_database_on_startup():
#     # Clear the database on startup so the app is always empty initially
#     await transactions_collection.delete_many({})
#     await audit_collection.delete_many({})

@app.get("/health")
def health_check():
    return {"status": "ok"}
