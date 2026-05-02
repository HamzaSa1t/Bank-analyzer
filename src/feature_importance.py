"""Feature importance + sanity check for the trained XGBoost credit-risk model.

Read-only. Computes three complementary importance views on the held-out test
split, ranks features by SHAP mean |value|, flags suspicious / redundant
features, and saves separate plots per method.

Methods:
    1. XGBoost built-in (weight, gain, cover)
    2. SHAP values (beeswarm + mean-|SHAP| bar)
    3. Permutation importance on test AUC

Outputs:
    models/importance_xgb.png
    models/importance_shap_beeswarm.png
    models/importance_shap_bar.png
    models/importance_permutation.png
    stdout — combined table (top 15 by SHAP) + suspicious-feature flags + verdict
"""

from __future__ import annotations

from pathlib import Path

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

import shap
from sklearn.inspection import permutation_importance
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[1]
FEATURES_CSV = ROOT / "data" / "processed" / "features.csv"
MODEL_PATH = ROOT / "models" / "model.pkl"
FEATURE_COLS_PATH = ROOT / "models" / "feature_cols.pkl"
MODELS_DIR = ROOT / "models"

TOP_N = 15
SHAP_SAMPLE = 5000
PERM_REPEATS = 5
RANDOM_STATE = 42


def _xgb_scores(model, feature_cols: list[str]) -> pd.DataFrame:
    """Return a DataFrame with weight / gain / cover for every feature.

    XGBoost's get_score skips features that were never used as a split, so we
    reindex to the full feature list and fill missing with 0.
    """
    booster = model.get_booster()
    out = {}
    for kind in ("weight", "gain", "cover"):
        d = booster.get_score(importance_type=kind)
        if any(k.startswith("f") and k[1:].isdigit() for k in d):
            d = {feature_cols[int(k[1:])]: v for k, v in d.items()}
        out[kind] = pd.Series(d).reindex(feature_cols).fillna(0.0)
    return pd.DataFrame(out)


