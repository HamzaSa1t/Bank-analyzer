"""Build a model-ready feature dict from a loan request + SIMAH profile.

Schema mirrors `src/preprocessing.py` exactly — every key in `feature_cols.pkl`
must be assembled here so the inference vector aligns with training.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

MODELS_DIR = Path(__file__).resolve().parents[1] / "models"

# Midpoints of the rate ranges in the spec (Conservative 2-4%, Aggressive 7-15%).
BANK_ANNUAL_RATE = {
    "conservative": 0.03,
    "aggressive": 0.11,
}

# Frontend symbolic value -> Home Credit NAME_INCOME_TYPE string.
# IS_EMPLOYED = 1 for {"Working", "State servant"} (per preprocessing spec).
EMPLOYMENT_MAP = {
    "government": "State servant",
    "private": "Working",
    "self": "Commercial associate",
}

_FEATURE_COLS: list[str] | None = None


def _feature_cols() -> list[str] | None:
    """Read the column order saved by src/train.py. Returns None if model not trained."""
    global _FEATURE_COLS
    if _FEATURE_COLS is not None:
        return _FEATURE_COLS
    path = MODELS_DIR / "feature_cols.pkl"
    if not path.exists():
        return None
    _FEATURE_COLS = joblib.load(path)
    return _FEATURE_COLS


def _monthly_annuity(principal: float, annual_rate: float, months: int) -> float:
    """Standard amortization: P * r / (1 - (1+r)^-n) where r is monthly rate."""
    if months <= 0 or principal <= 0:
        return 0.0
    r = annual_rate / 12.0
    if r == 0:
        return principal / months
    return principal * r / (1.0 - (1.0 + r) ** -months)


def compute_derived(existing_obligations: float,
                    new_annuity: float,
                    gross_salary: float,
                    ext_sources: list[float]) -> dict[str, float]:
    """Comprehensive (existing + new) DBR for the SAMA rules check, plus EXT/SIMAH derivations.

    The model itself sees a simpler `DBR = AMT_ANNUITY / AMT_INCOME_TOTAL` per spec
    — that is computed inside build_features below. This `dbr` value is the one
    rules_engine consumes (the SAMA 33.33% cap is on total monthly obligations).
    """
    gross_salary = max(gross_salary, 1.0)
    dbr = (existing_obligations + new_annuity) / gross_salary
    annuity_to_income = new_annuity / gross_salary
    ext_clean = [v for v in ext_sources if v is not None and not (isinstance(v, float) and np.isnan(v))]
    ext_avg = float(np.mean(ext_clean)) if ext_clean else 0.5
    simah_score = 300.0 + (ext_avg * 600.0)
    return {
        "dbr": float(dbr),
        "annuity_to_income": float(annuity_to_income),
        "ext_source_avg": float(ext_avg),
        "simah_score": float(simah_score),
    }


def _vectorize(merged: dict[str, Any], cols: list[str]) -> list[float]:
    """Reindex the merged dict to the saved feature column order, NaN -> NaN.

    XGBoost handles NaN natively, so we deliberately don't fill NaN here. Missing
    keys (e.g. SIMAH row didn't carry a column) become NaN through reindex.
    """
    df = pd.DataFrame([merged])
    df = df.reindex(columns=cols)
    arr = df.iloc[0].to_numpy(dtype=float)
    return arr.tolist()


def build_features(request_dict: dict[str, Any],
                   simah_raw_features: dict[str, Any]) -> dict[str, Any]:
    """Fuse user request + SIMAH profile row into the dict the rest of the pipeline consumes."""
    bank_type = request_dict["bank_type"]
    gross_salary = float(request_dict["gross_salary"])
    loan_amount = float(request_dict["loan_amount"])
    loan_months = int(request_dict["loan_months"])
    age = int(request_dict["age"])
    employment_type = request_dict["employment_type"]

    annual_rate = BANK_ANNUAL_RATE.get(bank_type, BANK_ANNUAL_RATE["conservative"])
    new_annuity = _monthly_annuity(loan_amount, annual_rate, loan_months)

    # USER-CONFIRMED PROXY: existing_obligations = BUREAU_DEBT_TOTAL / 60 — treats
    # cumulative bureau debt as if amortized over a 5-year window, used only by
    # the rules engine's SAMA DBR cap.
    bureau_debt_total = float(simah_raw_features.get("BUREAU_DEBT_TOTAL") or 0.0)
    existing_obligations = bureau_debt_total / 60.0

    ext_sources = [
        simah_raw_features.get("EXT_SOURCE_1"),
        simah_raw_features.get("EXT_SOURCE_2"),
        simah_raw_features.get("EXT_SOURCE_3"),
    ]
    derived = compute_derived(existing_obligations, new_annuity, gross_salary, ext_sources)

    # Build the model-aligned dict. Start from the SIMAH row (carries bureau /
    # installments / card aggregates + EXT_SOURCE_*) and overlay the user's loan
    # request on the application-level columns.
    merged: dict[str, Any] = dict(simah_raw_features)
    merged["AMT_INCOME_TOTAL"] = gross_salary
    merged["AMT_CREDIT"] = loan_amount
    merged["AMT_ANNUITY"] = new_annuity
    merged["AGE_YEARS"] = float(age)

    name_income_type = EMPLOYMENT_MAP.get(employment_type, "Working")
    merged["IS_EMPLOYED"] = 1 if name_income_type in ("Working", "State servant") else 0

    # Recompute the per-row engineered features against the overlaid loan terms,
    # so the model sees ratios that reflect THIS application (not the SIMAH sample's).
    merged["DBR"] = new_annuity / max(gross_salary, 1.0)
    merged["CREDIT_INCOME_RATIO"] = loan_amount / max(gross_salary, 1.0)
    ext_clean = [v for v in ext_sources if v is not None and not (isinstance(v, float) and np.isnan(v))]
    merged["EXT_SOURCE_AVG"] = float(np.mean(ext_clean)) if ext_clean else np.nan
    merged["SIMAH_SCORE"] = (
        300.0 + (merged["EXT_SOURCE_AVG"] * 600.0)
        if not (isinstance(merged["EXT_SOURCE_AVG"], float) and np.isnan(merged["EXT_SOURCE_AVG"]))
        else np.nan
    )

    features: dict[str, Any] = {
        "bank_type": bank_type,
        "gross_salary": gross_salary,
        "loan_amount": loan_amount,
        "loan_months": loan_months,
        "age": age,
        "employment_type": employment_type,
        "new_annuity": new_annuity,
        "existing_obligations": existing_obligations,
        "dbr": derived["dbr"],
        "annuity_to_income": derived["annuity_to_income"],
        "ext_source_avg": derived["ext_source_avg"],
        "simah_score": derived["simah_score"],
        # Surface the rules-engine-relevant SIMAH signals as flat scalars too.
        "max_overdue": float(simah_raw_features.get("BUREAU_MAX_OVERDUE") or 0.0),
        "total_debt": bureau_debt_total,
        "inquiries_last_month": float(simah_raw_features.get("AMT_REQ_CREDIT_BUREAU_MON") or 0.0),
        "credit_history_days": float(simah_raw_features.get("BUREAU_CREDIT_AGE_MAX") or 0.0),
        "max_dpd": float(simah_raw_features.get("BUREAU_DAYS_OVERDUE_MAX") or 0.0),
        "raw": merged,
    }

    cols = _feature_cols()
    if cols is not None:
        features["vector"] = _vectorize(merged, cols)
        features["feature_order"] = cols

    return features
