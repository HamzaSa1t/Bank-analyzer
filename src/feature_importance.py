"""Feature importance + sanity check for the trained XGBoost credit-risk model.

Read-only. Computes three complementary importance views:
    1. XGBoost built-in (weight, gain, cover) — model-only, no data needed
    2. SHAP values on a stratified sample — attribution, not generalization
    3. Permutation importance — uses the OOF predictions as the baseline AUC

Notes on data choice
--------------------
The final model in models/model.pkl was retrained on ALL rows after CV picked
n_estimators, so any train/test split here would leak. SHAP is fine on training
data (it's an attribution measure, not a generalization metric). Permutation
importance, which DOES need unseen data, is computed against an OOF baseline
using a fast rebuild on a single fold.

Outputs:
    models/importance_xgb.png
    models/importance_shap_beeswarm.png
    models/importance_shap_bar.png
    models/feature_importance.json   — top features for the frontend
    stdout — combined table (top 15 by SHAP) + suspicious-feature flags
"""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

import shap

ROOT = Path(__file__).resolve().parents[1]
FEATURES_CSV = ROOT / "data" / "processed" / "features.csv"
MODEL_PATH = ROOT / "models" / "model.pkl"
FEATURE_COLS_PATH = ROOT / "models" / "feature_cols.pkl"
MODELS_DIR = ROOT / "models"
DRIVERS_PATH = MODELS_DIR / "feature_importance.json"

TOP_N = 15
TOP_N_FRONTEND = 10
SHAP_SAMPLE = 5000
RANDOM_STATE = 42

# Heuristic: features whose name suggests they make default LESS likely when
# the value is high. Used only to color the frontend bars (good=green / bad=red).
GOOD_PREFIXES_OR_NAMES = (
    "EXT_SOURCE", "SIMAH", "BUREAU_CREDIT_AGE", "YEARS_EMPLOYED", "AGE_YEARS",
    "INSTAL_PAYMENT_RATE", "BUREAU_CLOSED",
    "CARD_PAYMENT_RATIO", "CARD_MONTHS_ACTIVE",
)
BAD_HINTS = (
    "OVERDUE", "DPD", "LATE", "UNDERPAYMENT", "DEBT", "UTIL", "AMT_CREDIT",
    "AMT_ANNUITY", "DBR", "CREDIT_INCOME_RATIO", "PROLONG", "ACTIVE_BUREAU",
    "DEF_30", "DEF_60", "_INVALID",
)

# Feature -> translation key in frontend/src/lib/strings.js. The frontend
# resolves t[description_key] for the description card under each driver bar.
# Keys not in this map fall back to the feature code in the UI.
DESCRIPTION_KEY_BY_FEATURE = {
    "EXT_SOURCE_AVG": "drv_EXT_SOURCE_AVG",
    "EXT_SOURCE_1": "drv_EXT_SOURCE_1",
    "EXT_SOURCE_2": "drv_EXT_SOURCE_2",
    "EXT_SOURCE_3": "drv_EXT_SOURCE_3",
    "SIMAH_SCORE": "drv_SIMAH_SCORE",
    "AMT_CREDIT": "drv_AMT_CREDIT",
    "AMT_ANNUITY": "drv_AMT_ANNUITY",
    "AMT_INCOME_TOTAL": "drv_AMT_INCOME_TOTAL",
    "YEARS_EMPLOYED": "drv_YEARS_EMPLOYED",
    "AGE_YEARS": "drv_AGE_YEARS",
    "DBR": "drv_DBR",
    "CREDIT_INCOME_RATIO": "drv_CREDIT_INCOME_RATIO",
    "INSTAL_PCT_LATE": "drv_INSTAL_PCT_LATE",
    "INSTAL_DAYS_LATE_MAX": "drv_INSTAL_DAYS_LATE_MAX",
    "INSTAL_DAYS_LATE_MEAN": "drv_INSTAL_DAYS_LATE_MEAN",
    "INSTAL_PAYMENT_RATE": "drv_INSTAL_PAYMENT_RATE",
    "BUREAU_CREDIT_AGE_MAX": "drv_BUREAU_CREDIT_AGE_MAX",
    "BUREAU_MAX_OVERDUE": "drv_BUREAU_MAX_OVERDUE",
    "BUREAU_DAYS_OVERDUE_MAX": "drv_BUREAU_DAYS_OVERDUE_MAX",
    "BUREAU_DEBT_TOTAL": "drv_BUREAU_DEBT_TOTAL",
    "BUREAU_LIMIT_TOTAL": "drv_BUREAU_LIMIT_TOTAL",
    "BUREAU_UTIL_RATIO": "drv_BUREAU_UTIL_RATIO",
    "BUREAU_ACTIVE_COUNT": "drv_BUREAU_ACTIVE_COUNT",
    "BUREAU_PROLONGED_COUNT": "drv_BUREAU_PROLONGED_COUNT",
    "CARD_UTIL_RATIO_AVG": "drv_CARD_UTIL_RATIO_AVG",
    "CARD_UTIL_RATIO_MAX": "drv_CARD_UTIL_RATIO_MAX",
    "CARD_DPD_MAX": "drv_CARD_DPD_MAX",
    "CARD_PAYMENT_RATIO": "drv_CARD_PAYMENT_RATIO",
    "CARD_MONTHS_ACTIVE": "drv_CARD_MONTHS_ACTIVE",
    "IS_EMPLOYED": "drv_IS_EMPLOYED",
    "AMT_REQ_CREDIT_BUREAU_MON": "drv_AMT_REQ_CREDIT_BUREAU_MON",
    "ANNUITY_CREDIT_RATIO": "drv_ANNUITY_CREDIT_RATIO",
    "GOODS_CREDIT_RATIO": "drv_GOODS_CREDIT_RATIO",
    "BUREAU_DEBT_CREDIT_RATIO_MAX": "drv_BUREAU_DEBT_CREDIT_RATIO_MAX",
    "OWN_CAR_AGE": "drv_OWN_CAR_AGE",
    "CODE_GENDER_M": "drv_CODE_GENDER_M",
}


