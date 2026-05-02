"""Single source of truth for friendly labels of model feature columns.

Mirrors frontend/src/lib/featureLabels.js — keep both in sync.
"""

from __future__ import annotations

FEATURE_LABELS: dict[str, str] = {
    "EXT_SOURCE_AVG": "Credit Bureau Score (Average)",
    "EXT_SOURCE_1": "Credit Bureau Score (Source 1)",
    "EXT_SOURCE_2": "Credit Bureau Score (Source 2)",
    "EXT_SOURCE_3": "Credit Bureau Score (Source 3)",
    "SIMAH_SCORE": "SIMAH Score",
    "AMT_CREDIT": "Loan Amount",
    "AMT_ANNUITY": "Monthly Installment",
    "AMT_INCOME_TOTAL": "Monthly Income",
    "YEARS_EMPLOYED": "Years of Employment",
    "AGE_YEARS": "Applicant Age",
    "DBR": "Debt Burden Ratio",
    "CREDIT_INCOME_RATIO": "Loan-to-Income Ratio",
    "INSTAL_PCT_LATE": "Late Payment Rate",
    "INSTAL_DAYS_LATE_MAX": "Worst Payment Delay (Days)",
    "INSTAL_DAYS_LATE_MEAN": "Average Payment Delay (Days)",
    "INSTAL_PAYMENT_RATE": "Installment Payment Rate",
    "BUREAU_CREDIT_AGE_MAX": "Credit History Length",
    "BUREAU_MAX_OVERDUE": "Highest Overdue Amount",
    "BUREAU_DAYS_OVERDUE_MAX": "Longest Overdue Period",
    "BUREAU_DEBT_TOTAL": "Total Bureau Debt",
    "BUREAU_LIMIT_TOTAL": "Total Credit Limit",
    "BUREAU_UTIL_RATIO": "Credit Utilization Ratio",
    "BUREAU_ACTIVE_COUNT": "Active Loans Count",
    "BUREAU_PROLONGED_COUNT": "Prolonged Loans Count",
    "CARD_UTIL_RATIO_AVG": "Credit Card Utilization (Average)",
    "CARD_UTIL_RATIO_MAX": "Credit Card Utilization (Maximum)",
    "CARD_DPD_MAX": "Credit Card Max Days Past Due",
    "CARD_PAYMENT_RATIO": "Credit Card Payment Ratio",
    "CARD_MONTHS_ACTIVE": "Credit Card Active Months",
    "IS_EMPLOYED": "Employment Status",
    "AMT_REQ_CREDIT_BUREAU_MON": "Credit Inquiries (Last Month)",
}


def pretty_feature(name: str) -> str:
    """Return the friendly label for a feature, falling back to the raw name."""
    return FEATURE_LABELS.get(name, name)
