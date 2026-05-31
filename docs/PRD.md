# Product Requirements Document (PRD)

## Target Audience
The primary user is a Trust & Safety Reviewer at a payments company. This user spends 8 hours a day triaging potentially fraudulent transactions. 

## The Problem
Reviewers are overwhelmed by data. Standard tabular interfaces force reviewers to manually correlate disparate fields (IP, Location, Amount, History) to make a decision. False positives alienate users, while false negatives cost the company. Reviewers need an interface that highlights *why* something is suspicious and lets them act instantly.

## Success Criteria
1. **Speed:** A reviewer can parse the context and make a decision (Approve/Block/Escalate) in under 5 seconds per transaction.
2. **Accuracy (F1 > 0.85):** The underlying model successfully flags the hidden fraud patterns without overwhelming the queue with false positives.
3. **Explainability:** Every flagged transaction in the UI explicitly states the signals that drove its score.

## What We Are NOT Building
- We are not building a fully automated "reject" system. This tool is strictly for human-in-the-loop triage.
- We are not building complex merchant analytics dashboards. The focus is singularly on transaction-level triage.
