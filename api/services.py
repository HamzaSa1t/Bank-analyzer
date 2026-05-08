"""Service orchestration — rules → ML → pricing → SHAP → structured LLM."""

from __future__ import annotations

import hashlib
import logging
from typing import Any, Optional

from src import feature_engineering, rules_engine
from src.llm import reporter as llm_reporter
from src.ml import explainer as ml_explainer
from src.ml import inference as ml_inference

from .schemas import AssessmentRequest, AssessmentResponse

log = logging.getLogger(__name__)

SAMA_DBR_CAP = 0.3333


def compute_gate_results(
    passed_hard_rules: bool, ml_result: Optional[dict[str, Any]]
) -> dict[str, str]:
    """Pass / fail / skipped per gate. Skipped means the gate was never evaluated
    (e.g. ML & pricing are bypassed when a hard rule fails)."""
    if not passed_hard_rules:
        return {
            "hard_rules": "fail",
            "pd_limit": "skipped",
            "credit_score": "skipped",
            "final_dbr": "skipped",
            "profitability": "skipped",
        }
    failed = set((ml_result or {}).get("failed_rules") or [])
    return {
        "hard_rules": "pass",
        "pd_limit": "fail" if "pd_above_max" in failed else "pass",
        "credit_score": "fail" if "score_below_min" in failed else "pass",
        "final_dbr": "fail" if "final_dbr_exceeded" in failed else "pass",
        "profitability": "fail" if "unprofitable" in failed else "pass",
    }


def enforce_decision_consistency(
    passed_hard_rules: bool, failed_rules: list[str], decision: str
) -> str:
    """REJECTED if any hard rule or post-pricing gate failed; APPROVED otherwise.
    Logs a warning and overrides the value if the upstream decision disagrees."""
    expected = "APPROVED" if (passed_hard_rules and not failed_rules) else "REJECTED"
    if decision != expected:
        log.warning(
            "Decision inconsistency (expected=%s, got=%s, passed_hard_rules=%s, failed_rules=%s) — overriding to %s",
            expected,
            decision,
            passed_hard_rules,
            failed_rules,
            expected,
        )
        return expected
    return decision


def compute_request_fingerprint(req: AssessmentRequest) -> str:
    """Stable hash of the application's identifying fields. Lets log readers
    spot duplicate submissions without blocking them."""
    simah = req.simah_profile if isinstance(req.simah_profile, dict) else {}
    parts = [
        str(req.bank_type),
        f"{float(req.gross_salary):.2f}",
        f"{float(req.loan_amount):.2f}",
        str(int(req.loan_months)),
        str(int(req.age)),
        str(req.employment_type),
        str(simah.get("total_debt", "")),
        str(simah.get("max_overdue", "")),
        str(simah.get("inquiries_last_month", "")),
        str(simah.get("credit_history_days", "")),
        str(simah.get("max_dpd", "")),
    ]
    return hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:16]


# Generic, rule-agnostic risk_summary for the hard-rule path. The specific rule
# fact lives in key_concerns, the WHY-and-WHAT-skipped lives in
# decision_explanation, so this field stays purely high-level (spec section 1).
HARD_RULE_RISK_SUMMARY = {
    "en": "The application was rejected before risk assessment due to a policy rule.",
    "ar": "تم إيقاف الطلب قبل تقييم المخاطر بسبب عدم استيفاء قاعدة إلزامية.",
}


# Per-rule decision_explanation: WHY the rule matters (business reason) plus
# WHAT the system skipped. Phrased so the sentence does NOT reuse the verbatim
# concern sentence, satisfying the cross-field uniqueness rule (spec section B).
HARD_RULE_EXPLANATIONS = {
    "en": {
        "active_default": "Active default is a hard rejection rule under the bank's policy. Therefore, the system skipped model scoring, pricing, and profit evaluation.",
        "dbr_limit": "Initial DBR exceeding the SAMA cap is a hard rejection rule. Therefore, the system skipped model scoring, pricing, and profit evaluation.",
        "minimum_salary": "Income below the product's minimum salary is a hard rejection rule. Therefore, the system skipped model scoring, pricing, and profit evaluation.",
        "minimum_age": "Being below the minimum eligible age is a hard rejection rule. Therefore, the system skipped model scoring, pricing, and profit evaluation.",
        "maturity_age": "A loan that would mature past the maximum age is a hard rejection rule. Therefore, the system skipped model scoring, pricing, and profit evaluation.",
    },
    "ar": {
        "active_default": "وجود تعثر نشط يعتبر سبب رفض مباشر في سياسة البنك. لذلك لم يتم تشغيل نموذج احتمالية التعثر أو حساب التسعير والربحية.",
        "dbr_limit": "تجاوز نسبة عبء الدين الأولية لسقف ساما يعتبر سبب رفض مباشر. لذلك لم يتم تشغيل نموذج احتمالية التعثر أو حساب التسعير والربحية.",
        "minimum_salary": "الراتب الشهري دون الحد الأدنى للمنتج يعتبر سبب رفض مباشر. لذلك لم يتم تشغيل نموذج احتمالية التعثر أو حساب التسعير والربحية.",
        "minimum_age": "عدم استيفاء الحد الأدنى للعمر يعتبر سبب رفض مباشر. لذلك لم يتم تشغيل نموذج احتمالية التعثر أو حساب التسعير والربحية.",
        "maturity_age": "تجاوز سن المتقدم عند استحقاق التمويل لحد السياسة يعتبر سبب رفض مباشر. لذلك لم يتم تشغيل نموذج احتمالية التعثر أو حساب التسعير والربحية.",
    },
}


