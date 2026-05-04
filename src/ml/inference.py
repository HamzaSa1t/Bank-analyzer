"""XGBoost inference + risk-based pricing + multi-gate decision.

Decision is APPROVED iff ALL of:
    1. passed_hard_rules (handled in api/services before this is called)
    2. pd_prob <= MAX_PD_ALLOWED[bank_type]
    3. credit_score >= MIN_SCORES[bank_type]
    4. final_dbr <= SAMA_DBR_CAP (priced rate, not the midpoint)
    5. expected_profit > 0

THRESHOLDS (the old PD gate at 0.05 / 0.15) is kept only as display reference.
The actual PD guardrail is MAX_PD_ALLOWED.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import numpy as np

from src.pricing import compute_financials, get_interest_rate

MODELS_DIR = Path(__file__).resolve().parents[2] / "models"
MODEL_PATH = MODELS_DIR / "model.pkl"
FEATURE_COLS_PATH = MODELS_DIR / "feature_cols.pkl"
MEDIAN_VALS_PATH = MODELS_DIR / "median_vals.pkl"

# Display-only PD references (the old gate values).
THRESHOLDS = {"conservative": 0.05, "aggressive": 0.15}
# Hard PD ceiling — the actual guardrail.
MAX_PD_ALLOWED = {"conservative": 0.08, "aggressive": 0.20}
MIN_SCORES = {"conservative": 650, "aggressive": 480}
SAMA_DBR_CAP = 0.3333
LGD = 0.45

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
    """Run XGBoost, price the loan, and apply the 5-gate AND decision rule."""
    model, cols = _load()
    X = _vector_for(features, cols)

    pd_prob = float(model.predict_proba(X)[0][1])

    # Displayed credit score uses the SIMAH formula (matches preprocessing.py
    # and feature_engineering.compute_derived):
    #     SIMAH_SCORE = 300 + 600 * EXT_SOURCE_AVG
    ext_avg = float(features.get("ext_source_avg", 0.5))
    credit_score = int(max(300, min(900, round(300 + 600 * ext_avg))))

    # Risk-based pricing → recompute monthly payment and DBR at the OFFERED rate.
    loan_amount = float(features.get("loan_amount", 0.0))
    loan_months = int(features.get("loan_months", 0))
    gross_salary = float(features.get("gross_salary", 0.0))
    existing_obligations = float(features.get("existing_obligations", 0.0))

    offered_rate = get_interest_rate(pd_prob, bank_type)
    fin = compute_financials(pd_prob, loan_amount, loan_months, offered_rate, lgd=LGD)
    final_monthly_payment = float(fin["monthly_payment"])
    final_dbr = (existing_obligations + final_monthly_payment) / max(gross_salary, 1.0)

    threshold = THRESHOLDS.get(bank_type, THRESHOLDS["conservative"])  # display only
    min_score = MIN_SCORES.get(bank_type, MIN_SCORES["conservative"])
    max_pd = MAX_PD_ALLOWED.get(bank_type, MAX_PD_ALLOWED["conservative"])

    failed_rules: list[str] = []
    if pd_prob > max_pd:
        failed_rules.append("pd_above_max")
    if credit_score < min_score:
        failed_rules.append("score_below_min")
    if final_dbr > SAMA_DBR_CAP:
        failed_rules.append("final_dbr_exceeded")
    if fin["profit"] <= 0:
        failed_rules.append("unprofitable")

    decision = "APPROVED" if not failed_rules else "REJECTED"
    risk_level = "HIGH" if pd_prob > 0.15 else "MEDIUM" if pd_prob > 0.05 else "LOW"

    return {
        "pd_prob": pd_prob,
        "model_pd": pd_prob,
        "credit_score": credit_score,
        "decision": decision,
        "risk_level": risk_level,
        "offered_interest_rate": float(offered_rate),
        "final_monthly_payment": final_monthly_payment,
        "final_dbr": float(final_dbr),
        "expected_revenue": float(fin["revenue"]),
        "expected_loss": float(fin["expected_loss"]),
        "expected_profit": float(fin["profit"]),
        "max_pd_allowed": float(max_pd),
        "pd_threshold": float(threshold),
        "min_score": int(min_score),
        "failed_rules": failed_rules,
    }
