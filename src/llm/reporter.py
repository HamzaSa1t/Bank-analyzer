"""LLM reporter — ChatGroq + PydanticOutputParser, structured 5-field output.

The model is asked to reason in numbers: PD vs MAX_PD_ALLOWED (the actual gate)
and PD vs pd_threshold (display reference); profit vs expected_loss; final_dbr
vs SAMA cap; credit_score vs min_score.
"""

from __future__ import annotations

import os
from typing import Any

from dotenv import load_dotenv
from pydantic import BaseModel, Field

from src.feature_labels import pretty_feature

load_dotenv()


class LLMOutput(BaseModel):
    risk_summary: str = Field(..., description="One-paragraph plain-language summary of the applicant's risk profile.")
    key_strengths: list[str] = Field(..., description="Bullet points of strengths supporting the application.")
    key_concerns: list[str] = Field(..., description="Bullet points of concerns or risk factors.")
    decision_explanation: str = Field(..., description="Why the decision was made, grounded in numbers (PD, profit, DBR, score).")
    suggested_actions: list[str] = Field(..., description="Actionable next steps for the applicant.")


FALLBACK = {
    "ar": {
        "risk_summary": "تعذّر توليد التحليل التفصيلي حالياً. القرار مبني على درجة المخاطر والعوامل المؤثرة في نموذج التقييم.",
        "key_strengths": [],
        "key_concerns": [],
        "decision_explanation": "القرار مبني على البوابات الخمسة: القواعد الإلزامية، حد PD، الحد الأدنى للدرجة الائتمانية، نسبة عبء الدين النهائية، والربح المتوقع.",
        "suggested_actions": ["يرجى مراجعة تفاصيل الطلب والمحاولة لاحقاً، أو التواصل مع الفرع لمراجعة الحالة يدوياً."],
    },
    "en": {
        "risk_summary": "A detailed risk narrative is currently unavailable. The decision is based on the model's risk score and the listed contributing factors.",
        "key_strengths": [],
        "key_concerns": [],
        "decision_explanation": "The decision was made by evaluating five gates: hard rules, max-PD ceiling, minimum credit score, final DBR vs SAMA cap, and expected profit.",
        "suggested_actions": ["Please review the application details and try again later, or contact the branch for a manual review."],
    },
}


SYSTEM_PROMPT = (
    "You are a senior Saudi credit officer producing a structured decision narrative for a retail loan application. "
    "Reason ONLY from the numbers and SHAP drivers provided — do not invent facts and do not give legal advice. "
    "\n\n"
    "When the model decision is used (no hard-rule failure):\n"
    "- Ground every sentence in numbers. Quote model_pd vs max_pd_allowed (the binding gate) AND vs pd_threshold "
    "(preferred reference). Quote credit_score vs min_score. Quote final_dbr vs the 33.33% SAMA cap. Quote "
    "expected_profit against expected_loss in SAR.\n"
    "- Example sentence style: 'The model predicted PD of 7.2%, below the bank's max of 8.0%. Expected profit of "
    "SAR 2,300 against a SAR 450 expected loss supports approval.'\n"
    "\n"
    "When hard rules fail (failed_rules contains a rule code such as active_default, minimum_salary, minimum_age, "
    "maturity_age, or dbr_limit):\n"
    "- State explicitly that the application was rejected BEFORE ML scoring and that PD, pricing, and profit were "
    "NOT computed.\n"
    "- Explain WHY the failed rule matters in business terms (e.g. an active default signals high default risk; a "
    "salary below the minimum fails SAMA eligibility).\n"
    "- Provide actionable next steps the applicant can take.\n"
    "- Do NOT repeat the same sentence in different fields.\n"
    "\n"
    "Output rules:\n"
    "- risk_summary and decision_explanation MUST add different information; never paraphrase the same sentence in both.\n"
    "- risk_summary: 2-3 sentences summarizing the applicant's overall risk posture.\n"
    "- decision_explanation: 2-4 sentences walking through the gate(s) that drove the decision, with numbers.\n"
    "- key_strengths, key_concerns, suggested_actions: 2-4 short bullets each, no full paragraphs.\n"
    "- Respond entirely in the requested language."
)