# Per-rule suggested_actions — three distinct, actionable items per rule
# (spec section 5). No items duplicate the concern sentence or each other.
HARD_RULE_ACTIONS = {
    "en": {
        "active_default": [
            "Resolve the active SIMAH default.",
            "Review the SIMAH credit report to verify the data.",
            "Reapply after the credit record is updated.",
        ],
        "dbr_limit": [
            "Reduce the requested loan amount or extend the tenor.",
            "Settle a portion of existing obligations to free up debt capacity.",
            "Reapply once the Debt Burden Ratio is at or below 33.33%.",
        ],
        "minimum_salary": [
            "Wait until monthly salary reaches the SAMA minimum of SAR 4,000.",
            "Provide updated salary documentation when eligible.",
            "Reapply after meeting the minimum income requirement.",
        ],
        "minimum_age": [
            "Wait until the applicant reaches 21 years of age.",
            "Consider applying with an eligible co-borrower in the meantime.",
            "Reapply after meeting the minimum age requirement.",
        ],
        "maturity_age": [
            "Choose a shorter loan tenor so the applicant is not older than 60 at maturity.",
            "Reduce the loan amount and shorten the term to fit the maturity-age policy.",
            "Reapply with adjusted terms within the policy limits.",
        ],
    },
    "ar": {
        "active_default": [
            "معالجة التعثر النشط في سجل سمة.",
            "مراجعة تقرير سمة للتأكد من صحة البيانات.",
            "إعادة التقديم بعد تحديث السجل الائتماني.",
        ],
        "dbr_limit": [
            "تخفيض مبلغ التمويل أو تمديد مدة السداد.",
            "سداد جزء من الالتزامات القائمة لرفع القدرة على الاقتراض.",
            "إعادة التقديم بعد أن تصبح نسبة عبء الدين 33.33% أو أقل.",
        ],
        "minimum_salary": [
            "الانتظار حتى يصل الراتب الشهري إلى الحد الأدنى وهو 4,000 ريال.",
            "تقديم مستندات راتب محدّثة عند استيفاء الشرط.",
            "إعادة التقديم بعد استيفاء الحد الأدنى للدخل.",
        ],
        "minimum_age": [
            "الانتظار حتى بلوغ المتقدم سن 21 سنة.",
            "النظر في التقديم بضامن مؤهل في غضون ذلك.",
            "إعادة التقديم بعد استيفاء شرط العمر الأدنى.",
        ],
        "maturity_age": [
            "اختيار مدة تمويل أقصر بحيث لا يتجاوز عمر المتقدم 60 سنة عند نهاية التمويل.",
            "تخفيض مبلغ التمويل واختصار المدة لتتوافق مع سياسة العمر عند الاستحقاق.",
            "إعادة التقديم بشروط ضمن حدود السياسة.",
        ],
    },
}


def _normalize_text(value: str) -> str:
    """Whitespace-only normalization for cross-field equality checks. Arabic
    is left as-is — bidi shaping is the renderer's job, not ours."""
    return " ".join(str(value or "").split()).strip()


def deduplicate_list(items: list[str]) -> list[str]:
    """Remove repeated items in-order, comparing on whitespace-normalized text."""
    seen: set[str] = set()
    result: list[str] = []
    for item in items or []:
        key = _normalize_text(item)
        if key and key not in seen:
            result.append(item)
            seen.add(key)
    return result


def _strip_duplicates_against(items: list[str], reserved: list[str]) -> list[str]:
    """Drop any item whose normalized form matches one of `reserved` — used to
    keep concern sentences from leaking into other fields."""
    blocked = {_normalize_text(r) for r in reserved if r}
    return [item for item in items if _normalize_text(item) not in blocked]


def _hard_rule_driver(rules: dict, features: dict) -> list[dict]:
    code = rules.get("code")
    feature = rules.get("feature", "DBR")
    if code == "dbr_limit":
        value = max(0.001, float(features.get("dbr", 0.0)) - 0.3333)
    elif code == "active_default":
        value = max(0.001, float(features.get("max_overdue", 0.0)))
    elif code == "minimum_salary":
        value = max(0.001, 4000.0 - float(features.get("gross_salary", 0.0)))
    elif code == "minimum_age":
        value = max(0.001, 21.0 - float(features.get("age", 0.0)))
    elif code == "maturity_age":
        maturity_age = float(features.get("age", 0.0)) + float(features.get("loan_months", 0.0)) / 12.0
        value = max(0.001, maturity_age - 60.0)
    else:
        value = 0.001

    return [{"feature": feature, "shap_value": value, "direction": "positive"}]


