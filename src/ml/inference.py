"""XGBoost inference — loads model.pkl + feature_cols.pkl + median_vals.pkl.

Per-bank decision policy (from spec):
    Conservative bank: PD > 0.05 -> reject  (also requires credit_score >= 650)
    Aggressive  bank: PD > 0.15 -> reject  (also requires credit_score >= 480)
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import numpy as np

MODELS_DIR = Path(__file__).resolve().parents[2] / "models"
MODEL_PATH = MODELS_DIR / "model.pkl"
FEATURE_COLS_PATH = MODELS_DIR / "feature_cols.pkl"
MEDIAN_VALS_PATH = MODELS_DIR / "median_vals.pkl"

THRESHOLDS = {"conservative": 0.05, "aggressive": 0.15}
MIN_SCORES = {"conservative": 650, "aggressive": 480}

_model = None
_feature_cols: list[str] | None = None
_median_vals = None


def _load() -> tuple[Any, list[str]]:
    """Lazy-load model + column order. Cached after first call."""
    global _model, _feature_cols, _median_vals
    if _model is None:
        _model = joblib.load(MODEL_PATH)
    if _feature_cols is None:
        _feature_cols = joblib.load(FEATURE_COLS_PATH)
    if _median_vals is None and MEDIAN_VALS_PATH.exists():
        _median_vals = joblib.load(MEDIAN_VALS_PATH)
    return _model, _feature_cols


def _vector_for(features: dict[str, Any], cols: list[str]) -> np.ndarray:
    """Pull the pre-built feature vector and shape-check it against the saved column order."""
    vec = features.get("vector")
    if vec is None:
        raise ValueError(
            "features['vector'] is missing — was build_features called? "
            "If models/feature_cols.pkl is absent, the model hasn't been trained."
        )
    if len(vec) != len(cols):
        raise ValueError(
            f"feature vector length {len(vec)} does not match model expectation {len(cols)}. "
            "Retrain or rebuild features so the schemas align."
        )
    return np.asarray(vec, dtype=float).reshape(1, -1)


def predict(features: dict[str, Any], bank_type: str) -> dict[str, Any]:
    """Run XGBoost on the assembled vector and apply per-bank decision rules."""
    model, cols = _load()
    X = _vector_for(features, cols)

    pd_prob = float(model.predict_proba(X)[0][1])

    # Displayed credit score uses the SIMAH formula (matches src/preprocessing.py
    # and feature_engineering.compute_derived):
    #     SIMAH_SCORE = 300 + 600 * EXT_SOURCE_AVG
    # The model's PD already drives the decision via the policy thresholds; the
    # score is purely a presentation of the applicant's bureau-score band.
    ext_avg = float(features.get("ext_source_avg", 0.5))
    credit_score = int(max(300, min(900, round(300 + 600 * ext_avg))))

    threshold = THRESHOLDS.get(bank_type, THRESHOLDS["conservative"])
    min_score = MIN_SCORES.get(bank_type, MIN_SCORES["conservative"])

    decision = "REJECTED" if (pd_prob > threshold or credit_score < min_score) else "APPROVED"
    risk_level = "HIGH" if pd_prob > 0.15 else "MEDIUM" if pd_prob > 0.05 else "LOW"

    return {
        "pd_prob": pd_prob,
        "credit_score": credit_score,
        "decision": decision,
        "risk_level": risk_level,
    }
