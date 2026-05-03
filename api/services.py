"""Service orchestration — rules → ML → SHAP → LLM."""

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


def run_assessment(req: AssessmentRequest) -> AssessmentResponse:
    simah_raw = req.simah_profile.get("raw_features", {}) or {}
    features = feature_engineering.build_features(req.model_dump(), simah_raw)

    rules = rules_engine.check_hard_rules(features, req.bank_type, req.language)
    if not rules["passed"]:
        return AssessmentResponse(
            passed_hard_rules=False,
            hard_rule_rejection=rules["reason"],
            pd_prob=0.0,
            credit_score=0,
            decision="REJECTED",
            risk_level="HIGH",
            dbr=features["dbr"],
            shap_top5=_hard_rule_driver(rules, features),
            shap_plot_b64="",
            llm_reason=rules["reason"],
            llm_recommendation=_hard_rule_recommendation(rules, req.language),
        )

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
