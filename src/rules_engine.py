"""SAMA hard rules — run before ML inference. Stops at first failure."""

from __future__ import annotations

from typing import Any

RULES: list[dict[str, Any]] = [
    {
        "check": lambda f: f.get("max_overdue", 0) > 0,
        "ar": "يوجد تعثر ائتماني نشط في سجلك لدى سمة",
        "en": "Active credit default found on SIMAH record",
    },
    {
        "check": lambda f: f.get("dbr", 0) > 0.3333,
        "ar": "نسبة عبء الدين تتجاوز الحد المسموح به 33.33% وفق أنظمة ساما",
        "en": "Debt Burden Ratio exceeds SAMA mandatory limit of 33.33%",
    },
    {
        "check": lambda f: f.get("gross_salary", 0) < 4000,
        "ar": "الراتب الشهري أقل من الحد الأدنى المطلوب 4,000 ريال",
        "en": "Monthly salary below minimum threshold of SAR 4,000",
    },
    {
        "check": lambda f: f.get("age", 0) < 21,
        "ar": "يشترط ألا يقل عمر المتقدم عن 21 سنة",
        "en": "Applicant must be at least 21 years old",
    },
    {
        "check": lambda f: f.get("age", 0) + f.get("loan_months", 0) / 12 > 60,
        "ar": "سيتجاوز عمرك 60 سنة عند انتهاء مدة القرض",
        "en": "Age at loan maturity exceeds maximum of 60 years",
    },
]


def check_hard_rules(features: dict[str, Any], bank_type: str, language: str) -> dict[str, Any]:
    lang = language if language in ("ar", "en") else "en"
    for rule in RULES:
        if rule["check"](features):
            return {"passed": False, "reason": rule[lang]}
    return {"passed": True, "reason": None}
