"""
train_model.py
---------------
Trains the AegisSOC ML anomaly-detection layer described in the design
document (Section 7): a model that learns what NORMAL network/security
behaviour looks like, then flags deviations — without ever being trained
on attack labels. This is a semi-supervised / novelty-detection setup,
which mirrors how a real SOC operates: you have abundant "known-good"
baseline telemetry and comparatively few confirmed attack examples.

Pipeline:
  1. Load NSL-KDD train/test sets.
  2. Fit the feature preprocessor (one-hot + scaling) on NORMAL traffic only.
  3. Fit an Isolation Forest on NORMAL traffic only.
  4. Calibrate an operating threshold using a held-out slice of normal
     traffic (never seen during model fitting) at a target false-positive
     rate — the same trade-off a SOC analyst tunes in production.
  5. Evaluate on the untouched NSL-KDD test set, which crucially contains
     17 attack types that never appear anywhere in training — a genuine
     test of "detect previously unknown / unusual behaviour" (Section 7).
  6. Save the trained artifacts + a metrics/plots report.

Run:
    python3 src/train_model.py
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
from sklearn.ensemble import IsolationForest
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    precision_recall_fscore_support,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import train_test_split

from preprocessing import build_preprocessor, get_feature_names, load_dataset
from risk_scoring import risk_bucket, scores_to_risk
from explain import ReasonCodeExplainer

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
MODEL_DIR = ROOT / "models"
REPORT_DIR = ROOT / "reports"
MODEL_DIR.mkdir(exist_ok=True)
REPORT_DIR.mkdir(exist_ok=True)

RANDOM_STATE = 42
TARGET_FPR = 0.05  # 5% false-positive rate on clean baseline traffic


def main():
    t0 = time.time()
    print("=" * 70)
    print("AegisSOC — ML Anomaly Detection — Training")
    print("=" * 70)

    # ------------------------------------------------------------------
    # 1. Load data
    # ------------------------------------------------------------------
    train_df, test_df = load_dataset(str(DATA_DIR / "KDDTrain+.txt"), str(DATA_DIR / "KDDTest+.txt"))
    print(f"Loaded train: {train_df.shape}, test: {test_df.shape}")

    normal_train_df = train_df[train_df["is_anomaly"] == 0].reset_index(drop=True)
    attack_train_df = train_df[train_df["is_anomaly"] == 1].reset_index(drop=True)
    print(f"Normal-only training pool: {len(normal_train_df)} rows "
          f"(attacks in the training file are set aside and NOT used to fit the model: "
          f"{len(attack_train_df)} rows)")

    # Hold out a slice of NORMAL traffic purely for threshold calibration.
    fit_normal_df, calib_normal_df = train_test_split(
        normal_train_df, test_size=0.25, random_state=RANDOM_STATE
    )
    print(f"  -> {len(fit_normal_df)} normal rows to fit the model")
    print(f"  -> {len(calib_normal_df)} normal rows held out for threshold calibration")

    # ------------------------------------------------------------------
    # 2. Fit preprocessor on normal traffic only (this defines "the baseline")
    # ------------------------------------------------------------------
    preprocessor = build_preprocessor()
    X_fit = preprocessor.fit_transform(fit_normal_df)
    feature_names = get_feature_names(preprocessor)
    print(f"Feature space after encoding: {X_fit.shape[1]} dimensions")

    # ------------------------------------------------------------------
    # 3. Fit Isolation Forest on normal traffic only
    # ------------------------------------------------------------------
    model = IsolationForest(
        n_estimators=300,
        max_samples="auto",
        contamination=0.01,   # assumed background noise rate in "clean" baseline data
        max_features=1.0,
        bootstrap=False,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    model.fit(X_fit)
    print(f"Isolation Forest fitted on {X_fit.shape[0]} normal-only samples.")

    # ------------------------------------------------------------------
    # 4. Calibrate operating threshold from held-out normal traffic
    # ------------------------------------------------------------------
    X_calib = preprocessor.transform(calib_normal_df)
    calib_scores = model.decision_function(X_calib)  # higher = more normal

    threshold_table = {}
    for fpr in (0.01, 0.05, 0.10):
        thr = float(np.quantile(calib_scores, fpr))
        threshold_table[f"fpr_{int(fpr*100)}pct"] = thr
    operating_threshold = threshold_table[f"fpr_{int(TARGET_FPR*100)}pct"]
    print("Calibrated thresholds from held-out normal traffic:")
    for k, v in threshold_table.items():
        print(f"  {k}: decision_function < {v:.4f}  =>  flagged anomalous")
    print(f"Operating threshold (target {int(TARGET_FPR*100)}% FPR): {operating_threshold:.4f}")

    # Calibration bounds for the 0-100 risk score (percentile-clipped to
    # avoid a few extreme points from squashing the usable scale)
    all_calib_scores_for_scaling = np.concatenate([
        calib_scores,
        model.decision_function(preprocessor.transform(attack_train_df.sample(
            n=min(3000, len(attack_train_df)), random_state=RANDOM_STATE
        ))),
    ])
    score_low = float(np.percentile(all_calib_scores_for_scaling, 1))
    score_high = float(np.percentile(all_calib_scores_for_scaling, 99))
    print(f"Risk-score calibration bounds: low={score_low:.4f} (very anomalous), "
          f"high={score_high:.4f} (very normal)")

    # ------------------------------------------------------------------
    # 5. Evaluate on the untouched NSL-KDD test set
    # ------------------------------------------------------------------
    X_test = preprocessor.transform(test_df)
    test_scores = model.decision_function(X_test)  # higher = normal
    y_true = test_df["is_anomaly"].values
    y_pred = (test_scores < operating_threshold).astype(int)

    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, average="binary", zero_division=0
    )
    accuracy = float((y_pred == y_true).mean())
    # For ROC/PR AUC, "anomaly likelihood" = -test_scores (higher = more anomalous)
    anomaly_likelihood = -test_scores
    roc_auc = roc_auc_score(y_true, anomaly_likelihood)
    pr_auc = average_precision_score(y_true, anomaly_likelihood)
    cm = confusion_matrix(y_true, y_pred)

    print("\n--- Test set performance (operating threshold, target 5% FPR) ---")
    print(f"Accuracy:  {accuracy:.4f}")
    print(f"Precision: {precision:.4f}")
    print(f"Recall:    {recall:.4f}")
    print(f"F1:        {f1:.4f}")
    print(f"ROC-AUC:   {roc_auc:.4f}")
    print(f"PR-AUC:    {pr_auc:.4f}")
    print(f"Confusion matrix [ [TN FP] [FN TP] ]:\n{cm}")

    # Threshold sweep table for the report (precision/recall trade-off)
    sweep_rows = []
    for name, thr in threshold_table.items():
        yp = (test_scores < thr).astype(int)
        p, r, f, _ = precision_recall_fscore_support(y_true, yp, average="binary", zero_division=0)
        sweep_rows.append({"operating_point": name, "threshold": thr,
                            "precision": p, "recall": r, "f1": f,
                            "flag_rate": float(yp.mean())})
    print("\nThreshold sweep (precision/recall trade-off analysts can tune):")
    for row in sweep_rows:
        print(f"  {row['operating_point']:>10}: P={row['precision']:.3f} "
              f"R={row['recall']:.3f} F1={row['f1']:.3f} "
              f"flag_rate={row['flag_rate']:.3f}")

    # Recall broken down by attack family (this is the interesting real finding:
    # DoS/Probe are loud & easy, R2L/U2R are quiet & hard — genuinely reported).
    recall_by_category = {}
    for cat in ["dos", "probe", "r2l", "u2r"]:
        mask = test_df["attack_category"] == cat
        if mask.sum() > 0:
            recall_by_category[cat] = float(y_pred[mask.values].mean())

    # Recall specifically on the 17 attack types that NEVER appear in training
    # at all (true zero-day / unknown-threat simulation).
    train_labels = set(train_df["label"].unique())
    test_df = test_df.copy()
    test_df["is_novel_attack_type"] = (
        (test_df["is_anomaly"] == 1) & (~test_df["label"].isin(train_labels))
    )
    novel_mask = test_df["is_novel_attack_type"].values
    novel_labels_seen = sorted(test_df.loc[novel_mask, "label"].unique().tolist())
    if novel_mask.sum() > 0:
        recall_novel = float(y_pred[novel_mask].mean())
    else:
        recall_novel = None
    print(f"\nNovel attack types never seen in training ({int(novel_mask.sum())} test rows, "
          f"types={novel_labels_seen}):")
    print(f"  Recall on completely unseen attack types: {recall_novel:.4f}" if recall_novel is not None else "  n/a")

    # ------------------------------------------------------------------
    # 6. Plots
    # ------------------------------------------------------------------
    _plot_score_distribution(test_scores, y_true, operating_threshold, REPORT_DIR / "score_distribution.png")
    _plot_roc_curve(y_true, anomaly_likelihood, roc_auc, REPORT_DIR / "roc_curve.png")
    _plot_confusion_matrix(cm, REPORT_DIR / "confusion_matrix.png")
    _plot_recall_by_category(recall_by_category, recall_novel, REPORT_DIR / "recall_by_attack_family.png")

    # ------------------------------------------------------------------
    # 7. Save artifacts
    # ------------------------------------------------------------------
    joblib.dump(preprocessor, MODEL_DIR / "preprocessor.joblib")
    joblib.dump(model, MODEL_DIR / "isolation_forest.joblib")

    reason_explainer = ReasonCodeExplainer().fit(fit_normal_df)
    joblib.dump(reason_explainer, MODEL_DIR / "reason_explainer.joblib")

    metadata = {
        "model_type": "IsolationForest",
        "sklearn_training": "semi-supervised (trained on NORMAL traffic only)",
        "dataset": "NSL-KDD (Canadian Institute for Cybersecurity)",
        "n_estimators": model.n_estimators,
        "random_state": RANDOM_STATE,
        "feature_count": int(X_fit.shape[1]),
        "feature_names": feature_names,
        "operating_threshold": operating_threshold,
        "target_fpr": TARGET_FPR,
        "threshold_table": threshold_table,
        "risk_score_calibration": {"score_low": score_low, "score_high": score_high},
        "test_metrics": {
            "accuracy": accuracy,
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "roc_auc": roc_auc,
            "pr_auc": pr_auc,
            "confusion_matrix": cm.tolist(),
            "recall_by_attack_family": recall_by_category,
            "recall_on_novel_unseen_attack_types": recall_novel,
            "novel_attack_types_in_test_set": novel_labels_seen,
        },
        "threshold_sweep": sweep_rows,
        "training_rows_used": int(len(fit_normal_df)),
        "calibration_rows_used": int(len(calib_normal_df)),
    }
    with open(MODEL_DIR / "metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)
    with open(REPORT_DIR / "metrics.json", "w") as f:
        json.dump(metadata["test_metrics"], f, indent=2)

    print(f"\nArtifacts saved to: {MODEL_DIR}")
    print(f"Report/plots saved to: {REPORT_DIR}")
    print(f"Done in {time.time() - t0:.1f}s")


def _plot_score_distribution(scores, y_true, threshold, path):
    plt.figure(figsize=(8, 5))
    plt.hist(scores[y_true == 0], bins=60, alpha=0.6, label="Normal traffic", color="#2E7D32")
    plt.hist(scores[y_true == 1], bins=60, alpha=0.6, label="Attack traffic", color="#C62828")
    plt.axvline(threshold, color="black", linestyle="--", label=f"Operating threshold ({threshold:.2f})")
    plt.xlabel("Isolation Forest decision_function score (higher = more normal)")
    plt.ylabel("Count")
    plt.title("AegisSOC Anomaly Detector — Score Distribution (NSL-KDD test set)")
    plt.legend()
    plt.tight_layout()
    plt.savefig(path, dpi=140)
    plt.close()


def _plot_roc_curve(y_true, anomaly_likelihood, roc_auc, path):
    fpr, tpr, _ = roc_curve(y_true, anomaly_likelihood)
    plt.figure(figsize=(6, 6))
    plt.plot(fpr, tpr, color="#1565C0", label=f"ROC curve (AUC = {roc_auc:.3f})")
    plt.plot([0, 1], [0, 1], color="grey", linestyle="--")
    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate")
    plt.title("AegisSOC Anomaly Detector — ROC Curve")
    plt.legend()
    plt.tight_layout()
    plt.savefig(path, dpi=140)
    plt.close()


def _plot_confusion_matrix(cm, path):
    plt.figure(figsize=(5, 4.5))
    plt.imshow(cm, cmap="Blues")
    labels = ["Normal", "Attack"]
    plt.xticks([0, 1], labels)
    plt.yticks([0, 1], labels)
    for i in range(2):
        for j in range(2):
            plt.text(j, i, str(cm[i, j]), ha="center", va="center",
                      color="white" if cm[i, j] > cm.max() / 2 else "black", fontsize=13)
    plt.xlabel("Predicted")
    plt.ylabel("Actual")
    plt.title("Confusion Matrix @ operating threshold")
    plt.colorbar(fraction=0.046, pad=0.04)
    plt.tight_layout()
    plt.savefig(path, dpi=140)
    plt.close()


def _plot_recall_by_category(recall_by_category, recall_novel, path):
    cats = list(recall_by_category.keys())
    vals = [recall_by_category[c] for c in cats]
    if recall_novel is not None:
        cats.append("novel\n(unseen types)")
        vals.append(recall_novel)
    plt.figure(figsize=(7, 5))
    colors = ["#F9A825"] * (len(vals) - 1) + (["#6A1B9A"] if recall_novel is not None else [])
    plt.bar(cats, vals, color=colors)
    plt.ylim(0, 1)
    plt.ylabel("Recall (detection rate)")
    plt.title("Detection Rate by Attack Family")
    for i, v in enumerate(vals):
        plt.text(i, v + 0.02, f"{v:.2f}", ha="center")
    plt.tight_layout()
    plt.savefig(path, dpi=140)
    plt.close()


if __name__ == "__main__":
    main()
