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
    # Decision + hard rules
    passed_hard_rules: bool
    hard_rule_rejection: Optional[str] = None
    decision: str
    risk_level: str
    failed_rules: list[str] = []

    # Probability of default
    pd_prob: float
    model_pd: float
    credit_score: int

    # DBR — `dbr` is the pre-pricing value used by the SAMA hard-rules engine
    # (computed at the midpoint rate). `final_dbr` is recomputed at the priced
    # rate and is the value compared against the SAMA cap inside the gate logic.
    dbr: float
    final_dbr: float

    # Pricing + unit economics
    offered_interest_rate: float
    final_monthly_payment: float
    expected_revenue: float
    expected_loss: float
    expected_profit: float

    # Display-only references for the Decision Logic UI card.
    max_pd_allowed: float
    pd_threshold: float
    min_score: int

    # SHAP
    shap_top5: list[dict[str, Any]]
    shap_plot_b64: str

    # Structured LLM narrative (replaces llm_reason / llm_recommendation).
    risk_summary: str
    key_strengths: list[str]
    key_concerns: list[str]
    decision_explanation: str
    suggested_actions: list[str]
