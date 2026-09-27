# AegisSOC

AegisSOC is an AI-assisted Security Operations Center (SOC) designed to analyze network activity, detect potentially malicious behavior, and present security findings through an interactive web interface.

The project combines a **Next.js frontend** with a **Python FastAPI machine-learning service**. The current CICIDS2017 detection engine uses a trained **Isolation Forest anomaly-detection model** to identify network flows that differ from benign traffic.

---

## Features

- Security Operations Center dashboard
- Network security event analysis
- Machine-learning-based anomaly detection
- CICIDS2017 network-flow detection
- NSL-KDD detection engine
- Risk scoring
- Anomaly severity classification
- Detection explanations
- Single-event analysis
- Batch analysis
- ML model information and evaluation metrics
- CICIDS2017 evaluation reports
- Interactive ML demonstration interface

---

# System Architecture

```text
                         AegisSOC
                            │
             ┌──────────────┴──────────────┐
             │                             │
             ▼                             ▼
       Next.js Frontend              Python ML Service
             │                             │
             │                             │
             ▼                             ▼
       Next.js API Routes            FastAPI / Uvicorn
             │                             │
             │                             ▼
             │                    Preprocessing Pipeline
             │                             │
             │                             ▼
             │                    Isolation Forest
             │                             │
             │                             ▼
             │                     Anomaly Detection
             │                             │
             │                             ▼
             │                       Risk Scoring
             │                             │
             └──────────────┬──────────────┘
                            │
                            ▼
                    Detection Result
                            │
                            ▼
                       SOC Interface
