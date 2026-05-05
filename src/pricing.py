"""Risk-based pricing and unit-economics for retail loans.

Two pure functions:
- get_interest_rate(pd, bank_type) — base rate + PD-banded risk premium per bank.
- compute_financials(pd, loan_amount, loan_months, annual_rate, lgd) — standard
  amortization plus expected-loss / revenue / profit accounting.

Constants come from edits.md spec. LGD default 0.45 matches Basel retail-mortgage
convention; expected_loss = PD * LGD * EAD (with EAD ≈ loan_amount as a simple
proxy at origination).
"""

from __future__ import annotations


def get_interest_rate(pd: float, bank_type: str) -> float:
    """Annualized rate offered to the applicant. Higher PD → higher premium."""
    if bank_type == "conservative":
        base = 0.03
        # Conservative pricing keeps spreads narrow, so high-PD applicants are
        # more likely to fail the profitability/PD gates than be repriced upward.
        if pd < 0.03:
            premium = 0.01
        elif pd < 0.06:
            premium = 0.02
        else:
            premium = 0.04
        return base + premium

    if bank_type == "aggressive":
        base = 0.05
        # Aggressive pricing accepts more risk only when the premium can pay for
        # expected loss and still leave positive unit economics.
        if pd < 0.05:
            premium = 0.03
        elif pd < 0.10:
            premium = 0.07
        elif pd < 0.20:
            premium = 0.12
        else:
            premium = 0.18
        return base + premium

    # Unknown bank type — fall back to conservative pricing.
    return get_interest_rate(pd, "conservative")


def compute_financials(
    pd: float,
    loan_amount: float,
    loan_months: int,
    annual_rate: float,
    lgd: float = 0.45,
) -> dict[str, float]:
    """Amortized payment + revenue/expected-loss/profit at origination."""
    # Profit is intentionally simple and transparent: interest revenue minus
    # expected credit loss at origination, not a full lifetime balance-sheet model.
    monthly_rate = annual_rate / 12.0
    growth = (1.0 + monthly_rate) ** loan_months
    monthly_payment = loan_amount * (monthly_rate * growth) / (growth - 1.0)
    total_payment = monthly_payment * loan_months

    revenue = total_payment - loan_amount
    expected_loss = pd * lgd * loan_amount
    profit = revenue - expected_loss

    return {
        "monthly_payment": float(monthly_payment),
        "total_payment": float(total_payment),
        "revenue": float(revenue),
        "expected_loss": float(expected_loss),
        "profit": float(profit),
    }
