"""
risk_scoring.py
----------------
Converts a raw Isolation Forest decision_function score into the 0-100
risk score / severity bucket scheme described in the AegisSOC design
(Section 10: Risk Scoring Engine).

Isolation Forest decision_function: HIGHER = more normal, LOWER (more
negative) = more anomalous. We invert and min-max scale (with percentile
clipping to avoid a couple of extreme outliers from squashing the whole
scale) so that:
    0   -> perfectly normal
    100 -> maximally anomalous
"""
from __future__ import annotations
import numpy as np


def scores_to_risk(raw_scores: np.ndarray, score_low: float, score_high: float) -> np.ndarray:
    """
    raw_scores: decision_function() output (higher = more normal)
    score_low / score_high: calibration bounds saved at training time
                             (score_low = a very anomalous score,
                              score_high = a very normal score)
    """
    raw_scores = np.asarray(raw_scores, dtype=float)
    clipped = np.clip(raw_scores, score_low, score_high)
    normal_ness = (clipped - score_low) / (score_high - score_low + 1e-12)  # 0..1, 1=normal
    risk = (1.0 - normal_ness) * 100.0
    return np.clip(risk, 0.0, 100.0)


def risk_bucket(risk_score: float) -> str:
    if risk_score <= 25:
        return "Low"
    elif risk_score <= 50:
        return "Medium"
    elif risk_score <= 75:
        return "High"
    else:
        return "Critical"
