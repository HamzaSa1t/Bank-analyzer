"""Calibration check on out-of-fold (OOF) predictions.

Read-only. Loads models/oof_predictions.csv produced by src/train.py — every
row's PD comes from a model that never trained on it, so the reliability
table is unbiased.

Outputs:
    models/calibration_curve.png    — reliability diagram (10 equal-width bins)
    models/calibration_buckets.json — bucket table for the frontend
    stdout                           — Brier score, per-bucket table, verdict
"""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from sklearn.metrics import brier_score_loss

ROOT = Path(__file__).resolve().parents[1]
OOF_PATH = ROOT / "models" / "oof_predictions.csv"
PLOT_PATH = ROOT / "models" / "calibration_curve.png"
BUCKETS_PATH = ROOT / "models" / "calibration_buckets.json"

N_BINS = 10


def main() -> None:
    if not OOF_PATH.exists():
        raise SystemExit(
            f"{OOF_PATH} not found. Run `python src/train.py` first — it now "
            "saves OOF predictions for honest downstream evaluation."
        )

    print(f"Loading {OOF_PATH} ...")
    oof = pd.read_csv(OOF_PATH)
    y_true = oof["TARGET"].to_numpy()
    y_prob = oof["PD_OOF"].to_numpy()

    print(f"OOF rows: {len(y_true):,}")
    print(f"Empirical default rate: {y_true.mean():.4f}")
    print(f"Mean predicted PD:      {y_prob.mean():.4f}")

    brier = brier_score_loss(y_true, y_prob)
    print(f"\nBrier score: {brier:.6f}")

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
    ax.set_xlim(0, max(0.5, float(pred_vals.max()) + 0.05))
    ax.set_ylim(0, max(0.5, float(actual_vals.max()) + 0.05))
    ax.set_title(f"Reliability diagram (OOF) — Brier={brier:.4f}, ECE={weighted_abs_err:.4f}")
    ax.grid(True, alpha=0.3)
    ax.legend(loc="upper left")
    fig.tight_layout()
    fig.savefig(PLOT_PATH, dpi=120, bbox_inches="tight")
    plt.close(fig)

    # Frontend-friendly bucket export. Predicted/actual are in PERCENT to match
    # the chart's existing axis. We collapse 60-100% into one tail bucket because
    # default rates are rare there and per-bin counts get noisy.
    front_buckets = []
    tail_count = tail_pred = tail_actual = 0.0
    for b, lo, hi, n, mp, ar, _ in rows:
        if n == 0:
            continue
        if lo >= 0.60:
            tail_count += n
            tail_pred += mp * n
            tail_actual += ar * n
            continue
        front_buckets.append({
            "bucket": f"{int(lo * 100)}–{int(hi * 100)}%",
            "predicted": round(mp * 100, 1),
            "actual": round(ar * 100, 1),
            "count": int(n),
        })
    if tail_count > 0:
        front_buckets.append({
            "bucket": "60%+",
            "predicted": round((tail_pred / tail_count) * 100, 1),
            "actual": round((tail_actual / tail_count) * 100, 1),
            "count": int(tail_count),
        })

    payload = {
        "buckets": front_buckets,
        "brier": round(float(brier), 6),
        "ece": round(float(weighted_abs_err), 6),
        "n_total": int(len(y_true)),
        "verdict": verdict,
        "source": "OOF (5-fold StratifiedKFold)",
    }
    BUCKETS_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    print(f"\nReliability diagram saved to: {PLOT_PATH}")
    print(f"Bucket JSON saved to:         {BUCKETS_PATH}")
    print(f"\nVerdict: {verdict}")
    print(explanation)


if __name__ == "__main__":
    main()
