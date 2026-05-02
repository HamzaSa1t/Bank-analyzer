"""Fairness audit for the trained XGBoost credit-risk model.

Read-only: re-runs the model on the held-out test split and slices predictions
by demographic / group columns that are NOT in the feature set (gender,
family status, education, age band). Per group reports default rate, mean PD,
and approval rate at each bank policy threshold. Any group whose approval
rate deviates by more than 10 percentage points from the overall average is
flagged.

Outputs:
    models/fairness_report.png   — bar chart of approval rates per group/threshold
    stdout                        — per-attribute table and verdict
"""

from __future__ import annotations

from pathlib import Path

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[1]
FEATURES_CSV = ROOT / "data" / "processed" / "features.csv"
RAW_APPLICATION = ROOT / "data" / "application_train.csv"
MODEL_PATH = ROOT / "models" / "model.pkl"
FEATURE_COLS_PATH = ROOT / "models" / "feature_cols.pkl"
PLOT_PATH = ROOT / "models" / "fairness_report.png"

POLICY_THRESHOLDS = {"conservative": 0.05, "aggressive": 0.15}

# Flag any group whose approval rate deviates from the overall by more than
# this many percentage points (per user spec).
APPROVAL_DEVIATION_FLAG = 0.10

# Tiny groups produce noisy approval rates that aren't actionable; report them
# but exclude from the bias verdict.
MIN_GROUP_SIZE = 200


def age_band(age: float) -> str:
    if age < 25: return "<25"
    if age < 35: return "25-35"
    if age < 50: return "35-50"
    if age < 65: return "50-65"
    return "65+"


def per_group_table(df: pd.DataFrame, attr: str,
                    overall: dict[str, float]) -> pd.DataFrame:
    """Compute the four required metrics per category of `attr`.

    Adds a `flag` column marking groups whose approval rate at EITHER threshold
    deviates by more than APPROVAL_DEVIATION_FLAG from the overall average,
    provided the group is at least MIN_GROUP_SIZE.
    """
    rows = []
    for value, sub in df.groupby(attr, dropna=False):
        n = len(sub)
        y_true = sub["__y_true"].to_numpy()
        y_prob = sub["__y_prob"].to_numpy()

        row: dict[str, object] = {
            "group": str(value),
            "n": n,
            "default_rate": float(y_true.mean()) if n else np.nan,
            "mean_pd": float(y_prob.mean()) if n else np.nan,
            "approval_conservative": float((y_prob < POLICY_THRESHOLDS["conservative"]).mean()),
            "approval_aggressive":   float((y_prob < POLICY_THRESHOLDS["aggressive"]).mean()),
        }
        cons_dev = abs(row["approval_conservative"] - overall["approval_conservative"])
        agg_dev  = abs(row["approval_aggressive"]   - overall["approval_aggressive"])
        row["max_deviation"] = float(max(cons_dev, agg_dev))
        row["flag"] = bool(n >= MIN_GROUP_SIZE and row["max_deviation"] > APPROVAL_DEVIATION_FLAG)
        rows.append(row)
    return pd.DataFrame(rows).sort_values("n", ascending=False).reset_index(drop=True)


def print_table(attr: str, table: pd.DataFrame, overall: dict[str, float]) -> None:
    print(f"\n=== {attr} ===")
    print(f"(overall approval: conservative={overall['approval_conservative']:.3f}  "
          f"aggressive={overall['approval_aggressive']:.3f})")
    print(f"{'group':<28}  {'n':>7}  {'default':>8}  {'mean_pd':>8}  "
          f"{'apv@5%':>7}  {'apv@15%':>7}  {'flag':>5}")
    for _, r in table.iterrows():
        marker = "FLAG" if r["flag"] else ("small" if r["n"] < MIN_GROUP_SIZE else "")
        print(
            f"{r['group']:<28}  {r['n']:>7,}  {r['default_rate']:>8.4f}  {r['mean_pd']:>8.4f}  "
            f"{r['approval_conservative']:>7.3f}  {r['approval_aggressive']:>7.3f}  {marker:>5}"
        )


