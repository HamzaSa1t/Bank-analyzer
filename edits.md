You are a senior full-stack engineer. Fix the current assessment result bugs. The UI is good, but the backend/data binding is producing inconsistent results.

## Problems observed

For a normal non-hard-rule application:

* Model PD shows 8.13%
* Financial Breakdown shows:

  * offered_interest_rate = 0.00%
  * final_monthly_payment = SAR 0
  * expected_revenue = SAR 0
  * expected_loss = SAR 0
  * expected_profit = SAR 0
* Decision Logic shows failed gates, but the banner says Approved
* “Why approved” says all five gates passed even when PD and profit gates failed
* LLM output shows "-" for risk summary and decision explanation

## Goal

Make backend response, decision logic, financial values, why block, and LLM output consistent.

---

# 1. Fix backend pricing + financial calculation

In `src/ml/inference.py`, verify that after `pd_prob` is computed, the following always runs for non-hard-rule applications:

```python
interest_rate = get_interest_rate(pd_prob, bank_type)

financials = compute_financials(
    pd=pd_prob,
    loan_amount=float(features["loan_amount"]),
    loan_months=int(features["loan_months"]),
    annual_rate=interest_rate,
)
```

Return these fields with non-zero values when appropriate:

```python
offered_interest_rate = interest_rate
final_monthly_payment = financials["monthly_payment"]
expected_revenue = financials["revenue"]
expected_loss = financials["expected_loss"]
expected_profit = financials["profit"]
```

Do not default these to zero unless it is a hard-rule rejection where the model/pricing was skipped.

---

# 2. Fix final decision source of truth

Final decision must be computed only from the 5 gates:

```python
failed_rules = []

if pd_prob > max_pd_allowed:
    failed_rules.append("pd_above_max")

if credit_score < min_score:
    failed_rules.append("score_below_min")

if final_dbr > SAMA_DBR_CAP:
    failed_rules.append("final_dbr_exceeded")

if financials["profit"] <= 0:
    failed_rules.append("unprofitable")

decision = "APPROVED" if len(failed_rules) == 0 else "REJECTED"
```

Hard-rule failures still short-circuit before model/pricing and should return `decision = "REJECTED"`.

---

# 3. Fix field naming consistency

Audit backend and frontend field names.

Backend response should use:

```python
model_pd
offered_interest_rate
final_monthly_payment
final_dbr
expected_revenue
expected_loss
expected_profit
max_pd_allowed
pd_threshold
min_score
failed_rules
decision
```

Frontend must consume exactly these names. Do not mix old names like `pd_prob`, `interest_rate`, `monthly_payment`, or `profit` unless there is a deliberate fallback.

---

# 4. Fix ResultsDashboard UI logic

In `frontend/src/components/ResultsDashboard.jsx`:

## A. Decision banner

Use only:

```javascript
result.decision
```

Do not infer approval from unrelated flags.

## B. Why Approved / Why Rejected

Do not use static text.

If:

```javascript
result.decision === "APPROVED"
```

show:

```text
The application cleared all required gates: hard rules, max PD ceiling, minimum credit score, final DBR vs SAMA cap, and expected profit.
```

Only show this if `failed_rules.length === 0`.

If rejected, show bullet reasons based on `failed_rules`, for example:

* `pd_above_max` → Model PD exceeds the selected bank's maximum risk limit.
* `score_below_min` → Credit score is below the selected bank's minimum requirement.
* `final_dbr_exceeded` → Final DBR after pricing exceeds the SAMA cap.
* `unprofitable` → Expected profit is not positive.
* hard-rule codes → translated existing hard-rule reason.

Never show “Why approved” if any gate failed.

---

# 5. Fix Financial Breakdown rendering

For non-hard-rule results:

Display actual values from:

```javascript
result.model_pd
result.offered_interest_rate
result.final_monthly_payment
result.final_dbr
result.expected_revenue
result.expected_loss
result.expected_profit
```

If any required numeric field is missing or null, show `"Unavailable"` instead of `0`.

Do not silently convert missing values to zero.

For hard-rule rejection:

Hide Financial Breakdown and show skipped status instead.

---

# 6. Fix LLM output

In `src/llm/reporter.py` and `api/services.py`:

Ensure normal model/pricing branch passes all relevant numbers into the LLM:

```python
model_pd
max_pd_allowed
pd_threshold
credit_score
min_score
offered_interest_rate
final_monthly_payment
final_dbr
expected_revenue
expected_loss
expected_profit
decision
failed_rules
```

If the external LLM fails or returns empty fields, use a deterministic fallback that is NOT "-".

Fallback example:

```python
risk_summary = (
    f"The model estimated a default probability of {model_pd:.2%}. "
    f"The final decision is {decision} based on the bank's risk and profitability gates."
)

decision_explanation = (
    f"Expected profit is SAR {expected_profit:,.0f}, model PD is {model_pd:.2%}, "
    f"and final DBR is {final_dbr:.2%}. Failed gates: {', '.join(failed_rules) if failed_rules else 'none'}."
)
```

For approved cases, `key_strengths` should include passed gates.
For rejected cases, `key_concerns` should include failed gates.
`suggested_actions` should not be empty.

---

# 7. Add quick smoke logs/tests

Add or run a smoke test confirming:

* A normal non-hard-rule request returns:

  * offered_interest_rate > 0
  * final_monthly_payment > 0
  * expected_revenue > 0
  * expected_loss >= 0
  * expected_profit computed
* If failed_rules is not empty, decision is REJECTED
* If failed_rules is empty, decision is APPROVED
* Frontend displays the same decision as backend

---

# Do not change

* ML model
* SHAP logic
* Credit score formula
* Pricing bands unless needed to fix wiring
* Model Performance page

Return only modified code and a short smoke-test summary.
