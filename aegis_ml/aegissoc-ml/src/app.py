"""
app.py
------
AegisSOC ML Service — the Python microservice sitting between your
Spring Boot backend and the trained model, exactly as laid out in the
design doc's architecture:

    Next.js -> Spring Boot -> Python ML Service -> ML Models

Run locally — from the project root (aegis_ml/aegissoc-ml):
    source .venv/bin/activate
    uvicorn app:app --host 0.0.0.0 --port 8000

or from inside src/ (loads this file directly, no root shim needed):
    cd src && uvicorn app:app --host 0.0.0.0 --port 8000

Then, e.g. from Spring Boot (or curl/Postman):
    POST http://localhost:8000/api/v1/analyze
    POST http://localhost:8000/api/v1/analyze/batch
    GET  http://localhost:8000/health
    GET  http://localhost:8000/model/info
"""
from __future__ import annotations

import importlib.util
import os
import shutil
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional

# Modules this service cannot run without (checked cheaply via find_spec).
_REQUIRED_MODULES = ("fastapi", "pydantic", "pandas", "sklearn", "joblib")


def _ensure_dependencies() -> None:
    """Make sure `uvicorn app:app --port 8000` starts in a usable interpreter.

    The distro launcher (/usr/bin/uvicorn) runs Python with -s and therefore
    sees neither ~/.local nor the project venv, and a shell with a stale
    command hash can resolve `uvicorn` to the wrong binary entirely. When the
    interpreter we ended up in is missing the ML dependencies but the project
    venv (.venv) has them, relaunch the process with the venv's own uvicorn —
    argv is preserved and uvicorn has not bound the port yet at import time.

    Loop-safe: we only relaunch when we are NOT already running inside the
    project venv, and only after confirming the venv actually has fastapi.
    """
    missing = [m for m in _REQUIRED_MODULES if importlib.util.find_spec(m) is None]
    if not missing:
        return

    venv = Path(__file__).resolve().parents[1] / ".venv"
    in_project_venv = Path(sys.prefix).resolve() == venv.resolve()
    venv_uvicorn = venv / "bin" / "uvicorn"
    venv_has_fastapi = any((venv / "lib").glob("*/site-packages/fastapi/__init__.py"))

    if not in_project_venv and venv_uvicorn.exists() and venv_has_fastapi:
        resolved = shutil.which("uvicorn")
        print(
            f"[aegissoc-ml] {sys.executable} is missing {', '.join(missing)}; "
            "relaunching with the project venv"
            + (f" (your shell resolves `uvicorn` to {resolved})" if resolved else "")
            + ".",
            file=sys.stderr,
            flush=True,
        )
        try:
            os.execv(str(venv_uvicorn), [str(venv_uvicorn), *sys.argv[1:]])
        except OSError:  # pragma: no cover - fall through to the guidance error
            pass

    # Could not relaunch — explain exactly what to do.
    if in_project_venv:
        raise ImportError(
            f"The project virtualenv is missing: {', '.join(missing)}.\n"
            "Install them with:\n"
            "    uv pip install -r requirements.txt"
        )
    raise ImportError(
        f"Python ({sys.executable}) is missing: {', '.join(missing)}.\n"
        "Start the service with the project virtual environment instead:\n"
        "    cd aegis_ml/aegissoc-ml && source .venv/bin/activate\n"
        "    uvicorn app:app --port 8000\n"
        "or, without activating:\n"
        "    .venv/bin/uvicorn app:app --port 8000\n"
        "(If the venv IS active but this still appears, your shell has a stale "
        "command hash — run `rehash` in zsh or `hash -r` in bash.)"
    )


_ensure_dependencies()

try:
    from fastapi import FastAPI, HTTPException
    from pydantic import BaseModel, ConfigDict, Field
except ImportError as exc:  # pragma: no cover - last-resort guidance
    raise ImportError(
        f"ML service dependencies failed to import under {sys.executable}. "
        "Activate the project virtual environment first:\n"
        "    cd aegis_ml/aegissoc-ml && source .venv/bin/activate\n"
        "    uvicorn app:app --port 8000"
    ) from exc

from inference import AVAILABLE_MODELS, AnomalyDetector

detectors: dict[str, AnomalyDetector] = {}


def _load_models() -> None:
    # Load every trained model found on disk (nslkdd and, if trained, cicids).
    for name in AVAILABLE_MODELS:
        try:
            detectors[name] = AnomalyDetector(model=name)
        except FileNotFoundError:
            pass  # model not trained yet - /models reports it as unavailable


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    _load_models()
    yield
    detectors.clear()


app = FastAPI(
    title="AegisSOC ML Anomaly Detection Service",
    description="Semi-supervised network/security-event anomaly detector "
                "(Isolation Forest, trained on NSL-KDD).",
    version="2.0.0",
    lifespan=_lifespan,
)


