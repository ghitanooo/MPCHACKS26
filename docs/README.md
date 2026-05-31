# Fraud Hunter: ART - Enterprise Triage

A complete MLOps and Web application pipeline designed for a payment company's trust and safety team, completed as part of the 24-hour MPC Hacks.

## Overview

Fraud Hunter transforms raw transactional data into actionable insights through an advanced anomaly detection pipeline and a highly optimized review interface.
Our solution is split into three layers:
1. **Machine Learning Pipeline:** An automated feature engineering system that runs multiple anomaly detection algorithms (IForest, ECOD, COPOD, HBOS) and aggregates their predictions.
2. **FastAPI Backend:** A fast, asynchronous API bridging the model predictions with MongoDB for persistence.
3. **React Frontend (ART):** An enterprise triage interface designed for speed and low cognitive load, allowing analysts to review flags and apply A/S/D keyboard shortcuts.

## Setup Instructions

1. **Prerequisites:** Docker and Docker Compose installed.
2. **Data Ingestion:** Ensure `transactions.csv` is available.
3. **Run the stack:**
   ```bash
   docker-compose up --build -d
   ```
4. **Access the application:**
   - Frontend: `http://localhost:80`
   - Backend API Docs: `http://localhost:8000/docs`

5. **Trigger Analysis:**
   Send the CSV to the ingestion endpoint via curl or Swagger:
   ```bash
   curl -X POST -F "file=@transactions.csv" http://localhost:8000/api/ingest
   ```

## Detection Strategy

Our strategy rests on identifying deviations from an individual user's baseline rather than fixed global thresholds:
- **Velocity Metrics:** Rolling windows (30m, 1h, 24h) identifying rapid burst patterns.
- **Geographic Mismatches:** Highlighting impossible travel scenarios (e.g. physical transactions in different countries separated by < 6 hours).
- **Ensemble PyOD:** A composite score is computed using a rank-averaged ensemble of four unsupervised models, ensuring resilience against outliers.
- **SHAP Explainability:** Extracting the exact features driving the anomaly score to provide clear reasons to human reviewers.

## What we'd do with another week
- Fine-tune hyper-parameters using labeled feedback from the triage interface.
- Replace offline processing with a streaming pipeline (e.g., Kafka + Flink).
- Integrate an LLM (Anthropic) directly into the API to generate conversational summaries for the most complex fraud cases.
