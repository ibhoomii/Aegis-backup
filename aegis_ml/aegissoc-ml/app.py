"""
app.py (project-root entry point)
----------------------------------
Thin launcher so the ML service can be started from the project root
(`aegis_ml/aegissoc-ml`) exactly as documented:

    uvicorn app:app --host 0.0.0.0 --port 8000

The real FastAPI application lives in ``src/app.py``; this module loads it
(and puts ``src/`` on ``sys.path`` so its intra-package imports such as
``inference`` / ``preprocessing`` resolve) and re-exports the ASGI app.

Starting from inside ``src/`` (``cd src && uvicorn app:app``) still works —
it loads ``src/app.py`` directly.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

SRC_DIR = Path(__file__).resolve().parent / "src"

# Make src/ importable so src/app.py's flat imports resolve regardless of cwd.
if str(SRC_DIR) not in sys.path:
    sys.path.append(str(SRC_DIR))

# Load src/app.py under a distinct module name so it does not collide with
# this module (which is already registered in sys.modules as "app").
_spec = importlib.util.spec_from_file_location("aegissoc_ml_service", SRC_DIR / "app.py")
if _spec is None or _spec.loader is None:  # pragma: no cover - defensive
    raise ImportError(f"Could not load the ML service application from {SRC_DIR / 'app.py'}")

_module = importlib.util.module_from_spec(_spec)
sys.modules["aegissoc_ml_service"] = _module
_spec.loader.exec_module(_module)

# The FastAPI ASGI application uvicorn looks up as `app:app`.
app = _module.app

# Re-export the public names used by scripts/tests.
SecurityEvent = _module.SecurityEvent
AnalyzeResponse = _module.AnalyzeResponse
BatchAnalyzeRequest = _module.BatchAnalyzeRequest
detectors = _module.detectors

__all__ = [
    "app",
    "SecurityEvent",
    "AnalyzeResponse",
    "BatchAnalyzeRequest",
    "detectors",
]
