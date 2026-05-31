# Implementation Plan

## Architecture Overview
The system is built on a containerized, 3-tier architecture using Docker Compose.
1. **Frontend**: Vite + React, styled with Tailwind CSS. It connects to the backend REST API to fetch flagged transactions, submit triage decisions, and read the audit ledger.
2. **Backend API**: Python FastAPI application exposing endpoints for data ingestion, queue management, and triage actions.
3. **Database**: MongoDB handles flexible document schemas, making it easy to store transactions with their dynamically generated ML features, SHAP signals, and triage history.

## ML Pipeline Integration
The original Jupyter notebook logic has been extracted into `backend/app/services/ml_pipeline.py`.
- **Feature Engineering**: Calculates velocity, travel times, IP mismatches.
- **Anomaly Detection**: PyOD models (IForest, ECOD, COPOD, HBOS) generate a rank-averaged ensemble score.
- **Explainability**: SHAP extracts the specific features that influenced the model's decision for a specific transaction, which are translated into human-readable signals in the UI.

## Work Division (Hypothetical Team)
- **MLOps Engineer**: Focuses on `ml_pipeline.py` and the backend Dockerization.
- **Backend Engineer**: Sets up FastAPI, MongoDB collections, and endpoint routers.
- **Frontend Engineer**: Transforms `code.html` into modular React components (`App.jsx`), ensuring keyboard shortcuts and API integrations work perfectly.

## Trade-offs and Skipped Items
- Skipped real-time streaming ingestion (Kafka/PubSub) in favor of a bulk CSV upload to fit the 24-hour hackathon timeline.
- Skipped complex authentication on the API/Frontend to prioritize the reviewer experience.
