"""Single source of truth for user-facing model feature labels."""

from __future__ import annotations

FEATURE_LABELS: dict[str, str] = {
    "EXT_SOURCE_AVG": "Overall credit history strength",
    "EXT_SOURCE_1": "Credit history strength",
    "EXT_SOURCE_2": "Repayment behavior score",
    "EXT_SOURCE_3": "External credit profile score",
    "SIMAH_SCORE": "Simulated credit score",
    "AMT_CREDIT": "Requested loan amount",
    "AMT_GOODS_PRICE": "Estimated financed item value",
    "AMT_ANNUITY": "Monthly payment amount",
    "AMT_INCOME_TOTAL": "Monthly income",
    "YEARS_EMPLOYED": "Employment length",
    "AGE_YEARS": "Applicant age",
    "DBR": "Monthly debt burden",
    "CREDIT_INCOME_RATIO": "Loan size compared with income",
    "INSTAL_PCT_LATE": "Late payment history",
    "INSTAL_DAYS_LATE_MAX": "Worst payment delay",
    "INSTAL_DAYS_LATE_MEAN": "Average payment delay",
    "INSTAL_PAYMENT_RATE": "Past payment consistency",
    "BUREAU_CREDIT_AGE_MAX": "Credit history length",
    "BUREAU_MAX_OVERDUE": "Highest overdue balance",
    "BUREAU_DAYS_OVERDUE_MAX": "Longest overdue period",
    "BUREAU_DEBT_TOTAL": "Existing credit obligations",
    "BUREAU_LIMIT_TOTAL": "Available credit limit",
    "BUREAU_UTIL_RATIO": "Credit usage level",
    "BUREAU_ACTIVE_COUNT": "Number of active loans",
    "BUREAU_PROLONGED_COUNT": "Repeated loan extensions",
    "CARD_UTIL_RATIO_AVG": "Average card usage",
    "CARD_UTIL_RATIO_MAX": "Highest card usage",
    "CARD_DPD_MAX": "Worst card payment delay",
    "CARD_PAYMENT_RATIO": "Card repayment consistency",
    "CARD_MONTHS_ACTIVE": "Recent card activity",
    "IS_EMPLOYED": "Stable employment status",
    "AMT_REQ_CREDIT_BUREAU_MON": "Recent credit applications",
    "ANNUITY_CREDIT_RATIO": "Monthly payment pressure",
    "GOODS_CREDIT_RATIO": "Financed amount compared with item value",
    "BUREAU_DEBT_CREDIT_RATIO_MAX": "Highest debt pressure on existing credit",
    "OWN_CAR_AGE": "Vehicle age",
    "CODE_GENDER_M": "Applicant gender",
}


def pretty_feature(name: str) -> str:
    """Return the user-facing label for a feature, falling back to the raw name."""
    return FEATURE_LABELS.get(name, name)
