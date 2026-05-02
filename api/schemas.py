"""Pydantic schemas for the FastAPI surface."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class SimahProfile(BaseModel):
    total_debt: float
    max_overdue: float
    inquiries_last_month: int
    credit_history_days: int
    max_dpd: int
    raw_features: dict[str, Any]


class AssessmentRequest(BaseModel):
    bank_type: str = Field(..., description='"conservative" | "aggressive"')
    gross_salary: float
    loan_amount: float
    loan_months: int
    employment_type: str = Field(..., description='"government" | "private" | "self"')
    age: int
    language: str = Field("en", description='"ar" | "en"')
    simah_profile: dict


class AssessmentResponse(BaseModel):
    passed_hard_rules: bool
    hard_rule_rejection: Optional[str] = None
    pd_prob: float
    credit_score: int
    decision: str
    risk_level: str
    dbr: float
    shap_top5: list[dict[str, Any]]
    shap_plot_b64: str
    llm_reason: str
    llm_recommendation: str