def _detector(model: Optional[str]) -> AnomalyDetector:
    name = (model or "nslkdd").lower()
    if name not in AVAILABLE_MODELS:
        raise HTTPException(400, f"Unknown model {name!r}. Available: {list(AVAILABLE_MODELS)}")
    det = detectors.get(name)
    if det is None:
        raise HTTPException(503, f"Model {name!r} is not trained yet.")
    return det


class SecurityEvent(BaseModel):
    """
    Mirrors the normalized security-event shape from the design doc
    (Section 5). All fields are optional — anything omitted falls back
    to a safe default so partial log sources still work — but the more
    fields you provide, the more accurate the score.
    """
    model_config = ConfigDict(extra="allow")

    duration: Optional[float] = 0
    protocol_type: Optional[str] = "tcp"
    service: Optional[str] = "other"
    flag: Optional[str] = "SF"
    src_bytes: Optional[float] = 0
    dst_bytes: Optional[float] = 0
    land: Optional[int] = 0
    wrong_fragment: Optional[int] = 0
    urgent: Optional[int] = 0
    hot: Optional[int] = 0
    num_failed_logins: Optional[int] = 0
    logged_in: Optional[int] = 0
    num_compromised: Optional[int] = 0
    root_shell: Optional[int] = 0
    su_attempted: Optional[int] = 0
    num_root: Optional[int] = 0
    num_file_creations: Optional[int] = 0
    num_shells: Optional[int] = 0
    num_access_files: Optional[int] = 0
    num_outbound_cmds: Optional[int] = 0
    is_host_login: Optional[int] = 0
    is_guest_login: Optional[int] = 0
    count: Optional[float] = 1
    srv_count: Optional[float] = 1
    serror_rate: Optional[float] = 0
    srv_serror_rate: Optional[float] = 0
    rerror_rate: Optional[float] = 0
    srv_rerror_rate: Optional[float] = 0
    same_srv_rate: Optional[float] = 1
    diff_srv_rate: Optional[float] = 0
    srv_diff_host_rate: Optional[float] = 0
    dst_host_count: Optional[float] = 1
    dst_host_srv_count: Optional[float] = 1
    dst_host_same_srv_rate: Optional[float] = 1
    dst_host_diff_srv_rate: Optional[float] = 0
    dst_host_same_src_port_rate: Optional[float] = 0
    dst_host_srv_diff_host_rate: Optional[float] = 0
    dst_host_serror_rate: Optional[float] = 0
    dst_host_srv_serror_rate: Optional[float] = 0
    dst_host_rerror_rate: Optional[float] = 0
    dst_host_srv_rerror_rate: Optional[float] = 0

    # Free-form identifiers, not used by the model but useful to echo back
    # to the caller / attach to the resulting incident.
    source_ip: Optional[str] = None
    destination: Optional[str] = None
    username: Optional[str] = None
    event_id: Optional[str] = None
    # Which trained detector to use: "nslkdd" (default) or "cicids".
    model: Optional[str] = None


class AnalyzeResponse(BaseModel):
    event_id: Optional[str] = None
    is_anomaly: bool
    risk_score: float = Field(..., description="0-100 SOC risk score, higher = more anomalous")
    risk_level: str = Field(..., description="Low / Medium / High / Critical")
    raw_isolation_forest_score: float
    reasons: list[dict[str, Any]]


class BatchAnalyzeRequest(BaseModel):
    events: list[SecurityEvent]


@app.get("/health")
def health():
    return {
        "status": "ok",
        "models_loaded": sorted(detectors.keys()),
    }


@app.get("/models")
def models():
    return {
        "available": list(AVAILABLE_MODELS),
        "loaded": sorted(detectors.keys()),
    }


@app.get("/model/info")
def model_info(model: Optional[str] = None):
    det = _detector(model)
    return {
        "model": det.name,
        "model_type": det.metadata["model_type"],
        "training_mode": det.metadata["sklearn_training"],
        "dataset": det.metadata["dataset"],
        "operating_threshold": det.metadata["operating_threshold"],
        "target_false_positive_rate": det.metadata["target_fpr"],
        "test_metrics": det.metadata["test_metrics"],
    }


@app.post("/api/v1/analyze", response_model=AnalyzeResponse)
def analyze(event: SecurityEvent):
    payload = event.model_dump()
    event_id = payload.pop("event_id", None)
    model = payload.pop("model", None)
    det = _detector(model)
    result = det.predict_one(payload, explain=True)
    return {"event_id": event_id, **result}


@app.post("/api/v1/analyze/batch", response_model=list[AnalyzeResponse])
def analyze_batch(request: BatchAnalyzeRequest):
    payloads = []
    event_ids = []
    model = None
    for e in request.events:
        d = e.model_dump()
        event_ids.append(d.pop("event_id", None))
        model = d.pop("model", None) or model
        payloads.append(d)
    det = _detector(model)
    results = det.predict_batch(payloads, explain=True)
    return [{"event_id": eid, **r} for eid, r in zip(event_ids, results)]
