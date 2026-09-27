# AegisSOC — ML Anomaly Detection Layer

This is the **machine-learning anomaly detection component** for AegisSOC
(Section 7 of the design doc), built to slot directly into the
`Spring Boot -> Python ML Service -> ML Models` architecture described in
Section 31.

It is trained on **real, publicly available network intrusion data**
(NSL-KDD, from the Canadian Institute for Cybersecurity — the standard
academic benchmark for intrusion/anomaly detection research), not
synthetic or toy data.

> **Integration status (updated):** this service is now wired into the
> Next.js console with **two engines** and a **Gemini AI layer**:
> - **Engine 1 (`nslkdd`)** — Isolation Forest on NSL-KDD connection records
>   (scores normalized security events + user-uploaded log lines via feature
>   mapping). ROC-AUC 0.938.
> - **Engine 2 (`cicids`)** — Isolation Forest on CICIDS2017 flow summaries
>   (682k real flows; DDoS recall 62% @ 5% FPR; PortScan recall is honestly
>   poor — a known dataset limitation for unsupervised methods).
> - **Gemini AI** — shift briefings (dashboard), AI triage (incident detail),
>   verdict explanations + log screening (ML page), AI chat (analyst page).
>
> See "Run the full stack" below and the `/ml` page (sidebar: **ML Detection**).

## Run the full stack (ML + Next.js)

```bash
# Terminal 1 — train if needed (artifacts are already committed) or retrain:
cd aegis_ml/aegissoc-ml
python src/train_model.py            # NSL-KDD engine -> models/
PYTHONIOENCODING=utf-8 python src/train_cicids.py   # CICIDS2017 engine -> models_cicids/
                                     # needs data/cicids2017/*.csv (see data/download_cicids2017.sh)

# Terminal 2 — start the ML service (from the project root):
cd aegis_ml/aegissoc-ml
source .venv/bin/activate     # one-time setup: uv pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8000

# Terminal 3 — start the Next.js console (reads GEMINI_API_KEY from .env):
cd <repo root>
npm run dev
```

> **Troubleshooting — `No module named 'fastapi'` / wrong Python:** check
> `which uvicorn`. If it prints `/usr/bin/uvicorn` (the distro launcher, which
> cannot see `~/.local` or the venv) while the venv is active, your shell has a
> stale command hash — run `rehash` (zsh) or `hash -r` (bash), or call
> `.venv/bin/uvicorn app:app --port 8000` directly. The service also detects
> this situation itself and relaunches into `.venv` automatically.

Then open **http://localhost:3000/ml** — the ML Detection page shows both
model cards, a single-event analyzer (engine switchable), drag-and-drop
**log-file screening** through the ML engine, and an AI verdict explainer.

Browser -> Next.js API routes (this repo):
- `GET  /api/ml/info`     → proxies Python `GET /model/info?model=...`
- `POST /api/ml/analyze`  → body `{ "event": {...} }` → proxies `POST /api/v1/analyze`
- `POST /api/ml/batch`    → body `{ "events": [...] }` → proxies `POST /api/v1/analyze/batch`
- `POST /api/ml/score`    → body `{ "events": [...normalized log events...] }` — parses, maps
  onto connection-record features (`lib/ingest/ml-features.ts`), scores via the NSL-KDD engine
- `POST /api/ai`          → Gemini AI tasks: `brief` · `ml-explain` · `incident` · `chat` · `log-insights`

Set `ML_SERVICE_URL` to point the proxies somewhere other than
`http://localhost:8000`. If the Python service is down, the `/ml` page
shows a clear "ML service unreachable" banner with the fix.

Note: the committed `.joblib` artifacts must be retrained with your local
scikit-learn/pandas versions if they differ from the ones used here —
`python src/train_model.py` regenerates everything in ~3s.

---

## 1. What this actually does


The model learns what **normal** network/security behaviour looks like,
then flags events that deviate from it — **it is never shown a single
attack example during training.** This is a semi-supervised /
novelty-detection setup, and it's a deliberate design choice, not a
simplification:

- It mirrors how a real SOC operates: you have abundant "known-good"
  baseline telemetry and comparatively few confirmed attack examples.
- It generalizes to **attacks the model has never seen**, which is the
  entire point of an ML anomaly layer sitting next to rule-based
  detection (rules catch known patterns; ML catches the unknown ones).

The NSL-KDD test set happens to contain **17 attack types that don't
exist anywhere in the training data at all** (e.g. `httptunnel`, `worm`,
`sqlattack`, `processtable`) — a genuine zero-day simulation. The model
was evaluated against those explicitly (see results below).

