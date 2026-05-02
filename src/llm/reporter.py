"""LLM reporter — ChatGroq + PydanticOutputParser, bilingual fallback on error."""

from __future__ import annotations

import os
from typing import Any

from dotenv import load_dotenv
from pydantic import BaseModel, Field

from src.feature_labels import pretty_feature

load_dotenv()


class LLMOutput(BaseModel):
    reason: str = Field(..., description="Plain-language explanation of the decision, grounded in SHAP drivers.")
    recommendation: str = Field(..., description="Actionable recommendation for the applicant.")


FALLBACK = {
    "ar": {
        "reason": "تعذّر توليد شرح تفصيلي حالياً. القرار مبني على درجة المخاطر والعوامل المؤثرة في نموذج التقييم.",
        "recommendation": "يرجى مراجعة تفاصيل الطلب والمحاولة لاحقاً، أو التواصل مع الفرع لمراجعة الحالة يدوياً.",
    },
    "en": {
        "reason": "Detailed explanation is currently unavailable. The decision is based on the model's risk score and the listed contributing factors.",
        "recommendation": "Please review the application details and try again later, or contact the branch for a manual review.",
    },
}


SYSTEM_PROMPT = (
    "You are a senior Saudi credit officer. Produce a concise decision narrative for a retail loan application. "
    "Base your reasoning ONLY on the provided SHAP drivers and numeric features. Do not invent facts. "
    "Do not give legal advice. Keep each field to 2-4 sentences. Respond in the requested language."
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
             language: str) -> dict[str, str]:
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
            f"PD probability: {ml_result.get('pd_prob'):.4f}\n"
            f"Credit score: {ml_result.get('credit_score')}\n"
            f"Risk level: {ml_result.get('risk_level')}\n"
            f"DBR: {features.get('dbr', 0):.4f}\n"
            f"Gross salary: {features.get('gross_salary')}\n"
            f"Loan amount: {features.get('loan_amount')}\n"
            f"Top SHAP drivers:\n{_format_shap(shap_result.get('shap_top5', []))}\n\n"
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
        return {"llm_reason": parsed.reason, "llm_recommendation": parsed.recommendation}
    except Exception:
        fb = FALLBACK[lang]
        return {"llm_reason": fb["reason"], "llm_recommendation": fb["recommendation"]}
