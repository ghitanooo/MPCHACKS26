# Product Requirements Document: Fraud Hunter Anomaly Detection Suite

## Goals & Metrics

### Goals
- **Detect Unseen Fraud Patterns (Zero-Day Attacks)**: Standard rules-based or supervised models fail when new, unlabelled fraud vectors emerge. The primary goal is to identify anomalous transactional behavior without relying on historical fraud labels.
- **Minimize Enterprise Financial Exposure**: Flag high-risk transactions before they settle, allowing fast, proactive triage.
- **Reduce Reviewer Fatigue**: Consolidate alert signals through robust ensemble modeling to present high-confidence alerts, avoiding the noise of thousands of single-model false positives.
- **Provide Actionable Explanations**: Give fraud analysts a clear understanding of why a transaction was flagged, enabling fast decision-making.

### Metrics
- **Primary Metric: Consensus Precision**: The percentage of alerts flagged by the majority vote (3 out of 4 models) that represent actual behavioral anomalies or confirmed fraud upon manual review. Target: Greater than 85%.
- **Primary Metric: Detection Coverage**: The proportion of newly emerging, unlabelled fraud typologies successfully flagged by the ensemble. Target: 100% of major deviations.
- **Primary Metric: Mean Time to Triage (MTTT)**: The average time taken by a human reviewer to resolve a flagged alert in the queue. Target: Less than 30 seconds.
- **Countermetric: Review Queue Volume (False Positive Rate)**: The percentage of normal transactions flagged as anomalies. Target: Less than 1% to prevent queue clogging.
- **Countermetric: Pipeline Latency**: Total execution time for batch processing and feature engineering per 1,000 transactions. Target: Less than 5 seconds.

---

## Product Definition

### Overview
Fraud Hunter is an enterprise-grade, unsupervised transaction triage and anomaly detection system. It leverages advanced statistical modeling (ECOD, COPOD, HBOS, and Isolation Forest) to score and flag suspicious financial transactions. The product consists of a modular Python-based analytics engine that calculates risk scores, combined with a high-fidelity React dashboard where fraud analysts can review, audit, and resolve alerts efficiently.

---

## Requirements

### Data Ingestion and Normalization
- **P0**: The system must ingest raw transactional files containing key attributes: transaction ID, timestamp, card ID, amount, merchant details, channel, country, IP address, and device ID.
- **P0**: Numeric features must be scaled using RobustScaler (median and interquartile range) to prevent extreme outlier values from distorting the normalization scale.
- **P1**: The ingestion pipeline must support automated IP geolocation lookup using a local GeoLite2 database to resolve merchant and cardholder countries.
- **P2**: Support automated multi-format ingestion including JSON payloads and Parquet stream formats in addition to standard CSV files.
- **P3**: Integrate dynamic schema detection to automatically map variations in raw transaction field names from external third-party payment processors.

### High-Performance Feature Engineering
- **P0**: The system must compute 35 engineered features spanning six distinct behavioral domains: velocity, geographic deviation, spending diversity, channel switching, customer profiles, and shared-entity relationships.
- **P0**: Temporal and sorting-based feature calculations must run in O(n log n) time complexity using optimized numpy searchsorted operations.
- **P1**: Shared-entity network features must identify cards sharing the same IP address or device within a rolling temporal window.
- **P2**: Implement localized profile base features that dynamically adjust window sizes (e.g., 1-day, 7-day, 30-day) based on customer transaction frequency.
- **P3**: Apply sliding-window entropy calculations on merchant category sequences to flag sudden structural shifts in spending variety.

### Ensemble Anomaly Detection Engine
- **P0**: The system must run four distinct PyOD models concurrently on the engineered features: Isolation Forest, ECOD, COPOD, and HBOS.
- **P0**: The final anomaly alert decision must require a strict majority vote (at least 3 out of 4 models consensus).
- **P0**: Heterogeneous anomaly scores from different models must be unified using a rank averaging algorithm to eliminate scaling differences.
- **P1**: Model pipelines must be fully serializable using Joblib for rapid deployment and scoring.
- **P2**: Implement dynamic auto-tuning of individual model hyper-parameters based on historical execution performance statistics.
- **P3**: Add support for plug-and-play unsupervised model architectures (e.g., Autoencoders, One-Class SVM) via external config files without code modifications.

### Triage Dashboard & Audit Ledger
- **P0**: The frontend must display a real-time triage queue showing flagged high-risk transactions with their respective ensemble risk scores.
- **P0**: Analysts must be able to change the status of an alert (Approve, Decline, or Escalated).
- **P0**: Every analyst action must be logged in a secure, local MongoDB audit ledger containing the timestamp, analyst ID, action taken, and original transaction ID.
- **P1**: The dashboard must display post-hoc behavioral explanations highlighting which feature domains contributed most to the anomaly score.
- **P2**: Create an interactive team-wide analytics view showing aggregate metrics like average review time and resolution trends.
- **P3**: Introduce gamified dashboard metrics and productivity statistics to optimize reviewer performance and engagement.

---

## Optional Sections

### Risks & Mitigations
- **Risk**: Concept drift in customer spending habits (e.g., holiday shopping spikes) causing a high false positive rate.
  - *Mitigation*: Periodic retraining of the unsupervised pipeline using rolling transaction windows to update baseline normal behavior.
- **Risk**: Cold-start problem for new cards or merchants with no transaction history.
  - *Mitigation*: Apply fallback heuristic limits for the first 5 transactions before activating full velocity and historical profile features.

### Rollout Plan
- **Phase 1: Shadow Mode (Weeks 1-2)**: Run the unsupervised scoring pipeline in parallel with the existing legacy rules engine without generating active analyst alerts. Compare overlap and measure false-positive metrics.
- **Phase 2: Pilot Rollout (Weeks 3-4)**: Route 10% of generated alerts to a dedicated group of senior fraud analysts. Gather qualitative feedback on explainability metrics.
- **Phase 3: Full Production (Week 5+)**: Fully deploy the triage queue to the global analyst team, deprecating legacy rules.

### Long-Term Improvements
- **Online Learning Integration**: Evolve the batch-oriented model to an incremental learning approach that updates model statistics transaction-by-transaction.
- **Advanced Graph Analytics**: Implement graph database storage (e.g., Neo4js) to map multi-hop relationships between cards, device IDs, and mule bank accounts.

---

## Template FAQs

### What are the minimum requirements for "done"? What sign-offs are required / acceptance criteria?
A feature or release is considered "done" and ready for production deployment when:
1. **Mathematical Accuracy**: The model consensus precision remains above 85% on historical validation datasets.
2. **Performance SLA**: End-to-end scoring of a 1,000 transaction batch completes in under 5 seconds.
3. **Auditability**: 100% of state-transitions in the triage queue generate valid, unalterable database entries in the audit ledger.
4. **Sign-offs Required**: Lead Data Scientist (for pipeline logic), Engineering Lead (for performance SLAs), and Head of Fraud Operations (for dashboard usability and MTTT metrics).
