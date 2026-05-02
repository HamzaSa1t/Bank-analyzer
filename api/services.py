"""Service orchestration — rules → ML → SHAP → LLM."""

from __future__ import annotations

from src import feature_engineering, rules_engine
from src.llm import reporter as llm_reporter
from src.ml import explainer as ml_explainer
from src.ml import inference as ml_inference

from .schemas import AssessmentRequest, AssessmentResponse


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
            shap_top5=[],
            shap_plot_b64="",
            llm_reason="",
            llm_recommendation="",
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
