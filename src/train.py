"""XGBoost training on data/processed/features.csv with proper CV.

Run after src/preprocessing.py:
    python src/train.py

Validation strategy
-------------------
5-fold StratifiedKFold (shuffle=True, random_state=42). For each outer fold:
    1. Outer val rows are set aside and NEVER seen in fit or early stopping.
    2. The remaining train fold is split 90/10. The 10% slice is used ONLY as
       the early-stopping signal; the model is fit on the 90%.
    3. Outer val AUC is computed on the untouched outer val fold.

Out-of-fold (OOF) predictions are stitched together so every row gets a
prediction from a model that never saw it during training or early stopping.
OOF AUC is the unbiased main metric.

Saves to models/:
    model.pkl          — final XGBClassifier retrained on the FULL dataset
                          (n_estimators = mean best_iteration from CV, no ES,
                          so no held-out set is peeked at when fitting)
    xgboost_model.pkl  — duplicate of model.pkl for legacy callers
    feature_cols.pkl   — exact column order used at fit time
    feature_order.json — same column order, JSON-readable
    median_vals.pkl    — EXT_SOURCE_{1,2,3} medians (for inference scaling)
    categorical_columns.json
    metrics.json       — OOF AUC + fold AUCs + train–val gap + thresholds

Reports OOF AUC + recall at the default 0.5 cutoff, plus metrics at the two
bank-policy thresholds (computed on OOF predictions for an unbiased view):
    Conservative bank: PD > 0.05  -> reject
    Aggressive  bank: PD > 0.15  -> reject
"""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.metrics import (
    average_precision_score, brier_score_loss, roc_auc_score, recall_score,
    precision_score, f1_score, confusion_matrix,
)
from xgboost import XGBClassifier

ROOT = Path(__file__).resolve().parents[1]
FEATURES_CSV = ROOT / "data" / "processed" / "features.csv"
MODELS_DIR = ROOT / "models"
OOF_PATH = MODELS_DIR / "oof_predictions.csv"

POLICY_THRESHOLDS = {"conservative": 0.05, "aggressive": 0.15}
EXT_SOURCE_COLS = ["EXT_SOURCE_1", "EXT_SOURCE_2", "EXT_SOURCE_3"]

N_SPLITS = 5
SEED = 42
INNER_VAL_FRAC = 0.10  # 10% of each train fold is held out for early stopping only

# Hyperparameters — kept identical to the previous single-split version so this
# change is purely a validation-method change, not a model change.
XGB_PARAMS = dict(
    max_depth=4,
    learning_rate=0.03,
    min_child_weight=10,
    subsample=0.85,
    colsample_bytree=0.85,
    reg_alpha=0.1,
    reg_lambda=3.0,
    eval_metric="auc",
    tree_method="hist",
    random_state=SEED,
)


def _make_cv_model() -> XGBClassifier:
    """Per-fold model. Large n_estimators ceiling — early stopping picks the cut."""
    return XGBClassifier(
        n_estimators=2000,
        early_stopping_rounds=50,
        **XGB_PARAMS,
    )


def _make_final_model(n_estimators: int) -> XGBClassifier:
    """Final model retrained on full data. No early stopping (no held-out peek)."""
    return XGBClassifier(
        n_estimators=n_estimators,
        **XGB_PARAMS,
    )


def threshold_report(y_true, y_proba, t: float, label: str) -> dict[str, object]:
    y_pred = (y_proba >= t).astype(int)
    cm = confusion_matrix(y_true, y_pred)
    print(f"\n{label} (PD >= {t}):")
    precision = precision_score(y_true, y_pred, zero_division=0)
    recall = recall_score(y_true, y_pred, zero_division=0)
    f1 = f1_score(y_true, y_pred, zero_division=0)
    approval_rate = (y_proba < t).mean()
    print(f"  precision    : {precision:.4f}")
    print(f"  recall       : {recall:.4f}")
    print(f"  f1           : {f1:.4f}")
    print(f"  approval rate: {approval_rate:.4f}")
    print(f"  confusion    : TN={cm[0,0]} FP={cm[0,1]} FN={cm[1,0]} TP={cm[1,1]}")
    return {
        "threshold": t,
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "approval_rate": float(approval_rate),
        "confusion_matrix": cm.tolist(),
    }


