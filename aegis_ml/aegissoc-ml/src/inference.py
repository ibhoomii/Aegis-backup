"""
inference.py
------------
The reusable prediction interface. This is the module your fullstack
backend (or the FastAPI wrapper in app.py) calls to score a security
event. Loads the artifacts produced by the training scripts exactly once
and exposes a simple, well-typed function.

Two models are available:

  - "nslkdd"  - Isolation Forest on NSL-KDD connection records
                (trained on NORMAL traffic only; reason-code explainer)
  - "cicids"  - Isolation Forest on CICIDS2017 flow summaries
                (trained on BENIGN flows only; generic z-score explainer)

Usage:
    from inference import AnomalyDetector
    detector = AnomalyDetector(model="nslkdd")
    result = detector.predict_one({"protocol_type": "tcp", ...})
    flow = AnomalyDetector(model="cicids")
    flow.predict_one({"Flow_Duration": 120001, ...})
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from preprocessing import ALL_FEATURES, CATEGORICAL_FEATURES, NUMERIC_FEATURES
from risk_scoring import risk_bucket, scores_to_risk

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "models"
MODELS_ROOT = {
    "nslkdd": MODEL_DIR,
    "cicids": ROOT / "models_cicids",
}
AVAILABLE_MODELS = tuple(MODELS_ROOT)

# Sensible defaults so a caller can submit a partial event (e.g. only the
# fields their log source actually has) without crashing.
NSLKDD_DEFAULTS = {**{c: 0 for c in NUMERIC_FEATURES}, **{c: "unknown" for c in CATEGORICAL_FEATURES}}
NSLKDD_DEFAULTS.update({"protocol_type": "tcp", "service": "other", "flag": "SF", "logged_in": 0})


def _humanize(feature: str) -> str:
    return feature.replace("_", " ")


class AnomalyDetector:
    """One trained Isolation Forest + preprocessor + threshold + explainer."""

    def __init__(self, model: str = "nslkdd", model_dir: Path | str | None = None):
        model = model.lower()
        if model not in MODELS_ROOT:
            raise ValueError(f"Unknown model {model!r}. Available: {AVAILABLE_MODELS}")
        self.name = model
        model_dir = Path(model_dir) if model_dir else MODELS_ROOT[model]
        self.preprocessor = joblib.load(model_dir / "preprocessor.joblib")
        self.model = joblib.load(model_dir / "isolation_forest.joblib")
        with open(model_dir / "metadata.json") as f:
            self.metadata = json.load(f)
        self.threshold = self.metadata["operating_threshold"]
        self.score_low = self.metadata["risk_score_calibration"]["score_low"]
        self.score_high = self.metadata["risk_score_calibration"]["score_high"]
        self.features: list[str] = self.metadata.get("feature_names", [])
        self.numeric_only = "baseline_stats" in self.metadata

        if self.numeric_only:
            # CICIDS2017 flow model - all features numeric, defaults 0.
            self._defaults: dict[str, Any] = {c: 0 for c in self.features}
            self._reason_explainer = None
            self._input_features = self.features
        else:
            # NSL-KDD event model - categoricals + a fitted reason explainer.
            # metadata["feature_names"] lists the TRANSFORMED (one-hot) columns;
            # the preprocessor expects the RAW input columns.
            self._defaults = dict(NSLKDD_DEFAULTS)
            self._reason_explainer = joblib.load(model_dir / "reason_explainer.joblib")
            self._input_features = ALL_FEATURES

    # ------------------------------------------------------------------ rows
    def _to_row(self, event: dict[str, Any]) -> pd.DataFrame:
        merged = {**self._defaults, **event}
        row = {col: merged.get(col, self._defaults.get(col, 0)) for col in self._input_features}
        return pd.DataFrame([row])

    def _merged(self, event: dict[str, Any]) -> dict[str, Any]:
        return {**self._defaults, **event}

    # --------------------------------------------------------------- predict
    def predict_one(self, event: dict[str, Any], explain: bool = True) -> dict[str, Any]:
        row_df = self._to_row(event)
        X = self.preprocessor.transform(row_df)
        raw_score = float(self.model.decision_function(X)[0])
        is_anomaly = raw_score < self.threshold
        risk_score = float(scores_to_risk([raw_score], self.score_low, self.score_high)[0])

        result = {
            "is_anomaly": bool(is_anomaly),
            "risk_score": round(risk_score, 2),
            "risk_level": risk_bucket(risk_score),
            "raw_isolation_forest_score": round(raw_score, 5),
            "operating_threshold": round(self.threshold, 5),
            "model": self.name,
        }
        if explain:
            result["reasons"] = self._explain(self._merged(event))
        return result

    def predict_batch(self, events: list[dict[str, Any]], explain: bool = False) -> list[dict[str, Any]]:
        if not events:
            return []
        rows_df = pd.concat([self._to_row(e) for e in events], ignore_index=True)
        X = self.preprocessor.transform(rows_df)
        raw_scores = self.model.decision_function(X)
        risk_scores = scores_to_risk(raw_scores, self.score_low, self.score_high)

        results = []
        for i, event in enumerate(events):
            is_anomaly = bool(raw_scores[i] < self.threshold)
            r = {
                "is_anomaly": is_anomaly,
                "risk_score": round(float(risk_scores[i]), 2),
                "risk_level": risk_bucket(float(risk_scores[i])),
                "raw_isolation_forest_score": round(float(raw_scores[i]), 5),
            }
            if explain:
                r["reasons"] = self._explain(self._merged(event))
            results.append(r)
        return results

    # -------------------------------------------------------------- explainer
    def _explain(self, merged: dict[str, Any]) -> list[dict[str, Any]]:
        if self._reason_explainer is not None:
            return self._reason_explainer.explain(merged)
        # Generic z-score explainer (CICIDS flow model): which features sit
        # furthest from the benign baseline, scaled by baseline spread.
        stats = self.metadata["baseline_stats"]
        scored = []
        for feat, base in stats.items():
            val = merged.get(feat)
            if not isinstance(val, (int, float)) or isinstance(val, bool):
                continue
            std = base["std"] or 1.0
            z = abs(float(val) - base["mean"]) / std
            if z > 3:
                direction = "higher" if float(val) > base["mean"] else "lower"
                scored.append({
                    "feature": feat,
                    "description": (
                        f"{_humanize(feat)} is much {direction} than the benign baseline "
                        f"(value={float(val):.3g}, benign avg~{base['mean']:.3g}, z={z:.1f})"
                    ),
                    "magnitude": round(z, 2),
                })
        scored.sort(key=lambda d: -d["magnitude"])
        return scored[:5]


def merged_event(event: dict[str, Any]) -> dict[str, Any]:
    return {**NSLKDD_DEFAULTS, **event}


if __name__ == "__main__":
    detector = AnomalyDetector()

    suspicious_event = {
        "duration": 0, "protocol_type": "tcp", "service": "private", "flag": "S0",
        "src_bytes": 0, "dst_bytes": 0, "count": 123, "srv_count": 6,
        "serror_rate": 1.0, "srv_serror_rate": 1.0, "same_srv_rate": 0.05,
        "dst_host_count": 255, "dst_host_srv_count": 26, "num_failed_logins": 5,
    }
    normal_event = {
        "duration": 0, "protocol_type": "tcp", "service": "http", "flag": "SF",
        "src_bytes": 232, "dst_bytes": 8153, "count": 1, "srv_count": 1,
        "logged_in": 1, "same_srv_rate": 1.0, "dst_host_count": 1, "dst_host_srv_count": 1,
    }

    print("=== Suspicious-looking event ===")
    print(json.dumps(detector.predict_one(suspicious_event), indent=2))
    print("\n=== Normal-looking event ===")
    print(json.dumps(detector.predict_one(normal_event), indent=2))
