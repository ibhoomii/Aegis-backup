"""
train_cicids.py
---------------
Trains the SECOND AegisSOC anomaly-detection model on CICIDS2017 — modern,
real, flow-based intrusion data (Canadian Institute for Cybersecurity).

Recipe (semi-supervised, benign-only fitting):
  - Isolation Forest fitted on BENIGN traffic only (never sees an attack)
  - Yeo-Johnson power transform + correlation-pruned features (see
    preprocessing_cicids.py) — this is where almost all of the recall
    improvement over the original StandardScaler recipe comes from
  - Three-way benign split (fit / calibrate / independent test) so the
    reported FPR and precision are not circular: fit_benign trains the
    model, calib_benign only sets the threshold, and test_benign is held
    out untouched until final scoring
  - Operating threshold calibrated on calib_benign at 5% FPR
  - Evaluated on attacks + the INDEPENDENT benign test set, incl.
    per-attack-class recall

An IsolationForest + LocalOutlierFactor ensemble was tried and dropped: on
two independent evaluation runs it changed recall by -0.2 and -0.8 points
(never positive) while roughly doubling training time. A port-based
web/non-web segmented architecture was also tried, to target the near-zero
recall on Web Attack (Brute Force/XSS/SQLi) classes; it *reduced* overall
recall (82% -> 70%) and even DDoS recall (61% -> 40%), and web-attack
recall stayed at 0% regardless. That result indicates the web-attack gap
isn't a threshold/calibration problem — CICFlowMeter's flow-level
statistics (duration, byte/packet counts, timing) don't carry the
information that distinguishes a SQLi/XSS/brute-force HTTP request from a
normal one; that signal lives in the request payload, which this feature
set doesn't capture. Closing that gap would need either payload-aware
features or a separate supervised classifier trained on the labeled attack
samples — a different modeling approach than the benign-only anomaly
detector here. Documented as a known, understood limitation rather than
something this script attempts to fix.

Run:
    python3 src/train_cicids.py
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    precision_recall_fscore_support,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split

from preprocessing_cicids import build_cicids_preprocessor, drop_correlated_features, load_cicids
from risk_scoring import risk_bucket, scores_to_risk

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "cicids2017"
MODEL_DIR = ROOT / "models_cicids"
REPORT_DIR = ROOT / "reports"
MODEL_DIR.mkdir(exist_ok=True)
REPORT_DIR.mkdir(exist_ok=True)

RANDOM_STATE = 42
TARGET_FPR = 0.05
MAX_BENIGN_FIT = 60_000     # keep training fast; flows are highly redundant
MAX_EVAL_PER_SIDE = 50_000  # cap evaluation rows per class
CORR_THRESHOLD = 0.95       # drop one side of any pair correlated above this


def main():
    t0 = time.time()
    files = sorted(DATA_DIR.glob("*.csv"))
    if not files:
        raise SystemExit(
            f"No CICIDS2017 CSV files found in {DATA_DIR}. "
            "Download them first (see data/download_cicids2017.sh)."
        )
    print("=" * 70)
    print("AegisSOC — CICIDS2017 anomaly detector — training")
    print(f"Files: {[f.name for f in files]}")
    print("=" * 70)

    df = load_cicids([str(f) for f in files])
    # Degenerate / leakage-prone flow features: Init_Win_bytes_* is dominated by
    # one QUIC-era value that benign traffic shares with scans (hides real
    # outliers), and Active/Idle stats are ~0 for the vast majority of flows.
    # Dropping them measurably improves DDoS recall at the same FPR.
    DROP_FEATURES = {
        "Init_Win_bytes_forward", "Init_Win_bytes_backward",
        "Active_Mean", "Active_Std", "Active_Max", "Active_Min",
        "Idle_Mean", "Idle_Std", "Idle_Max", "Idle_Min",
    }
    features = [
        c for c in df.columns
        if c not in ("is_anomaly", "attack_class") and c not in DROP_FEATURES
    ]
    print(f"Loaded {len(df):,} flows, {len(features)} features")
    print("Attack mix (all files combined):")
    for lab, n in df["attack_class"].value_counts().items():
        print(f"  {str(lab):<30} {n:>9,}")

    benign = df[df["is_anomaly"] == 0].reset_index(drop=True)
    attack = df[df["is_anomaly"] == 1].reset_index(drop=True)
    print(f"Benign: {len(benign):,} | Attack: {len(attack):,}")

    # Three-way benign split so the final metrics are independent of the
    # threshold-setting data. calib_benign ONLY sets thr; test_benign is
    # held out untouched until final scoring. Reusing calib_benign as both
    # the threshold source and the benign evaluation set makes the measured
    # FPR/precision partly circular — recall is unaffected either way, since
    # eval_attack is always held out, but FPR/precision are not trustworthy
    # under that setup.
    fit_benign, holdout_benign = train_test_split(
        benign, test_size=0.40, random_state=RANDOM_STATE
    )
    calib_benign, test_benign = train_test_split(
        holdout_benign, test_size=0.5, random_state=RANDOM_STATE
    )
    if len(fit_benign) > MAX_BENIGN_FIT:
        fit_benign = fit_benign.sample(MAX_BENIGN_FIT, random_state=RANDOM_STATE)
    eval_attack = attack
    if len(eval_attack) > MAX_EVAL_PER_SIDE:
        eval_attack = eval_attack.sample(MAX_EVAL_PER_SIDE, random_state=RANDOM_STATE)
    print(f"Fit on {len(fit_benign):,} benign | calibrate on {len(calib_benign):,} benign "
          f"| final test on {len(eval_attack):,} attacks + {len(test_benign):,} independent benign")

    # ---- feature pruning (benign-only, no label leakage) -------------------
    features = drop_correlated_features(fit_benign, features, threshold=CORR_THRESHOLD)

    # ---- fit -----------------------------------------------------------------
    pre = build_cicids_preprocessor(features)
    X_fit = pre.fit_transform(fit_benign[features])
    model = IsolationForest(
        n_estimators=400, max_samples=4096, random_state=RANDOM_STATE, n_jobs=-1
    )
    model.fit(X_fit)
    print("Isolation Forest fitted on benign-only flows.")

    # ---- calibrate threshold on held-out benign ------------------------------
    X_calib = pre.transform(calib_benign[features])
    calib_scores = model.decision_function(X_calib)
    thr = float(np.quantile(calib_scores, TARGET_FPR))  # below => flagged
    score_low = float(np.quantile(calib_scores, 0.001))
    score_high = float(np.quantile(calib_scores, 0.999))
    print(f"Operating threshold @ {TARGET_FPR:.0%} FPR: {thr:.5f}")

    # ---- final, independent evaluation ---------------------------------------
    # test_benign was never used to fit the model or to set thr, so
    # precision/FPR measured here are not circular.
    eval_df = pd.concat([test_benign, eval_attack], ignore_index=True)
    y = eval_df["is_anomaly"].to_numpy()
    X_eval = pre.transform(eval_df[features])
    raw = model.decision_function(X_eval)
    pred = (raw < thr).astype(int)
    prec, rec, f1, _ = precision_recall_fscore_support(y, pred, average="binary", zero_division=0)
    roc = float(roc_auc_score(y, -raw))
    pr = float(average_precision_score(y, -raw))
    cm = confusion_matrix(y, pred)
    print(f"Precision {prec:.3f} | Recall {rec:.3f} | F1 {f1:.3f} | ROC-AUC {roc:.3f} | PR-AUC {pr:.3f}")
    print(f"Confusion matrix [TN FP / FN TP]:\n{cm}")

    # Per-attack-class recall (eval_df kept the fine-grained class).
    recall_by_class = {}
    for cls, grp in eval_df[eval_df["is_anomaly"] == 1].groupby("attack_class"):
        g_raw = model.decision_function(pre.transform(grp[features]))
        recall_by_class[str(cls)] = round(float((g_raw < thr).mean()), 4)
    print("Recall by attack class:")
    for cls, r in sorted(recall_by_class.items(), key=lambda kv: -kv[1]):
        print(f"  {cls:<24} {r:.3f}")

    # ---- persist ---------------------------------------------------------------
    joblib.dump(pre, MODEL_DIR / "preprocessor.joblib")
    joblib.dump(model, MODEL_DIR / "isolation_forest.joblib")

    # Baseline stats for the generic z-score reason explainer at inference time.
    baseline_stats = {
        feat: {"mean": float(fit_benign[feat].mean()), "std": float(fit_benign[feat].std() or 1.0)}
        for feat in features
    }

    metadata = {
        "model_type": "IsolationForest",
        "sklearn_training": "semi-supervised (trained on BENIGN flows only)",
        "dataset": "CICIDS2017 (Canadian Institute for Cybersecurity)",
        "n_estimators": 400,
        "random_state": RANDOM_STATE,
        "feature_count": len(features),
        "feature_names": features,
        "correlation_prune_threshold": CORR_THRESHOLD,
        "baseline_stats": baseline_stats,
        "operating_threshold": thr,
        "target_fpr": TARGET_FPR,
        "risk_score_calibration": {"score_low": score_low, "score_high": score_high},
        "training_rows_used": int(len(fit_benign)),
        "calibration_rows_used": int(len(calib_benign)),
        "independent_test_benign_rows_used": int(len(test_benign)),
        "test_metrics": {
            "accuracy": float((pred == y).mean()),
            "precision": float(prec),
            "recall": float(rec),
            "f1": float(f1),
            "roc_auc": roc,
            "pr_auc": pr,
            "confusion_matrix": cm.tolist(),
            "recall_by_attack_class": recall_by_class,
        },
    }
    with open(MODEL_DIR / "metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)
    with open(REPORT_DIR / "metrics_cicids.json", "w") as f:
        json.dump(metadata["test_metrics"], f, indent=2)

    print(f"Artifacts -> {MODEL_DIR}")
    print(f"Done in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()