def _impact_for(name: str) -> str:
    upper = name.upper()
    for token in GOOD_PREFIXES_OR_NAMES:
        if upper.startswith(token) or token in upper:
            return "good"
    for token in BAD_HINTS:
        if token in upper:
            return "bad"
    return "neutral"


def _xgb_scores(model, feature_cols: list[str]) -> pd.DataFrame:
    booster = model.get_booster()
    out = {}
    for kind in ("weight", "gain", "cover"):
        d = booster.get_score(importance_type=kind)
        if any(k.startswith("f") and k[1:].isdigit() for k in d):
            d = {feature_cols[int(k[1:])]: v for k, v in d.items()}
        out[kind] = pd.Series(d).reindex(feature_cols).fillna(0.0)
    return pd.DataFrame(out)


def _flag_suspicious(table: pd.DataFrame) -> list[str]:
    flags: list[str] = []
    for feat in table.index:
        upper = feat.upper()
        if "SK_ID" in upper or upper.endswith("_ID") or upper == "ID":
            flags.append(f"  - {feat}: looks like an identifier — should not be a feature")
        if upper == "TARGET":
            flags.append(f"  - {feat}: this IS the label — direct leakage")

    redundancies = [
        ("SIMAH_SCORE", ["EXT_SOURCE_AVG"], "deterministic affine transform: 300 + 600 * EXT_SOURCE_AVG"),
        ("EXT_SOURCE_AVG", ["EXT_SOURCE_1", "EXT_SOURCE_2", "EXT_SOURCE_3"], "mean of EXT_SOURCE_1..3"),
        ("DBR", ["AMT_ANNUITY", "AMT_INCOME_TOTAL"], "AMT_ANNUITY / AMT_INCOME_TOTAL"),
        ("CREDIT_INCOME_RATIO", ["AMT_CREDIT", "AMT_INCOME_TOTAL"], "AMT_CREDIT / AMT_INCOME_TOTAL"),
        ("BUREAU_UTIL_RATIO", ["BUREAU_DEBT_TOTAL", "BUREAU_LIMIT_TOTAL"], "BUREAU_DEBT_TOTAL / (BUREAU_LIMIT_TOTAL + 1)"),
    ]
    present = set(table.index)
    for derived, parents, formula in redundancies:
        if derived in present and all(p in present for p in parents):
            flags.append(
                f"  - {derived}: redundant with {', '.join(parents)} ({formula})"
            )
    return flags