def _hard_rule_response(req: AssessmentRequest, rules: dict, features: dict) -> AssessmentResponse:
    """Short-circuit response when SAMA hard rules fail. No model call, no LLM call.

    Narrative is emitted in BOTH languages so the frontend can switch language
    client-side without re-querying. Each field plays a distinct role:
      - risk_summary: high-level, rule-agnostic context.
      - key_concerns: the specific rule fact (one entry).
      - decision_explanation: WHY the rule matters + WHAT was skipped.
      - key_strengths: empty (no fake strengths on a hard rejection).
      - suggested_actions: 3 unique actionable items, none repeating the concern.
    """
    reason = rules["reason"]  # {"en": ..., "ar": ...}
    code = rules.get("code", "")

    bank_type = req.bank_type
    max_pd = ml_inference.MAX_PD_ALLOWED.get(bank_type, ml_inference.MAX_PD_ALLOWED["conservative"])
    pd_threshold = ml_inference.THRESHOLDS.get(bank_type, ml_inference.THRESHOLDS["conservative"])
    min_score = ml_inference.MIN_SCORES.get(bank_type, ml_inference.MIN_SCORES["conservative"])

    def _build(lang: str) -> dict:
        rs = HARD_RULE_RISK_SUMMARY[lang]
        de = HARD_RULE_EXPLANATIONS[lang].get(code, HARD_RULE_EXPLANATIONS[lang]["dbr_limit"])
        kc = deduplicate_list([reason[lang]])
        sa = deduplicate_list(
            _strip_duplicates_against(
                HARD_RULE_ACTIONS[lang].get(code, HARD_RULE_ACTIONS[lang]["dbr_limit"]),
                kc,
            )
        )
        return {"risk_summary": rs, "decision_explanation": de, "key_concerns": kc, "suggested_actions": sa}

    en = _build("en")
    ar = _build("ar")

    failed_rules = [rules["code"]]
    decision = enforce_decision_consistency(False, failed_rules, "REJECTED")
    gate_results = compute_gate_results(False, None)
    current_dbr = float(features.get("dbr", 0.0)) if features.get("dbr") is not None else None

    return AssessmentResponse(
        passed_hard_rules=False,
        hard_rule_rejection=reason,
        decision=decision,
        risk_level="HIGH",
        failed_rules=failed_rules,
        # Model & pricing were skipped — emit null so logs distinguish "not
        # computed" from "computed as zero".
        pd_prob=None,
        model_pd=None,
        credit_score=None,
        dbr=features["dbr"],
        final_dbr=current_dbr,
        sama_dbr_cap=SAMA_DBR_CAP,
        offered_interest_rate=None,
        final_monthly_payment=None,
        expected_revenue=None,
        expected_loss=None,
        expected_profit=None,
        max_pd_allowed=float(max_pd),
        pd_threshold=float(pd_threshold),
        min_score=int(min_score),
        gate_results=gate_results,
        shap_top5=_hard_rule_driver(rules, features),
        shap_plot_b64="",
        risk_summary={"en": en["risk_summary"], "ar": ar["risk_summary"]},
        key_strengths={"en": [], "ar": []},
        key_concerns={"en": en["key_concerns"], "ar": ar["key_concerns"]},
        decision_explanation={"en": en["decision_explanation"], "ar": ar["decision_explanation"]},
        suggested_actions={"en": en["suggested_actions"], "ar": ar["suggested_actions"]},
    )


def run_assessment(req: AssessmentRequest) -> AssessmentResponse:
    simah_raw = req.simah_profile.get("raw_features", {}) or {}
    features = feature_engineering.build_features(req.model_dump(), simah_raw)

    # Hard rules short-circuit before ML so non-negotiable policy failures do
    # not receive fabricated PD, pricing, or profit values.
    rules = rules_engine.check_hard_rules(features, req.bank_type, req.language)
    if not rules["passed"]:
        return _hard_rule_response(req, rules, features)

    # The post-rule path deliberately separates responsibilities: model scores
    # risk, SHAP explains inputs, and reporter turns verified gate facts into text.
    ml = ml_inference.predict(features, req.bank_type)
    shap = ml_explainer.explain(features)
    llm = llm_reporter.generate(ml, shap, features, req.bank_type, req.language)

    failed_rules = list(ml.get("failed_rules") or [])
    ml["decision"] = enforce_decision_consistency(True, failed_rules, ml.get("decision", "REJECTED"))
    gate_results = compute_gate_results(True, ml)

    return AssessmentResponse(
        passed_hard_rules=True,
        hard_rule_rejection=None,
        dbr=features["dbr"],
        sama_dbr_cap=SAMA_DBR_CAP,
        gate_results=gate_results,
        **ml,
        **shap,
        **llm,
    )
