"""
preprocessing_cicids.py
-----------------------
Loads the CICIDS2017 dataset (Canadian Institute for Cybersecurity) and
builds the feature pipeline for the second AegisSOC anomaly-detection model.

CICIDS2017 is real, flow-based intrusion data captured over five days on a
testbed network (benign traffic + attacks: Brute Force, DoS/DDoS, Heartbleed,
Web Attacks, Infiltration, Botnet, Port Scan). Each row is one bidirectional
flow summary from CICFlowMeter with ~78 statistical features.

Where NSL-KDD teaches the model "connection records", CICIDS2017 teaches it
modern flow telemetry — the two models complement each other: the first scores
normalized security events, the second scores raw network-flow summaries.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import PowerTransformer

TARGET = "Label"  # CICIDS2017 label column ("BENIGN" or attack name)

# CICFlowMeter columns with whitespace in their names -> normalized here.
def _norm_cols(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = [c.strip().replace(" ", "_") for c in df.columns]
    return df


def load_cicids(paths: list[str], max_rows_per_file: int | None = None) -> pd.DataFrame:
    """Load one or more CICIDS2017 MachineLearningCVE CSV files."""
    frames = []
    for p in paths:
        df = pd.read_csv(p, encoding="utf-8", low_memory=False)
        df = _norm_cols(df)
        if max_rows_per_file:
            df = df.head(max_rows_per_file)
        frames.append(df)
    out = pd.concat(frames, ignore_index=True)

    # Numeric coercion: the dataset has stray values like "Infinity" and "NaN".
    for col in out.columns:
        if col != TARGET:
            out[col] = pd.to_numeric(out[col], errors="coerce")
    out = out.replace([np.inf, -np.inf], np.nan)
    # Label the attack flag BEFORE dropping rows, so evaluation stays honest,
    # and keep the fine-grained attack class for per-class reporting.
    out["is_anomaly"] = (out[TARGET].str.strip() != "BENIGN").astype(int)
    out["attack_class"] = out[TARGET].str.strip()
    out = out.dropna()
    # Drop label-ish / constant / identifier columns that leak or add noise.
    drop_cols = [
        c for c in out.columns
        if c in (TARGET, "Destination_Port", "Fwd_Header_Length.1")
    ]
    out = out.drop(columns=drop_cols)
    # Anything still object-typed (shouldn't happen) is dropped.
    for col in list(out.columns):
        if col in ("is_anomaly", "attack_class"):
            continue
        if not pd.api.types.is_numeric_dtype(out[col]):
            out = out.drop(columns=[col])
    return out


def cicids_feature_names(df: pd.DataFrame) -> list[str]:
    return [c for c in df.columns if c not in ("is_anomaly",)]


def drop_correlated_features(
    fit_benign: pd.DataFrame, features: list[str], threshold: float = 0.95
) -> list[str]:
    """
    Greedy correlation pruning, computed on BENIGN fit data only (no label
    leakage — attack rows never enter this calculation).

    CICIDS2017 carries many near-duplicate columns (e.g. several
    Fwd/Bwd_IAT_* stats vs Flow_IAT_*, Subflow_* vs Total_* pairs).
    Isolation Forest picks a random feature at every split, so redundant
    columns just steal split budget away from genuinely discriminative
    features. Dropping one side of each highly-correlated pair concentrates
    the forest's splits on signal instead of duplicates, which measurably
    raises recall at a fixed FPR.
    """
    corr = fit_benign[features].corr().abs()
    upper = corr.where(np.triu(np.ones(corr.shape, dtype=bool), k=1))
    to_drop = {col for col in upper.columns if (upper[col] > threshold).any()}
    kept = [f for f in features if f not in to_drop]
    print(f"Correlation pruning (>{threshold}): kept {len(kept)}/{len(features)} features "
          f"(dropped {sorted(to_drop)})")
    return kept


def build_cicids_preprocessor(features: list[str]) -> ColumnTransformer:
    # Yeo-Johnson power transform instead of a plain StandardScaler.
    # CICFlowMeter's byte/packet/duration/rate features are extremely
    # heavy-tailed — a small number of huge flows dwarf the rest.
    # StandardScaler only shifts/rescales that skew, so Isolation Forest's
    # axis-aligned splits waste most of their range on the tail instead of
    # separating the bulk of benign traffic from moderate anomalies (e.g.
    # stealthy scans, low-and-slow web attacks). Yeo-Johnson first maps each
    # feature toward a roughly Gaussian shape (it handles zero/negative
    # values, unlike log1p, so it's safe to apply blindly across all
    # features) and then standardizes — this is usually the single biggest
    # recall lever for Isolation Forest on flow data.
    return ColumnTransformer(
        transformers=[
            ("num", PowerTransformer(method="yeo-johnson", standardize=True), features)
        ]
    )