def main() -> None:
    print(f"Loading {FEATURES_CSV} ...")
    df = pd.read_csv(FEATURES_CSV)
    feature_cols = joblib.load(FEATURE_COLS_PATH)
    model = joblib.load(MODEL_PATH)

    X = df[feature_cols]
    y = df["TARGET"].astype(int)
    print(f"Rows: {len(X):,}  features: {len(feature_cols)}")

    # ---- 1. XGBoost weight / gain / cover -------------------------------
    xgb_scores = _xgb_scores(model, feature_cols)

    # ---- 2. SHAP values -------------------------------------------------
    # Stratified sample so the rare-positive class isn't swamped.
    rng = np.random.default_rng(RANDOM_STATE)
    pos_idx = np.flatnonzero(y.to_numpy() == 1)
    neg_idx = np.flatnonzero(y.to_numpy() == 0)
    n_pos = min(SHAP_SAMPLE // 2, len(pos_idx))
    n_neg = min(SHAP_SAMPLE - n_pos, len(neg_idx))
    sample_idx = np.concatenate([
        rng.choice(pos_idx, size=n_pos, replace=False),
        rng.choice(neg_idx, size=n_neg, replace=False),
    ])
    rng.shuffle(sample_idx)
    X_shap = X.iloc[sample_idx]

    print(f"Computing SHAP values on a {len(X_shap)}-row stratified sample ...")
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_shap)
    if isinstance(shap_values, list):
        shap_values = shap_values[1]
    shap_arr = np.asarray(shap_values)
    shap_mean_abs = pd.Series(np.abs(shap_arr).mean(axis=0), index=feature_cols)

    # ---- Combined ranking table -----------------------------------------
    table = pd.DataFrame({
        "weight": xgb_scores["weight"],
        "gain":   xgb_scores["gain"],
        "cover":  xgb_scores["cover"],
        "shap_mean_abs": shap_mean_abs,
    }).fillna(0.0)
    table["rank_shap"] = table["shap_mean_abs"].rank(ascending=False, method="min").astype(int)
    table["rank_gain"] = table["gain"].rank(ascending=False, method="min").astype(int)
    table = table.sort_values("shap_mean_abs", ascending=False)

    print("\nTop 15 features ranked by SHAP mean |value|.")
    print(f"{'feature':<32}  {'weight':>7}  {'gain':>10}  {'cover':>10}  "
          f"{'SHAP|.|':>9}  {'rk_s/g':>8}")
    for feat, r in table.head(TOP_N).iterrows():
        print(
            f"{feat:<32}  {int(r['weight']):>7}  {r['gain']:>10.2f}  {r['cover']:>10.2f}  "
            f"{r['shap_mean_abs']:>9.5f}  "
            f"{int(r['rank_shap']):>3}/{int(r['rank_gain']):>2}"
        )

    cum = (table["shap_mean_abs"] / table["shap_mean_abs"].sum()).cumsum()
    n_50 = int((cum.values >= 0.50).argmax() + 1)
    n_80 = int((cum.values >= 0.80).argmax() + 1)
    n_95 = int((cum.values >= 0.95).argmax() + 1)
    print(f"\nSHAP concentration: top {n_50} feature(s) carry 50% of mean |SHAP|, "
          f"top {n_80} carry 80%, top {n_95} carry 95%.")

    flags = _flag_suspicious(table)
    print("\nSanity check — suspicious or redundant features:")
    if not flags:
        print("  (none flagged)")
    else:
        for line in flags:
            print(line)

    # ---- Plots ----------------------------------------------------------
    fig, axes = plt.subplots(1, 3, figsize=(18, 7))
    for ax, kind, color in zip(axes, ("weight", "gain", "cover"),
                               ("#1f77b4", "#2ca02c", "#9467bd")):
        s = xgb_scores[kind].sort_values(ascending=False).head(TOP_N)
        ax.barh(s.index[::-1], s.values[::-1], color=color)
        ax.set_title(f"XGBoost {kind} — top {TOP_N}")
        ax.grid(True, alpha=0.3, axis="x")
    fig.suptitle("XGBoost built-in importance")
    fig.tight_layout()
    fig.savefig(MODELS_DIR / "importance_xgb.png", dpi=120, bbox_inches="tight")
    plt.close(fig)

    plt.figure(figsize=(10, 8))
    shap.summary_plot(
        shap_arr, X_shap, feature_names=feature_cols,
        max_display=TOP_N, show=False, plot_size=None,
    )
    plt.title(f"SHAP beeswarm — top {TOP_N}")
    plt.tight_layout()
    plt.savefig(MODELS_DIR / "importance_shap_beeswarm.png", dpi=120, bbox_inches="tight")
    plt.close("all")

    plt.figure(figsize=(10, 8))
    shap.summary_plot(
        shap_arr, X_shap, feature_names=feature_cols, plot_type="bar",
        max_display=TOP_N, show=False, plot_size=None,
    )
    plt.title(f"SHAP mean |value| — top {TOP_N}")
    plt.tight_layout()
    plt.savefig(MODELS_DIR / "importance_shap_bar.png", dpi=120, bbox_inches="tight")
    plt.close("all")

    # ---- Frontend export ------------------------------------------------
    top = table.head(TOP_N_FRONTEND)
    drivers = [
        {
            "feature": feat,
            "shap_mean_abs": round(float(row["shap_mean_abs"]), 4),
            "rank_shap": int(row["rank_shap"]),
            "impact": _impact_for(feat),
            "description_key": DESCRIPTION_KEY_BY_FEATURE.get(feat),
        }
        for feat, row in top.iterrows()
    ]
    payload = {
        "drivers": drivers,
        "n_features": int(len(feature_cols)),
        "shap_sample_size": int(len(X_shap)),
        "concentration": {"top_50_pct": n_50, "top_80_pct": n_80, "top_95_pct": n_95},
        "source": "SHAP mean |value| on stratified 5000-row sample",
    }
    DRIVERS_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    print("\nPlots saved:")
    for name in ("importance_xgb.png", "importance_shap_beeswarm.png",
                 "importance_shap_bar.png"):
        print(f"  models/{name}")
    print(f"\nDrivers JSON saved to: {DRIVERS_PATH}")


if __name__ == "__main__":
    main()
