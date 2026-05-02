"""Calibration check for the trained XGBoost credit-risk model.

Read-only: loads model.pkl + features.csv, reproduces the same train/test split
as src/train.py, and evaluates calibration on the held-out test set.

Outputs:
    models/calibration_curve.png   — reliability diagram (10 equal-width bins)
    stdout                          — Brier score, per-bucket table, verdict
"""

from __future__ import annotations

from pathlib import Path

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from sklearn.metrics import brier_score_loss
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[1]
FEATURES_CSV = ROOT / "data" / "processed" / "features.csv"
MODEL_PATH = ROOT / "models" / "model.pkl"
FEATURE_COLS_PATH = ROOT / "models" / "feature_cols.pkl"
PLOT_PATH = ROOT / "models" / "calibration_curve.png"

N_BINS = 10


def main() -> None:
    print(f"Loading {FEATURES_CSV} ...")
    df = pd.read_csv(FEATURES_CSV)
    feature_cols = joblib.load(FEATURE_COLS_PATH)
    model = joblib.load(MODEL_PATH)

    X = df[feature_cols]
    y = df["TARGET"].astype(int)

    # Reproduce the EXACT split src/train.py used so we evaluate on data the
    # model never saw at fit time (random_state=42, stratify=y, test_size=0.2).
    _, X_test, _, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42,
    )
    y_true = y_test.to_numpy()
    y_prob = model.predict_proba(X_test)[:, 1]

    print(f"Test set size: {len(y_true):,}")
    print(f"Empirical default rate: {y_true.mean():.4f}")
    print(f"Mean predicted PD:      {y_prob.mean():.4f}")

    # Brier score: mean squared error between predicted prob and actual outcome.
    # Lower is better; 0 is perfect, 0.25 is the "always 0.5" baseline.
    brier = brier_score_loss(y_true, y_prob)
    print(f"\nBrier score: {brier:.6f}")

    # Equal-width buckets across [0, 1]. We use 10 bins for legibility; ECE is
    # the bucket-size-weighted mean absolute calibration gap.
    bin_edges = np.linspace(0.0, 1.0, N_BINS + 1)
    bin_idx = np.clip(np.digitize(y_prob, bin_edges, right=True) - 1, 0, N_BINS - 1)

    rows = []
    weighted_abs_err = 0.0
    for b in range(N_BINS):
        mask = bin_idx == b
        n = int(mask.sum())
        if n == 0:
            rows.append((b, bin_edges[b], bin_edges[b + 1], 0, np.nan, np.nan, np.nan))
            continue
        mean_pred = float(y_prob[mask].mean())
        actual_rate = float(y_true[mask].mean())
        gap = actual_rate - mean_pred
        weighted_abs_err += (n / len(y_true)) * abs(gap)
        rows.append((b, bin_edges[b], bin_edges[b + 1], n, mean_pred, actual_rate, gap))

    print(f"\nReliability table ({N_BINS} equal-width bins):")
    print(f"{'bin':>3}  {'range':>12}  {'count':>7}  {'pred_PD':>8}  {'actual':>8}  {'gap':>8}")
    for b, lo, hi, n, mp, ar, gap in rows:
        if n == 0:
            print(f"{b:>3}  [{lo:.2f}, {hi:.2f}]  {n:>7}  {'-':>8}  {'-':>8}  {'-':>8}")
        else:
            print(f"{b:>3}  [{lo:.2f}, {hi:.2f}]  {n:>7,}  {mp:>8.4f}  {ar:>8.4f}  {gap:>+8.4f}")

    print(f"\nExpected Calibration Error (ECE, weighted by bin count): {weighted_abs_err:.4f}")

    # Verdict — credit-risk-friendly thresholds. Brier is informative but ECE
    # is the direct "are predicted PDs trustworthy as PDs?" measure.
    if weighted_abs_err < 0.02:
        verdict = "WELL CALIBRATED"
        explanation = "Predicted PDs match observed default rates to within 2%."
    elif weighted_abs_err < 0.05:
        verdict = "ACCEPTABLY CALIBRATED"
        explanation = "Predicted PDs are usable as decision inputs; small drift in some buckets."
    elif weighted_abs_err < 0.10:
        verdict = "MODERATELY MISCALIBRATED"
        explanation = "PDs systematically off in some buckets; consider Platt/isotonic recalibration."
    else:
        verdict = "POORLY CALIBRATED"
        explanation = "PDs do not reflect true default probabilities; recalibrate before using thresholds."

    # Reliability diagram — predicted vs. actual per bin, with the diagonal as
    # the perfectly-calibrated reference. Also overlay the count-weighted bars
    # along the bottom so the reader sees where the data actually sits.
    valid = [(mp, ar, n) for _, _, _, n, mp, ar, _ in rows if n > 0]
    pred_vals = np.array([r[0] for r in valid])
    actual_vals = np.array([r[1] for r in valid])
    counts = np.array([r[2] for r in valid])

    fig, ax = plt.subplots(figsize=(7, 6))
    ax.plot([0, 1], [0, 1], "k--", linewidth=1, label="Perfect calibration")
    ax.plot(pred_vals, actual_vals, "o-", color="#1f77b4", label="Model")
    ax2 = ax.twinx()
    ax2.bar(pred_vals, counts, width=0.06, alpha=0.15, color="#1f77b4", label="Bin count")
    ax2.set_ylabel("Bin count")
    ax2.set_yscale("log")
    ax.set_xlabel("Predicted PD (bin mean)")
    ax.set_ylabel("Empirical default rate")
    ax.set_xlim(0, max(0.5, pred_vals.max() + 0.05))
    ax.set_ylim(0, max(0.5, actual_vals.max() + 0.05))
    ax.set_title(f"Reliability diagram — Brier={brier:.4f}, ECE={weighted_abs_err:.4f}")
    ax.grid(True, alpha=0.3)
    ax.legend(loc="upper left")
    fig.tight_layout()
    fig.savefig(PLOT_PATH, dpi=120, bbox_inches="tight")
    plt.close(fig)

    print(f"\nReliability diagram saved to: {PLOT_PATH}")
    print(f"\nVerdict: {verdict}")
    print(explanation)


if __name__ == "__main__":
    main()