def cross_validate(X: pd.DataFrame, y: pd.Series) -> tuple[dict[str, object], np.ndarray, int]:
    """Run 5-fold StratifiedKFold with inner-fold early stopping.

    The outer val fold is the held-out set we score on; it is never touched by
    fit() or by early_stopping. Early stopping uses a 10% slice of the
    OUTER-TRAIN fold so the outer val remains unbiased.

    Returns (metrics_dict, oof_predictions, mean_best_iteration).
    """
    skf = StratifiedKFold(n_splits=N_SPLITS, shuffle=True, random_state=SEED)
    oof = np.zeros(len(y), dtype=float)
    fold_val_aucs: list[float] = []
    fold_train_aucs: list[float] = []
    best_iters: list[int] = []

    print(f"\n{N_SPLITS}-fold StratifiedKFold (shuffle=True, random_state={SEED})")
    print("-" * 70)
    print(f"{'fold':>4} | {'val AUC':>8} | {'train AUC':>9} | {'gap':>7} | {'best_iter':>9}")
    print("-" * 70)

    for fold, (tr_idx, va_idx) in enumerate(skf.split(X, y), start=1):
        X_tr_full, X_va = X.iloc[tr_idx], X.iloc[va_idx]
        y_tr_full, y_va = y.iloc[tr_idx], y.iloc[va_idx]

        # Inner split for early stopping ONLY — comes from the outer-train fold.
        # The outer val (X_va, y_va) is not touched.
        X_fit, X_es, y_fit, y_es = train_test_split(
            X_tr_full, y_tr_full,
            test_size=INNER_VAL_FRAC,
            stratify=y_tr_full,
            random_state=SEED + fold,
        )

        model = _make_cv_model()
        model.fit(X_fit, y_fit, eval_set=[(X_es, y_es)], verbose=False)

        # Predict probabilities (NOT class labels) for AUC.
        va_proba = model.predict_proba(X_va)[:, 1]
        tr_proba = model.predict_proba(X_fit)[:, 1]

        oof[va_idx] = va_proba
        val_auc = roc_auc_score(y_va, va_proba)
        train_auc = roc_auc_score(y_fit, tr_proba)
        best_iter = int(getattr(model, "best_iteration", model.n_estimators))

        fold_val_aucs.append(float(val_auc))
        fold_train_aucs.append(float(train_auc))
        best_iters.append(best_iter)

        print(
            f"{fold:>4} | {val_auc:>8.4f} | {train_auc:>9.4f} | "
            f"{train_auc - val_auc:>+7.4f} | {best_iter:>9d}"
        )

    print("-" * 70)

    oof_auc = float(roc_auc_score(y, oof))
    mean_val = float(np.mean(fold_val_aucs))
    std_val = float(np.std(fold_val_aucs))
    mean_train = float(np.mean(fold_train_aucs))
    gap = mean_train - mean_val
    mean_best_iter = int(round(float(np.mean(best_iters))))

    print(f"OOF AUC                  : {oof_auc:.4f}")
    print(f"Mean fold val AUC        : {mean_val:.4f} ± {std_val:.4f}")
    print(f"Mean fold train AUC      : {mean_train:.4f}")
    print(f"Mean train-val gap       : {gap:+.4f}")
    print(f"Mean best_iteration      : {mean_best_iter}")
    print("-" * 70)

    # Quick interpretation hint for the operator.
    if std_val >= 0.01:
        print(f"⚠ Fold std {std_val:.4f} >= 0.01 — score is NOISY across folds.")
    else:
        print(f"✓ Fold std {std_val:.4f} < 0.01 — score is stable across folds.")
    if gap >= 0.05:
        print(f"⚠ Train-val gap {gap:+.4f} >= 0.05 — model is OVERFITTING.")
    elif gap >= 0.02:
        print(f"~ Train-val gap {gap:+.4f} — mild overfitting, acceptable.")
    else:
        print(f"✓ Train-val gap {gap:+.4f} — no meaningful overfitting.")

    cv_metrics: dict[str, object] = {
        "oof_auc": oof_auc,
        "mean_val_auc": mean_val,
        "std_val_auc": std_val,
        "mean_train_auc": mean_train,
        "train_val_gap": float(gap),
        "fold_val_aucs": fold_val_aucs,
        "fold_train_aucs": fold_train_aucs,
        "fold_best_iterations": best_iters,
        "mean_best_iteration": mean_best_iter,
        "n_splits": N_SPLITS,
        "seed": SEED,
        "inner_val_frac": INNER_VAL_FRAC,
    }
    return cv_metrics, oof, mean_best_iter


