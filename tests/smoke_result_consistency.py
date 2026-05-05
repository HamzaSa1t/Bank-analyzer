"""Smoke checks for assessment result binding and decision consistency."""

from __future__ import annotations

from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from api.schemas import AssessmentRequest
from api import services


def _stub_llm(ml_result, shap_result, features, bank_type, language):
    failed_rules = ml_result.get("failed_rules") or []
    return {
        "risk_summary": (
            f"The model estimated a default probability of {ml_result['model_pd']:.2%}. "
            f"The final decision is {ml_result['decision']} based on the bank's risk and profitability gates."
        ),
        "key_strengths": ["All five gates passed"] if not failed_rules else [],
        "key_concerns": failed_rules or ["No failed gates were identified."],
        "decision_explanation": (
            f"Expected profit is SAR {ml_result['expected_profit']:,.0f}, "
            f"model PD is {ml_result['model_pd']:.2%}, and final DBR is {ml_result['final_dbr']:.2%}. "
            f"Failed gates: {', '.join(failed_rules) if failed_rules else 'none'}."
        ),
        "suggested_actions": ["Review the assessment outcome."],
    }


def main() -> None:
    services.ml_explainer.explain = lambda features: {"shap_top5": [], "shap_plot_b64": ""}
    services.llm_reporter.generate = _stub_llm

    req = AssessmentRequest(
        bank_type="conservative",
        gross_salary=20000,
        loan_amount=10000,
        loan_months=12,
        employment_type="government",
        age=35,
        language="en",
        simah_profile={
            "raw_features": {
                "BUREAU_DEBT_TOTAL": 0,
                "BUREAU_MAX_OVERDUE": 0,
                "AMT_REQ_CREDIT_BUREAU_MON": 0,
                "BUREAU_CREDIT_AGE_MAX": 2500,
                "BUREAU_DAYS_OVERDUE_MAX": 0,
                "EXT_SOURCE_1": 0.75,
                "EXT_SOURCE_2": 0.80,
                "EXT_SOURCE_3": 0.78,
            }
        },
    )

    result = services.run_assessment(req).model_dump()

    assert result["passed_hard_rules"] is True
    assert result["offered_interest_rate"] > 0
    assert result["final_monthly_payment"] > 0
    assert result["expected_revenue"] > 0
    assert result["expected_loss"] >= 0
    assert result["expected_profit"] is not None
    assert result["decision"] == ("REJECTED" if result["failed_rules"] else "APPROVED")
    assert result["risk_summary"] != "-"
    assert result["decision_explanation"] != "-"

    component = (ROOT / "frontend/src/components/ResultsDashboard.jsx").read_text(encoding="utf-8")
    assert "const approved = result.decision === 'APPROVED'" in component

    print(
        "smoke ok:",
        {
            "decision": result["decision"],
            "failed_rules": result["failed_rules"],
            "offered_interest_rate": result["offered_interest_rate"],
            "final_monthly_payment": result["final_monthly_payment"],
            "expected_revenue": result["expected_revenue"],
            "expected_loss": result["expected_loss"],
            "expected_profit": result["expected_profit"],
        },
    )


if __name__ == "__main__":
    main()
