"""
explain.py
----------
Explainable-AI layer (AegisSOC design Section 15). Rather than the model
saying "Threat = YES", we surface WHICH fields drove that verdict.

Isolation Forest doesn't expose clean per-prediction feature attributions
the way a plain classifier does, and off-the-shelf SHAP explainers for
tree-ensembles are built for supervised splits, not isolation-path length —
they can be applied but are slow and their attributions for this model
type are not very trustworthy. Instead we use a transparent, always-correct
method that matches the exact style shown in the design doc's example
("+ Unusual login time", "+ Unknown device", ...):

For every numeric feature, compare the event's z-score against the
distribution of NORMAL training traffic. For every categorical feature,
flag values that are rare or absent in normal traffic. Rank by magnitude
and return the top contributing reasons.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from preprocessing import CATEGORICAL_FEATURES, NUMERIC_FEATURES

# Human-friendly labels for the more opaque NSL-KDD field names
FRIENDLY_NAMES = {
    "src_bytes": "bytes sent to destination",
    "dst_bytes": "bytes received from destination",
    "count": "connections to same host (last 2s)",
    "srv_count": "connections to same service (last 2s)",
    "serror_rate": "SYN-error rate",
    "rerror_rate": "REJ-error rate",
    "num_failed_logins": "failed login attempts",
    "logged_in": "successful login flag",
    "num_compromised": "compromised-condition indicators",
    "root_shell": "root shell obtained",
    "su_attempted": "'su root' attempted",
    "num_file_creations": "file creation operations",
    "num_access_files": "access-control-file operations",
    "dst_host_count": "connections to destination host (last 100)",
    "dst_host_srv_count": "connections to destination service (last 100)",
    "dst_host_diff_srv_rate": "rate of distinct services on destination host",
    "protocol_type": "network protocol",
    "service": "network service",
    "flag": "connection status flag",
}


def _friendly(name: str) -> str:
    return FRIENDLY_NAMES.get(name, name.replace("_", " "))


class ReasonCodeExplainer:
    """Fit once on normal training data; explain() any new event dict/row."""

    def __init__(self):
        self.means_: pd.Series | None = None
        self.stds_: pd.Series | None = None
        self.categorical_freq_: dict[str, pd.Series] = {}

    def fit(self, normal_df: pd.DataFrame) -> "ReasonCodeExplainer":
        self.means_ = normal_df[NUMERIC_FEATURES].mean()
        self.stds_ = normal_df[NUMERIC_FEATURES].std().replace(0, 1e-6)
        for col in CATEGORICAL_FEATURES:
            self.categorical_freq_[col] = normal_df[col].value_counts(normalize=True)
        return self

    def explain(self, event: dict, top_k: int = 5) -> list[dict]:
        reasons = []

        for col in NUMERIC_FEATURES:
            val = float(event.get(col, 0.0))
            z = (val - self.means_[col]) / self.stds_[col]
            if abs(z) >= 2.0:  # more than 2 std devs from normal baseline
                direction = "much higher than" if z > 0 else "much lower than"
                reasons.append({
                    "feature": col,
                    "description": f"{_friendly(col)} is {direction} typical baseline "
                                    f"(value={val:g}, normal avg≈{self.means_[col]:.2f})",
                    "magnitude": abs(z),
                })

        for col in CATEGORICAL_FEATURES:
            val = event.get(col, None)
            freq_table = self.categorical_freq_[col]
            freq = float(freq_table.get(val, 0.0))
            if freq < 0.01:  # rare or never seen in normal baseline traffic
                reasons.append({
                    "feature": col,
                    "description": f"{_friendly(col)}='{val}' is rare/absent in normal baseline "
                                    f"traffic (seen in {freq*100:.2f}% of normal cases)",
                    "magnitude": (1.0 - freq) * 3.0,  # scale roughly comparable to z-scores
                })

        reasons.sort(key=lambda r: r["magnitude"], reverse=True)
        return reasons[:top_k]