def _format_shap(shap_top5: list[dict[str, Any]]) -> str:
    lines = []
    for item in shap_top5:
        label = pretty_feature(item["feature"])
        lines.append(f"- {label}: value={item['shap_value']:.4f} ({item['direction']})")
    return "\n".join(lines) if lines else "(no SHAP drivers available)"


def generate(ml_result: dict[str, Any],
             shap_result: dict[str, Any],
             features: dict[str, Any],
             bank_type: str,
             language: str) -> dict[str, Any]:
    lang = language if language in ("ar", "en") else "en"

    try:
        from langchain_groq import ChatGroq
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_core.output_parsers import PydanticOutputParser

        parser = PydanticOutputParser(pydantic_object=LLMOutput)

        human_body = (
            f"Language: {lang}\n"
            f"Bank profile: {bank_type}\n"
            f"Decision: {ml_result.get('decision')}\n"
            f"Failed rules: {ml_result.get('failed_rules', [])}\n"
            f"\n"
            f"--- Risk numbers ---\n"
            f"model_pd: {ml_result.get('model_pd', ml_result.get('pd_prob', 0)):.4f}\n"
            f"max_pd_allowed (binding gate): {ml_result.get('max_pd_allowed', 0):.4f}\n"
            f"pd_threshold (preferred reference): {ml_result.get('pd_threshold', 0):.4f}\n"
            f"credit_score: {ml_result.get('credit_score')}\n"
            f"min_score: {ml_result.get('min_score')}\n"
            f"risk_level: {ml_result.get('risk_level')}\n"
            f"\n"
            f"--- Pricing & unit economics ---\n"
            f"offered_interest_rate: {ml_result.get('offered_interest_rate', 0) * 100:.2f}%\n"
            f"loan_amount: {features.get('loan_amount')}\n"
            f"loan_months: {features.get('loan_months')}\n"
            f"final_monthly_payment: {ml_result.get('final_monthly_payment', 0):.2f}\n"
            f"expected_revenue: {ml_result.get('expected_revenue', 0):.2f}\n"
            f"expected_loss: {ml_result.get('expected_loss', 0):.2f}\n"
            f"expected_profit: {ml_result.get('expected_profit', 0):.2f}\n"
            f"\n"
            f"--- DBR ---\n"
            f"final_dbr (priced): {ml_result.get('final_dbr', 0):.4f}\n"
            f"SAMA cap: 0.3333\n"
            f"gross_salary: {features.get('gross_salary')}\n"
            f"\n"
            f"--- Top SHAP drivers ---\n"
            f"{_format_shap(shap_result.get('shap_top5', []))}\n\n"
            "{format_instructions}"
        )

        prompt = ChatPromptTemplate.from_messages([
            ("system", SYSTEM_PROMPT),
            ("human", human_body),
        ]).partial(format_instructions=parser.get_format_instructions())

        llm = ChatGroq(
            model="llama-3.1-8b-instant",
            temperature=0.2,
            api_key=os.getenv("GROQ_API_KEY"),
        )
        chain = prompt | llm | parser
        parsed: LLMOutput = chain.invoke({})
        return {
            "risk_summary": parsed.risk_summary,
            "key_strengths": list(parsed.key_strengths),
            "key_concerns": list(parsed.key_concerns),
            "decision_explanation": parsed.decision_explanation,
            "suggested_actions": list(parsed.suggested_actions),
        }
    except Exception:
        fb = FALLBACK[lang]
        return {
            "risk_summary": fb["risk_summary"],
            "key_strengths": list(fb["key_strengths"]),
            "key_concerns": list(fb["key_concerns"]),
            "decision_explanation": fb["decision_explanation"],
            "suggested_actions": list(fb["suggested_actions"]),
        }
