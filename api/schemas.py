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
    gross_salary: float = Field(..., ge=0)
    loan_amount: float = Field(..., ge=0)
    loan_months: int = Field(..., ge=1)
    employment_type: str = Field(..., description='"government" | "private" | "self"')
    age: int = Field(..., ge=0)
    language: str = Field("en", description='"ar" | "en"')
    simah_profile: dict


class AssessmentResponse(BaseModel):
    # Decision + hard rules
    passed_hard_rules: bool
    # Localized {"en": "...", "ar": "..."} when populated. Null when hard rules passed.
    hard_rule_rejection: Optional[dict[str, str]] = None
    decision: str
    risk_level: str
    failed_rules: list[str] = Field(default_factory=list)

    # Probability of default — null when hard rules failed and the model was
    # never run. Use null (not 0) so logs can distinguish "skipped" from "zero".
    pd_prob: Optional[float] = None
    model_pd: Optional[float] = None
    credit_score: Optional[int] = None

    # DBR — `dbr` is the pre-pricing value used by the SAMA hard-rules engine
    # (computed at the midpoint rate). `final_dbr` is recomputed at the priced
    # rate and is the value compared against the SAMA cap inside the gate logic.
    dbr: float
    final_dbr: Optional[float] = None
    sama_dbr_cap: float

    # Pricing + unit economics — null on hard-rule rejection (pricing skipped).
    offered_interest_rate: Optional[float] = None
    final_monthly_payment: Optional[float] = None
    expected_revenue: Optional[float] = None
    expected_loss: Optional[float] = None
    expected_profit: Optional[float] = None

    # Display-only references for the Decision Logic UI card.
    max_pd_allowed: float
    pd_threshold: float
    min_score: int

    # Per-gate snapshot (pass / fail / skipped). Preferred source of truth for
    # the frontend's Decision Logic card so backend and UI never disagree.
    gate_results: dict[str, str]

    # SHAP
    shap_top5: list[dict[str, Any]]
    shap_plot_b64: str

    # Structured narrative — localized {"en": ..., "ar": ...} so the frontend
    # can switch language client-side without re-querying. Lists carry per-lang
    # arrays of equal logical length.
    risk_summary: dict[str, str]
    key_strengths: dict[str, list[str]]
    key_concerns: dict[str, list[str]]
    decision_explanation: dict[str, str]
    suggested_actions: dict[str, list[str]]
