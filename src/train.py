"""XGBoost training on data/processed/features.csv.

Run after src/preprocessing.py:
    python src/train.py

Saves to models/:
    model.pkl          — trained XGBClassifier
    feature_cols.pkl   — exact column order used at fit time
    median_vals.pkl    — EXT_SOURCE_{1,2,3} medians from the training split
                          (XGBoost handles NaN natively, but inference code that
                          rescales/imputes should use these — never test medians.)

Reports AUC-ROC + recall at the default 0.5 cutoff, plus metrics at the two
bank-policy thresholds:
    Conservative bank: PD > 0.05  -> reject
    Aggressive  bank: PD > 0.15  -> reject
"""

from __future__ import annotations

from pathlib import Path

import joblib
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    roc_auc_score, recall_score, precision_score, f1_score, confusion_matrix,
)
from xgboost import XGBClassifier

ROOT = Path(__file__).resolve().parents[1]
FEATURES_CSV = ROOT / "data" / "processed" / "features.csv"
MODELS_DIR = ROOT / "models"

POLICY_THRESHOLDS = {"conservative": 0.05, "aggressive": 0.15}
EXT_SOURCE_COLS = ["EXT_SOURCE_1", "EXT_SOURCE_2", "EXT_SOURCE_3"]


def threshold_report(y_true, y_proba, t: float, label: str) -> None:
    y_pred = (y_proba >= t).astype(int)
    cm = confusion_matrix(y_true, y_pred)
    print(f"\n{label} (PD >= {t}):")
    print(f"  precision    : {precision_score(y_true, y_pred, zero_division=0):.4f}")
    print(f"  recall       : {recall_score(y_true, y_pred, zero_division=0):.4f}")
    print(f"  f1           : {f1_score(y_true, y_pred, zero_division=0):.4f}")
    print(f"  approval rate: {(y_proba < t).mean():.4f}")
    print(f"  confusion    : TN={cm[0,0]} FP={cm[0,1]} FN={cm[1,0]} TP={cm[1,1]}")


def main() -> None:
    print(f"Loading {FEATURES_CSV} ...")
    df = pd.read_csv(FEATURES_CSV)
    print(f"  -> {df.shape}")

    # Derive feature columns dynamically — never hardcode.
    feature_cols = [c for c in df.columns if c not in ("SK_ID_CURR", "TARGET")]
    X = df[feature_cols]
    y = df["TARGET"].astype(int)

    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42,
    )

    # EXT_SOURCE medians from the TRAINING split only — saved for any inference
    # path that wants to scale/impute. XGBoost itself does not need them.
    median_vals = X_train[EXT_SOURCE_COLS].median()

    model = XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        eval_metric="auc",
        early_stopping_rounds=20,
        tree_method="hist",
        random_state=42,
    )
    model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)

    val_proba = model.predict_proba(X_val)[:, 1]
    print(f"\nAUC-ROC: {roc_auc_score(y_val, val_proba):.4f}")
    print(f"Recall @ 0.5: {recall_score(y_val, (val_proba >= 0.5).astype(int)):.4f}")

    threshold_report(y_val, val_proba, POLICY_THRESHOLDS["conservative"], "Conservative bank")
    threshold_report(y_val, val_proba, POLICY_THRESHOLDS["aggressive"], "Aggressive bank")

    MODELS_DIR.mkdir(exist_ok=True)
    joblib.dump(model, MODELS_DIR / "model.pkl")
    joblib.dump(feature_cols, MODELS_DIR / "feature_cols.pkl")
    joblib.dump(median_vals, MODELS_DIR / "median_vals.pkl")
    print(f"\nSaved model.pkl, feature_cols.pkl, median_vals.pkl to {MODELS_DIR}")


if __name__ == "__main__":
    main()