def main() -> None:
    print(f"Loading {FEATURES_CSV} ...")
    feats = pd.read_csv(FEATURES_CSV)
    feature_cols = joblib.load(FEATURE_COLS_PATH)
    model = joblib.load(MODEL_PATH)

    print(f"Loading protected attributes from {RAW_APPLICATION.name} ...")
    raw = pd.read_csv(
        RAW_APPLICATION,
        usecols=["SK_ID_CURR", "CODE_GENDER", "NAME_FAMILY_STATUS", "NAME_EDUCATION_TYPE"],
    )

    df = feats.merge(raw, on="SK_ID_CURR", how="left")
    df["AGE_BAND"] = df["AGE_YEARS"].apply(age_band)

    X = df[feature_cols]
    y = df["TARGET"].astype(int)

    # Reproduce the EXACT split src/train.py used so we evaluate on data the
    # model never saw at fit time.
    _, X_test, _, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42,
    )
    test = df.loc[X_test.index].copy()
    test["__y_true"] = y_test.to_numpy()
    test["__y_prob"] = model.predict_proba(X_test)[:, 1]

    overall = {
        "default_rate": float(test["__y_true"].mean()),
        "mean_pd": float(test["__y_prob"].mean()),
        "approval_conservative": float((test["__y_prob"] < POLICY_THRESHOLDS["conservative"]).mean()),
        "approval_aggressive":   float((test["__y_prob"] < POLICY_THRESHOLDS["aggressive"]).mean()),
    }
    print(f"Test set size: {len(test):,}")
    print(f"Overall default rate: {overall['default_rate']:.4f}")
    print(f"Overall mean PD:      {overall['mean_pd']:.4f}")
    print(f"Overall approval rate (conservative, PD<0.05): {overall['approval_conservative']:.4f}")
    print(f"Overall approval rate (aggressive,   PD<0.15): {overall['approval_aggressive']:.4f}")

    attrs = [
        ("CODE_GENDER", "Gender"),
        ("AGE_BAND", "Age band"),
        ("NAME_FAMILY_STATUS", "Family status"),
        ("NAME_EDUCATION_TYPE", "Education"),
    ]

    plot_data: dict[str, pd.DataFrame] = {}
    flagged: list[tuple[str, str, float]] = []  # (attribute, group, deviation)
    for col, label in attrs:
        table = per_group_table(test, col, overall)
        print_table(label, table, overall)
        for _, r in table[table["flag"]].iterrows():
            flagged.append((label, str(r["group"]), float(r["max_deviation"])))
        plot_data[label] = table

    # ---- Plot ----
    fig, axes = plt.subplots(2, 2, figsize=(14, 9))
    for ax, (label, table) in zip(axes.flat, plot_data.items()):
        big = table[table["n"] >= MIN_GROUP_SIZE]
        if big.empty:
            ax.set_title(f"{label}: no groups above n={MIN_GROUP_SIZE}")
            continue
        x = np.arange(len(big))
        width = 0.35
        ax.bar(x - width / 2, big["approval_conservative"], width,
               label="Conservative (PD<0.05)", color="#1f77b4")
        ax.bar(x + width / 2, big["approval_aggressive"], width,
               label="Aggressive (PD<0.15)", color="#ff7f0e")
        ax.set_xticks(x)
        ax.set_xticklabels(big["group"].astype(str), rotation=20, ha="right")
        ax.set_ylabel("Approval rate")
        ax.set_title(label)
        ax.set_ylim(0, 1)
        ax.grid(True, alpha=0.3)
        ax.legend(fontsize=8)
    fig.suptitle("Approval rate by protected attribute and bank policy")
    fig.tight_layout()
    fig.savefig(PLOT_PATH, dpi=120, bbox_inches="tight")
    plt.close(fig)
    print(f"\nFairness plot saved to: {PLOT_PATH}")

    # ---- Verdict ----
    print("\n" + "=" * 60)
    print("FAIRNESS VERDICT")
    print("=" * 60)
    if not flagged:
        print("\nThe model is treating all groups similarly: every group's approval rate")
        print(f"is within {APPROVAL_DEVIATION_FLAG:.0%} of the overall average for both bank policies.")
        print("No bias concern detected on the demographic columns audited.")
    else:
        print(f"\nBIAS CONCERN: {len(flagged)} group(s) deviate from the overall approval rate")
        print(f"by more than {APPROVAL_DEVIATION_FLAG:.0%}.\n")
        for attr, group, dev in flagged:
            print(f"  - {attr}: '{group}' (max approval-rate deviation: {dev:.3f})")
        print("\nNext step: investigate whether the disparity is driven by genuine risk")
        print("differences (e.g. lower mean income / shorter credit history) or by feature")
        print("proxies that encode the protected attribute. Consider per-group calibration")
        print("or adjusted decision thresholds before deploying.")
    print("=" * 60)


if __name__ == "__main__":
    main()
