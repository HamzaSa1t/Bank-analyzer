"""Service orchestration — rules → ML → pricing → SHAP → structured LLM."""

from __future__ import annotations

from src import feature_engineering, rules_engine
from src.llm import reporter as llm_reporter
from src.ml import explainer as ml_explainer
from src.ml import inference as ml_inference

from .schemas import AssessmentRequest, AssessmentResponse


HARD_RULE_RECOMMENDATIONS = {
    "en": {
        "active_default": "Resolve the active SIMAH default and reapply after the credit record is updated.",
        "dbr_limit": "Reduce the requested loan amount, extend the tenor, or settle existing obligations until the Debt Burden Ratio is at or below 33.33%.",
        "minimum_salary": "The applicant needs a monthly salary of at least SAR 4,000 before this product can be considered.",
        "minimum_age": "The applicant can reapply after reaching the minimum age requirement of 21 years.",
        "maturity_age": "Choose a shorter loan tenor so the applicant is not older than 60 at loan maturity.",
    },
    "ar": {
        "active_default": "يرجى معالجة التعثر النشط في سجل سمة ثم إعادة التقديم بعد تحديث السجل الائتماني.",
        "dbr_limit": "يرجى تخفيض مبلغ التمويل، أو تمديد مدة السداد، أو سداد جزء من الالتزامات القائمة حتى تصبح نسبة عبء الدين 33.33% أو أقل.",
        "minimum_salary": "يجب أن يكون الراتب الشهري 4,000 ريال على الأقل قبل النظر في هذا المنتج.",
        "minimum_age": "يمكن للمتقدم إعادة التقديم بعد استيفاء شرط العمر الأدنى وهو 21 سنة.",
        "maturity_age": "يرجى اختيار مدة تمويل أقصر بحيث لا يتجاوز عمر المتقدم 60 سنة عند نهاية التمويل.",
    },
}


# Bilingual structured-LLM template for the hard-rule path. The model is bypassed
# entirely here — we synthesize a deterministic narrative so risk_summary and
# decision_explanation say different things, and the suggested next steps are
# consistent across rules.
HARD_RULE_NARRATIVE = {
    "en": {
        "risk_summary": "Application rejected before risk assessment due to a policy rule.",
        "decision_explanation_suffix": "The system skipped model prediction, pricing, and profit evaluation.",
        "suggested_actions": [
            "Resolve the issue and reapply",
            "Review your SIMAH credit report",
            "Ensure all obligations are settled",
        ],
    },
    "ar": {
        "risk_summary": "تم رفض الطلب قبل تقييم المخاطر بسبب قاعدة سياسة.",
        "decision_explanation_suffix": "تم تخطي توقع النموذج والتسعير وتقييم الربحية.",
        "suggested_actions": [
            "معالجة المشكلة وإعادة التقديم",
            "مراجعة تقرير سمة الائتماني",
            "التأكد من سداد جميع الالتزامات",
        ],
    },
}


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


def _hard_rule_recommendation(rules: dict, language: str) -> str:
    lang = language if language in HARD_RULE_RECOMMENDATIONS else "en"
    return HARD_RULE_RECOMMENDATIONS[lang].get(
        rules.get("code"),
        HARD_RULE_RECOMMENDATIONS[lang]["dbr_limit"],
    )


def _hard_rule_response(req: AssessmentRequest, rules: dict, features: dict) -> AssessmentResponse:
    """Short-circuit response when SAMA hard rules fail. No model call, no LLM call."""
    lang = req.language if req.language in ("ar", "en") else "en"
    reason = rules["reason"]
    recommendation = _hard_rule_recommendation(rules, lang)
    narrative = HARD_RULE_NARRATIVE[lang]

    bank_type = req.bank_type
    max_pd = ml_inference.MAX_PD_ALLOWED.get(bank_type, ml_inference.MAX_PD_ALLOWED["conservative"])
    pd_threshold = ml_inference.THRESHOLDS.get(bank_type, ml_inference.THRESHOLDS["conservative"])
    min_score = ml_inference.MIN_SCORES.get(bank_type, ml_inference.MIN_SCORES["conservative"])

    # Make risk_summary and decision_explanation say different things — the spec
    # explicitly forbids restating the same sentence twice. The recommendation
    # leads the suggested_actions list so the rule-specific guidance shows first.
    suggested_actions = [recommendation, *narrative["suggested_actions"]]
    decision_explanation = f"{reason}. {narrative['decision_explanation_suffix']}"

    return AssessmentResponse(
        passed_hard_rules=False,
        hard_rule_rejection=reason,
        decision="REJECTED",
        risk_level="HIGH",
        failed_rules=[rules["code"]],
        pd_prob=0.0,
        model_pd=0.0,
        credit_score=0,
        dbr=features["dbr"],
        final_dbr=features["dbr"],
        offered_interest_rate=0.0,
        final_monthly_payment=0.0,
        expected_revenue=0.0,
        expected_loss=0.0,
        expected_profit=0.0,
        max_pd_allowed=float(max_pd),
        pd_threshold=float(pd_threshold),
        min_score=int(min_score),
        shap_top5=_hard_rule_driver(rules, features),
        shap_plot_b64="",
        risk_summary=narrative["risk_summary"],
        key_strengths=[],
        key_concerns=[reason],
        decision_explanation=decision_explanation,
        suggested_actions=suggested_actions,
    )


def run_assessment(req: AssessmentRequest) -> AssessmentResponse:
    simah_raw = req.simah_profile.get("raw_features", {}) or {}
    features = feature_engineering.build_features(req.model_dump(), simah_raw)

    rules = rules_engine.check_hard_rules(features, req.bank_type, req.language)
    if not rules["passed"]:
        return _hard_rule_response(req, rules, features)

    ml = ml_inference.predict(features, req.bank_type)
    shap = ml_explainer.explain(features)
    llm = llm_reporter.generate(ml, shap, features, req.bank_type, req.language)

    return AssessmentResponse(
        passed_hard_rules=True,
        hard_rule_rejection=None,
        dbr=features["dbr"],
        **ml,
        **shap,
        **llm,
    )