def _flag_suspicious(table: pd.DataFrame) -> list[str]:
    """Surface features that look like IDs, target leakage, or pure redundancy."""
    flags: list[str] = []
    for feat in table.index:
        upper = feat.upper()
        if "SK_ID" in upper or upper.endswith("_ID") or upper == "ID":
            flags.append(f"  - {feat}: looks like an identifier — should not be a feature")
        if upper == "TARGET":
            flags.append(f"  - {feat}: this IS the label — direct leakage")

    # Engineered features that are exact deterministic transforms of others —
    # multicollinearity, not leakage. Worth knowing because permutation
    # importance under-counts each member of a redundant group.
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

    _, X_test, _, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE,
    )
    print(f"Test set size: {len(X_test):,}, features: {len(feature_cols)}")

    # ---- 1. XGBoost weight / gain / cover -------------------------------
    xgb_scores = _xgb_scores(model, feature_cols)

    # ---- 2. SHAP values -------------------------------------------------
    print(f"Computing SHAP values on a {SHAP_SAMPLE}-row sample ...")
    rng = np.random.default_rng(RANDOM_STATE)
    sample_idx = rng.choice(len(X_test), size=min(SHAP_SAMPLE, len(X_test)), replace=False)
    X_shap = X_test.iloc[sample_idx]
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_shap)
    if isinstance(shap_values, list):
        shap_values = shap_values[1]
    shap_arr = np.asarray(shap_values)
    shap_mean_abs = pd.Series(np.abs(shap_arr).mean(axis=0), index=feature_cols)

    # ---- 3. Permutation importance --------------------------------------
    print(f"Running permutation importance ({PERM_REPEATS} repeats) ...")
    perm = permutation_importance(
        model, X_test, y_test,
        scoring="roc_auc",
        n_repeats=PERM_REPEATS,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    perm_mean = pd.Series(perm.importances_mean, index=feature_cols)

    baseline_auc = roc_auc_score(y_test, model.predict_proba(X_test)[:, 1])

    # ---- Combined ranking table -----------------------------------------
    table = pd.DataFrame({
        "weight": xgb_scores["weight"],
        "gain":   xgb_scores["gain"],
        "cover":  xgb_scores["cover"],
        "shap_mean_abs": shap_mean_abs,
        "perm_drop_auc": perm_mean,
    }).fillna(0.0)
    table["rank_shap"] = table["shap_mean_abs"].rank(ascending=False, method="min").astype(int)
    table["rank_gain"] = table["gain"].rank(ascending=False, method="min").astype(int)
    table["rank_perm"] = table["perm_drop_auc"].rank(ascending=False, method="min").astype(int)
    table = table.sort_values("shap_mean_abs", ascending=False)

    # ---- Print top-15-by-SHAP table -------------------------------------
    print(f"\nBaseline test AUC: {baseline_auc:.4f}")
    print("\nTop 15 features ranked by SHAP mean |value|.")
    print("rk_s/g/p = rank by SHAP / XGBoost gain / permutation drop-AUC.\n")
    print(f"{'feature':<28}  {'weight':>7}  {'gain':>10}  {'cover':>10}  "
          f"{'SHAP|.|':>9}  {'perm_dAUC':>10}  {'rk_s/g/p':>10}")
    for feat, r in table.head(TOP_N).iterrows():
        print(
            f"{feat:<28}  {int(r['weight']):>7}  {r['gain']:>10.2f}  {r['cover']:>10.2f}  "
            f"{r['shap_mean_abs']:>9.5f}  {r['perm_drop_auc']:>+10.5f}  "
            f"{int(r['rank_shap']):>3}/{int(r['rank_gain']):>2}/{int(r['rank_perm']):>2}"
        )

    # ---- Concentration ---------------------------------------------------
    cum = (table["shap_mean_abs"] / table["shap_mean_abs"].sum()).cumsum()
    n_50 = int((cum.values >= 0.50).argmax() + 1)
    n_80 = int((cum.values >= 0.80).argmax() + 1)
    n_95 = int((cum.values >= 0.95).argmax() + 1)
    print(f"\nSHAP concentration: top {n_50} feature(s) carry 50% of mean |SHAP|, "
          f"top {n_80} carry 80%, top {n_95} carry 95%.")

    # ---- Suspicious / redundant features --------------------------------
    flags = _flag_suspicious(table)
    print("\nSanity check — suspicious or redundant features:")
    if not flags:
        print("  (none flagged)")
    else:
        for line in flags:
            print(line)

    dead = table[
        (table["gain"] == 0)
        & (table["shap_mean_abs"] < 1e-4)
        & (table["perm_drop_auc"].abs() < 1e-4)
    ].index.tolist()
    if dead:
        print(f"\nFeatures with no measurable contribution ({len(dead)}): {', '.join(dead)}")

    # ---- Plots ----------------------------------------------------------
    # 1) XGBoost weight/gain/cover (top-N each), three panels.
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

    # 2) SHAP beeswarm.
    plt.figure(figsize=(10, 8))
    shap.summary_plot(
        shap_arr, X_shap, feature_names=feature_cols,
        max_display=TOP_N, show=False, plot_size=None,
    )
    plt.title(f"SHAP beeswarm — top {TOP_N}")
    plt.tight_layout()
    plt.savefig(MODELS_DIR / "importance_shap_beeswarm.png", dpi=120, bbox_inches="tight")
    plt.close("all")

    # 3) SHAP mean |value| bar.
    plt.figure(figsize=(10, 8))
    shap.summary_plot(
        shap_arr, X_shap, feature_names=feature_cols, plot_type="bar",
        max_display=TOP_N, show=False, plot_size=None,
    )
    plt.title(f"SHAP mean |value| — top {TOP_N}")
    plt.tight_layout()
    plt.savefig(MODELS_DIR / "importance_shap_bar.png", dpi=120, bbox_inches="tight")
    plt.close("all")

    # 4) Permutation drop-AUC.
    fig, ax = plt.subplots(figsize=(10, 8))
    s = table["perm_drop_auc"].sort_values(ascending=False).head(TOP_N)
    err = pd.Series(perm.importances_std, index=feature_cols).reindex(s.index)
    ax.barh(s.index[::-1], s.values[::-1], xerr=err.values[::-1], color="#d62728")
    ax.set_title(f"Permutation drop-AUC — top {TOP_N} (baseline AUC {baseline_auc:.4f})")
    ax.set_xlabel("AUC reduction when feature is shuffled")
    ax.grid(True, alpha=0.3, axis="x")
    fig.tight_layout()
    fig.savefig(MODELS_DIR / "importance_permutation.png", dpi=120, bbox_inches="tight")
    plt.close(fig)

    print("\nPlots saved:")
    for name in ("importance_xgb.png", "importance_shap_beeswarm.png",
                 "importance_shap_bar.png", "importance_permutation.png"):
        print(f"  models/{name}")


if __name__ == "__main__":
    main()