def main() -> None:
    print(f"Loading {FEATURES_CSV} ...")
    df = pd.read_csv(FEATURES_CSV)
    print(f"  -> {df.shape}")

    feature_cols = [c for c in df.columns if c not in ("SK_ID_CURR", "TARGET")]
    X = df[feature_cols]
    y = df["TARGET"].astype(int)

    cv_metrics, oof, mean_best_iter = cross_validate(X, y)

    # Save OOF predictions for downstream honest evaluation (calibration,
    # feature importance) — every row's PD comes from a model that never
    # trained on it.
    oof_df = pd.DataFrame({
        "SK_ID_CURR": df["SK_ID_CURR"].to_numpy(),
        "TARGET": y.to_numpy(),
        "PD_OOF": oof,
    })
    OOF_PATH.parent.mkdir(parents=True, exist_ok=True)
    oof_df.to_csv(OOF_PATH, index=False)
    print(f"Saved OOF predictions -> {OOF_PATH}")

    # OOF-based threshold reports — every row's probability comes from a model
    # that never trained on it, so these numbers are unbiased.
    pr_auc = float(average_precision_score(y, oof))
    brier = float(brier_score_loss(y, oof))
    print(f"\nOOF PR-AUC        : {pr_auc:.4f}")
    print(f"OOF Brier score   : {brier:.4f}")
    print(f"OOF Recall @ 0.5  : {recall_score(y, (oof >= 0.5).astype(int)):.4f}")

    thresholds = {
        "default_0.5": threshold_report(y, oof, 0.5, "Default"),
        "conservative_0.05": threshold_report(
            y, oof, POLICY_THRESHOLDS["conservative"], "Conservative bank"
        ),
        "aggressive_0.15": threshold_report(
            y, oof, POLICY_THRESHOLDS["aggressive"], "Aggressive bank"
        ),
    }

    # Final model: retrain on the full dataset using mean best_iteration. No
    # early stopping here — there is no held-out set, so nothing is peeked at.
    print(f"\nRetraining final model on full data (n_estimators={mean_best_iter}) ...")
    final_model = _make_final_model(n_estimators=mean_best_iter)
    final_model.fit(X, y, verbose=False)

    median_vals = X[EXT_SOURCE_COLS].median()

    metrics = {
        "auc_roc": cv_metrics["oof_auc"],            # primary metric: OOF AUC
        "validation_method": f"{N_SPLITS}-fold StratifiedKFold (OOF)",
        "cv": cv_metrics,
        "pr_auc": pr_auc,
        "brier_score": brier,
        "n_total": int(len(y)),
        "positive_rate": float(y.mean()),
        "feature_count": int(len(feature_cols)),
        "thresholds": thresholds,
    }

    MODELS_DIR.mkdir(exist_ok=True)
    joblib.dump(final_model, MODELS_DIR / "model.pkl")
    joblib.dump(feature_cols, MODELS_DIR / "feature_cols.pkl")
    joblib.dump(median_vals, MODELS_DIR / "median_vals.pkl")
    joblib.dump(final_model, MODELS_DIR / "xgboost_model.pkl")
    (MODELS_DIR / "feature_order.json").write_text(
        json.dumps(feature_cols, indent=2), encoding="utf-8"
    )
    (MODELS_DIR / "categorical_columns.json").write_text("[]\n", encoding="utf-8")
    (MODELS_DIR / "metrics.json").write_text(
        json.dumps(metrics, indent=2), encoding="utf-8"
    )
    print(
        "\nSaved model.pkl, xgboost_model.pkl, feature_cols.pkl, "
        f"feature_order.json, median_vals.pkl, categorical_columns.json, metrics.json to {MODELS_DIR}"
    )


if __name__ == "__main__":
    main()
