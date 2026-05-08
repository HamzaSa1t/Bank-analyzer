"""SAMA hard rules — run before ML inference. Stops at first failure."""

from __future__ import annotations

from typing import Any

# Rule order matters — `check_hard_rules` returns the FIRST failure. Eligibility
# checks (salary / age / tenor) come before the dbr_limit check so a low-salary
# applicant whose computed DBR also happens to exceed the cap is reported as
# `minimum_salary` rather than `dbr_limit`, which is more actionable.
RULES: list[dict[str, Any]] = [
    {
        "code": "active_default",
        "feature": "BUREAU_MAX_OVERDUE",
        "check": lambda f: f.get("max_overdue", 0) > 0,
        "ar": "يوجد تعثر ائتماني نشط في سجلك لدى سمة",
        "en": "Active credit default found on SIMAH record",
    },
    {
        "code": "minimum_salary",
        "feature": "AMT_INCOME_TOTAL",
        "check": lambda f: f.get("gross_salary", 0) < 4000,
        "ar": "الراتب الشهري أقل من الحد الأدنى المطلوب 4,000 ريال",
        "en": "Monthly salary below minimum threshold of SAR 4,000",
    },
    {
        "code": "minimum_age",
        "feature": "AGE_YEARS",
        "check": lambda f: f.get("age", 0) < 21,
        "ar": "يشترط ألا يقل عمر المتقدم عن 21 سنة",
        "en": "Applicant must be at least 21 years old",
    },
    {
        "code": "maturity_age",
        "feature": "AGE_YEARS",
        "check": lambda f: f.get("age", 0) + f.get("loan_months", 0) / 12 > 60,
        "ar": "سيتجاوز عمرك 60 سنة عند انتهاء مدة القرض",
        "en": "Age at loan maturity exceeds maximum of 60 years",
    },
    {
        "code": "dbr_limit",
        "feature": "DBR",
        "check": lambda f: f.get("dbr", 0) > 0.3333,
        "ar": "نسبة عبء الدين تتجاوز الحد المسموح به 33.33% وفق أنظمة ساما",
        "en": "Debt Burden Ratio exceeds SAMA mandatory limit of 33.33%",
    },
]


def check_hard_rules(features: dict[str, Any], bank_type: str, language: str) -> dict[str, Any]:  # noqa: ARG001
    """Return the first failing rule, with the reason in BOTH languages so the
    frontend can switch language client-side without re-querying."""
    for rule in RULES:
        if rule["check"](features):
            return {
                "passed": False,
                "reason": {"en": rule["en"], "ar": rule["ar"]},
                "code": rule["code"],
                "feature": rule["feature"],
            }
    return {"passed": True, "reason": None}