## 2. Algorithm

**Isolation Forest** — the algorithm your design doc names as the
recommended starting point (Section 7: "suitable for anomaly detection
and comparatively simple to implement"). It isolates anomalies by
randomly partitioning feature space; anomalies need fewer partitions to
isolate, which is cheap to compute and scales well to production log
volume, unlike distance-based methods (One-Class SVM, LOF) which get
expensive fast.

## 3. Pipeline

```
NSL-KDD raw records (41 fields)
        |
Feature preprocessing (fit on NORMAL traffic only)
  - categorical (protocol_type, service, flag) -> one-hot (unknown-safe)
  - numeric (38 fields) -> standard scaling
        |
Isolation Forest (300 trees, fit on NORMAL traffic only)
        |
Threshold calibration (held-out normal traffic, never used to fit the model)
  -> operating point chosen at a target false-positive rate
        |
Risk scoring: raw score -> 0-100 scale -> Low/Medium/High/Critical
  (matches Section 10 of the design doc exactly)
        |
Reason-code explainer: z-score + rarity based "why was this flagged"
  (matches Section 15 Explainable AI example format exactly)
```

## 4. Real results (NSL-KDD test set, 22,544 records, never touched during training)

| Metric | Value |
|---|---|
| ROC-AUC | **0.938** |
| PR-AUC | **0.951** |
| Precision @ 5% FPR operating point | **93.4%** |
| Recall @ 5% FPR operating point | **65.4%** |
| F1 | 0.770 |
| **Recall on the 17 attack types never seen in training** | **65.7%** |

The near-identical recall on completely unseen attack types (65.7%) vs.
overall recall (65.4%) is the key result: **the model isn't memorizing
known attack signatures, it's genuinely detecting deviation from
normal behaviour.**

Detection rate breaks down unevenly by attack family — and this is a
real, honestly-reported finding, not glossed over:

| Attack family | Recall | Why |
|---|---|---|
| Probe (port scans, network mapping) | **96.5%** | Loud, statistically obvious deviation |
| DoS (floods, SYN storms) | **78.4%** | Distinctive volumetric signature |
| U2R (privilege escalation) | 26.9% | Rare in training (only 52 examples exist anywhere), individually subtle |
| R2L (guessed passwords, remote exploits) | 6.6% | Deliberately mimics normal traffic; hardest class in *all* NSL-KDD literature |

**This is exactly why the design doc pairs ML anomaly detection with
rule-based detection (Section 6)** — R2L-style slow brute-force and
credential-guessing attacks are precisely what your rule engine's
"more than 10 failed logins in 2 minutes" rule is built to catch
cheaply and reliably. The ML layer is what generalizes to everything
your rules didn't anticipate. Neither layer alone is enough; that's
the whole architectural point.

You can tune the operating threshold for your own false-positive
tolerance — the training script produces a full sweep:

| Operating point | Precision | Recall | F1 | % of traffic flagged |
|---|---|---|---|---|
| 1% FPR (strict) | 98.4% | 55.3% | 0.708 | 32.0% |
| **5% FPR (default)** | **93.4%** | **65.4%** | **0.770** | 39.9% |
| 10% FPR (sensitive) | 92.5% | 71.7% | 0.808 | 44.1% |

*(Flag rate looks high because the NSL-KDD test set is intentionally
attack-heavy for research purposes — real production traffic is far
more normal-skewed, so the real-world alert volume will be much lower
than these percentages suggest.)*

All of the above is reproducible from `reports/metrics.json` and the
plots in `reports/`.

## 5. Project structure

```
aegissoc-ml/
├── data/
│   └── download_data.sh        # re-fetches NSL-KDD if you want to retrain
├── src/
│   ├── preprocessing.py        # dataset loading + feature pipeline
│   ├── train_model.py          # trains + evaluates + saves everything below
│   ├── risk_scoring.py         # raw score -> 0-100 -> Low/Med/High/Critical
│   ├── explain.py              # explainable-AI reason codes
│   ├── inference.py            # AnomalyDetector class — the reusable interface
│   └── app.py                  # FastAPI microservice (the "Python ML Service")
├── models/                     # trained artifacts (already trained — ready to use)
│   ├── preprocessor.joblib
│   ├── isolation_forest.joblib
│   ├── reason_explainer.joblib
│   └── metadata.json           # thresholds, calibration, full metrics
├── reports/                    # evaluation plots + metrics.json
│   ├── score_distribution.png
│   ├── roc_curve.png
│   ├── confusion_matrix.png
│   └── recall_by_attack_family.png
└── requirements.txt
```

## 6. Running it

```bash
pip install -r requirements.txt

# (Optional) retrain from scratch — artifacts in models/ are already trained,
# you only need this if you want to change hyperparameters or retrain on
# your own event data later.
bash data/download_data.sh
python3 src/train_model.py

# Start the ML microservice (from aegis_ml/aegissoc-ml, venv activated)
uvicorn app:app --host 0.0.0.0 --port 8000
```

### Try it

```bash
curl -X POST http://localhost:8000/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "evt-1042",
    "protocol_type": "tcp", "service": "private", "flag": "S0",
    "count": 123, "srv_count": 6,
    "serror_rate": 1.0, "srv_serror_rate": 1.0, "same_srv_rate": 0.05,
    "num_failed_logins": 5,
    "source_ip": "185.220.101.7", "destination": "server-03"
  }'
```

Response (real output from this exact model):
```json
{
  "event_id": "evt-1042",
  "is_anomaly": true,
  "risk_score": 74.94,
  "risk_level": "High",
  "raw_isolation_forest_score": -0.00776,
  "reasons": [
    {"feature": "num_failed_logins", "description": "failed login attempts is much higher than typical baseline (value=5, normal avg≈0.00)", "magnitude": 100.1},
    {"feature": "srv_serror_rate", "description": "srv serror rate is much higher than typical baseline (value=1, normal avg≈0.01)", "magnitude": 11.3},
    {"feature": "serror_rate", "description": "SYN-error rate is much higher than typical baseline (value=1, normal avg≈0.01)", "magnitude": 10.4},
    {"feature": "same_srv_rate", "description": "same srv rate is much lower than typical baseline (value=0.05, normal avg≈0.97)", "magnitude": 6.4},
    {"feature": "flag", "description": "connection status flag='S0' is rare/absent in normal baseline traffic (seen in 0.51% of normal cases)", "magnitude": 3.0}
  ]
}
```

Also available: `GET /health`, `GET /model/info`, `POST /api/v1/analyze/batch`.

## 7. Integrating into the full-stack AegisSOC platform

This matches Section 31's suggested architecture exactly:

```
Next.js (dashboard)
     |
Spring Boot (REST API, auth, correlation, incidents, PostgreSQL)
     |  HTTP call per event, or batched
Python ML Service (this FastAPI app)
     |
Isolation Forest + preprocessor (this repo's models/)
```

From Spring Boot, call `POST /api/v1/analyze` for each normalized
security event (or `/analyze/batch` for a batch of them) as part of your
event-processing pipeline (Section 4: "Event Processing -> Rule-Based
Detection / ML Anomaly Detection"). Feed the returned `risk_score` and
`reasons` straight into your Risk Scoring Engine (Section 10) and
Incident Engine (Section 17) — the 0-100 scale and Low/Medium/High/
Critical buckets are already defined to match your spec exactly, and
`reasons` maps directly onto the "Main reasons" bullet list in your
Explainable AI section (Section 15).

If your event schema differs from NSL-KDD's connection-record fields,
you have two options:
1. **Map your fields onto the closest NSL-KDD-style feature** (e.g.
   `failed_login_count` -> `num_failed_logins`, `bytes_out` ->
   `src_bytes`) — works immediately, no retraining needed.
2. **Retrain on your own labeled/unlabeled event stream** once you have
   enough real traffic — `src/train_model.py` is written to be adapted:
   swap the data-loading step for your own event export, keep everything
   downstream (preprocessing pattern, threshold calibration, risk
   scoring, explainer) as-is.

## 8. Honest limitations (worth knowing before you present this)

- **R2L/U2R detection is weak on its own** (6.6% / 26.9% recall) — this
  is a known, published limitation of unsupervised NSL-KDD anomaly
  detection, not a bug in this implementation. Pair with rule-based
  detection for credential-based attacks, as your own design doc
  already plans to.
- NSL-KDD is a **connection-record** dataset (aggregated stats about a
  network flow), not raw packet/log data — good for demonstrating the
  ML methodology end-to-end, but you'll want to retrain on your actual
  event schema once you're ingesting real logs from Wazuh/Sysmon/etc.
  (Section 31 already plans for this).
- The flag rate in the results table (32-44%) looks high only because
  NSL-KDD's test set is deliberately ~50% attacks for benchmarking;
  real production traffic is normal-skewed, so the real alert volume
  will be far lower.
