"""Deterministic structured report — backend facts only.

The model decision (APPROVED / REJECTED), gate outcomes, and numeric values come
from `ml_inference.predict` and `services.compute_gate_results`. This module
turns those facts into the five narrative fields the API exposes
(risk_summary, key_strengths, key_concerns, decision_explanation,
suggested_actions) without ever consulting an LLM, so the narrative cannot
contradict the gate results.

If the external LLM is re-enabled in the future, every output it produces MUST
be passed through `_validate_against_facts` and discarded on contradiction.
"""

from __future__ import annotations

from typing import Any


def _num(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _fmt_pct(value: float, dp: int = 2) -> str:
    return f"{value * 100:.{dp}f}%"


def _fmt_sar(value: float) -> str:
    return f"SAR {value:,.0f}"


def _fmt_sar_ar(value: float) -> str:
    return f"{value:,.0f} ريال"


# Standardized Arabic banking terminology — stored in natural reading order.
# Never write Arabic strings reversed; the renderer handles bidi shaping.
# Forbidden labels (do NOT use): "النسبة المئوية للفوز", "الدرجة السنوية".
AR_LABELS = {
    "model_pd": "احتمالية التعثر من النموذج",
    "max_pd": "الحد الأقصى المسموح",
    "credit_score": "الدرجة الائتمانية",
    "min_score": "الحد الأدنى للدرجة",
    "final_dbr": "نسبة عبء الدين النهائية",
    "sama_cap": "سقف ساما",
    "expected_profit": "الربح المتوقع",
    "expected_loss": "الخسارة المتوقعة",
    "offered_rate": "سعر الفائدة المعروض",
}

# Arabic phrasing for the post-pricing gate codes — used inside the rejected
# decision_explanation so the narrative does not embed English codes
# (e.g. "pd_above_max") inside an Arabic sentence.
AR_RULE_LABELS = {
    "pd_above_max": "تجاوز الحد الأقصى لاحتمالية التعثر",
    "score_below_min": "الدرجة الائتمانية أقل من الحد الأدنى",
    "final_dbr_exceeded": "تجاوز نسبة عبء الدين النهائية لسقف ساما",
    "unprofitable": "الربح المتوقع غير موجب",
}


def _strength_sentence(code: str, ml: dict[str, Any], lang: str) -> str:
    pd_v = _num(ml.get("model_pd"))
    max_pd = _num(ml.get("max_pd_allowed"))
    score = int(_num(ml.get("credit_score")))
    min_score = int(_num(ml.get("min_score")))
    dbr = _num(ml.get("final_dbr"))
    profit = _num(ml.get("expected_profit"))

    if lang == "ar":
        return {
            "pd": f"{AR_LABELS['model_pd']} {_fmt_pct(pd_v)} ضمن {AR_LABELS['max_pd']} ({_fmt_pct(max_pd)}).",
            "score": f"{AR_LABELS['credit_score']} {score} تستوفي {AR_LABELS['min_score']} ({min_score}).",
            "dbr": f"{AR_LABELS['final_dbr']} {_fmt_pct(dbr)} ضمن {AR_LABELS['sama_cap']} (33.33%).",
            "profit": f"{AR_LABELS['expected_profit']} {_fmt_sar_ar(profit)} موجب.",
        }[code]

    return {
        "pd": f"Model PD {_fmt_pct(pd_v)} is within the bank maximum of {_fmt_pct(max_pd)}.",
        "score": f"Credit score {score} meets the bank minimum of {min_score}.",
        "dbr": f"Final DBR {_fmt_pct(dbr)} is within the SAMA cap of 33.33%.",
        "profit": f"Expected profit {_fmt_sar(profit)} is positive.",
    }[code]


def _concern_sentence(code: str, ml: dict[str, Any], lang: str) -> str:
    pd_v = _num(ml.get("model_pd"))
    max_pd = _num(ml.get("max_pd_allowed"))
    score = int(_num(ml.get("credit_score")))
    min_score = int(_num(ml.get("min_score")))
    dbr = _num(ml.get("final_dbr"))
    profit = _num(ml.get("expected_profit"))

    if lang == "ar":
        return {
            "pd_above_max": (
                f"{AR_LABELS['model_pd']} {_fmt_pct(pd_v)} تتجاوز "
                f"{AR_LABELS['max_pd']} ({_fmt_pct(max_pd)})."
            ),
            "score_below_min": (
                f"{AR_LABELS['credit_score']} {score} أقل من "
                f"{AR_LABELS['min_score']} ({min_score})."
            ),
            "final_dbr_exceeded": (
                f"{AR_LABELS['final_dbr']} {_fmt_pct(dbr)} تتجاوز {AR_LABELS['sama_cap']} (33.33%)."
            ),
            "unprofitable": (
                f"{AR_LABELS['expected_profit']} {_fmt_sar_ar(profit)} غير موجب."
            ),
        }.get(code, code)

    return {
        "pd_above_max": (
            f"Model PD is {_fmt_pct(pd_v)}, above the bank maximum of {_fmt_pct(max_pd)}."
        ),
        "score_below_min": (
            f"Credit score is {score}, below the bank minimum of {min_score}."
        ),
        "final_dbr_exceeded": (
            f"Final DBR is {_fmt_pct(dbr)}, above the SAMA cap of 33.33%."
        ),
        "unprofitable": (
            f"Expected profit is {_fmt_sar(profit)}, which is not positive."
        ),
    }.get(code, code)


def _action_for(code: str, lang: str) -> str:
    if lang == "ar":
        return {
            "pd_above_max": "خفّض الالتزامات القائمة أو حسّن السجل الائتماني قبل إعادة التقديم.",
            "score_below_min": "اعمل على رفع الدرجة الائتمانية قبل إعادة التقديم لدى هذا البنك.",
            "final_dbr_exceeded": "خفّض مبلغ التمويل أو مدّد مدة السداد لخفض نسبة عبء الدين.",
            "unprofitable": "أعد التقديم بمبلغ تمويل أو هيكل تسعير يحقق ربحاً موجباً.",
        }.get(code, "راجع تفاصيل الطلب وأعد التقديم وفق سياسة البنك.")
    return {
        "pd_above_max": "Reduce existing debt exposure or improve credit history before reapplying.",
        "score_below_min": "Improve credit score before reapplying to this bank.",
        "final_dbr_exceeded": "Lower the loan amount or extend the tenor to bring final DBR within the SAMA cap.",
        "unprofitable": "Reapply with a loan amount or pricing profile that yields positive expected profit.",
    }.get(code, "Review the application details and reapply per bank policy.")


# Codes that come from the post-pricing ML gates. Anything else in failed_rules
# is a hard rule and is handled by the short-circuit path in api/services.py.
GATE_CODES = ("pd_above_max", "score_below_min", "final_dbr_exceeded", "unprofitable")
PASSED_CODE_FOR = {
    "pd_above_max": "pd",
    "score_below_min": "score",
    "final_dbr_exceeded": "dbr",
    "unprofitable": "profit",
}


def _build_deterministic(ml_result: dict[str, Any], language: str) -> dict[str, Any]:
    lang = language if language in ("ar", "en") else "en"
    decision = str(ml_result.get("decision") or "REJECTED").upper()
    failed = list(ml_result.get("failed_rules") or [])
    failed_set = set(failed)

    pd_v = _num(ml_result.get("model_pd"))
    max_pd = _num(ml_result.get("max_pd_allowed"))
    score = int(_num(ml_result.get("credit_score")))
    min_score = int(_num(ml_result.get("min_score")))
    dbr = _num(ml_result.get("final_dbr"))
    profit = _num(ml_result.get("expected_profit"))

    key_strengths: list[str] = []
    key_concerns: list[str] = []
    for code in GATE_CODES:
        if code in failed_set:
            key_concerns.append(_concern_sentence(code, ml_result, lang))
        else:
            key_strengths.append(_strength_sentence(PASSED_CODE_FOR[code], ml_result, lang))

    suggested_actions = (
        [_action_for(c, lang) for c in failed]
        if failed
        else [
            "Proceed with final documentation and affordability review."
            if lang == "en"
            else "متابعة التوثيق النهائي ومراجعة القدرة على السداد."
        ]
    )

    if decision == "APPROVED":
        if lang == "ar":
            risk_summary = (
                f"تمت الموافقة على الطلب. {AR_LABELS['model_pd']} {_fmt_pct(pd_v)} ضمن "
                f"{AR_LABELS['max_pd']} ({_fmt_pct(max_pd)})، و{AR_LABELS['credit_score']} {score} "
                f"تستوفي {AR_LABELS['min_score']} ({min_score})، و{AR_LABELS['final_dbr']} "
                f"{_fmt_pct(dbr)} ضمن {AR_LABELS['sama_cap']} (33.33%)، و{AR_LABELS['expected_profit']} "
                f"{_fmt_sar_ar(profit)}."
            )
            decision_explanation = (
                f"اجتاز الطلب جميع البوابات: القواعد الإلزامية، "
                f"{AR_LABELS['max_pd']} لاحتمالية التعثر ({_fmt_pct(max_pd)})، "
                f"{AR_LABELS['min_score']} الائتمانية ({min_score})، "
                f"{AR_LABELS['final_dbr']} مقابل {AR_LABELS['sama_cap']} (33.33%)، "
                f"و{AR_LABELS['expected_profit']} الموجب ({_fmt_sar_ar(profit)})."
            )
        else:
            risk_summary = (
                f"The application was approved. Model PD is {_fmt_pct(pd_v)} (max {_fmt_pct(max_pd)}), "
                f"credit score is {score} (min {min_score}), final DBR is {_fmt_pct(dbr)} "
                f"(SAMA cap 33.33%), and expected profit is {_fmt_sar(profit)}."
            )
            decision_explanation = (
                f"All decision gates passed: hard rules, max-PD ({_fmt_pct(max_pd)}), "
                f"minimum credit score ({min_score}), final DBR vs SAMA cap (33.33%), "
                f"and positive expected profit ({_fmt_sar(profit)})."
            )
        # Approved cases must NOT carry fabricated concerns.
        key_concerns = []
    else:
        primary = key_concerns[0] if key_concerns else (
            "تعذّر اجتياز جميع بوابات القرار." if lang == "ar"
            else "The application did not clear all decision gates."
        )
        if lang == "ar":
            risk_summary = (
                f"تم رفض الطلب لعدم اجتياز إحدى بوابات القرار. السبب الأساسي: {primary}"
            )
            failed_text = (
                "، ".join(AR_RULE_LABELS.get(c, c) for c in failed) if failed else "لا يوجد"
            )
            decision_explanation = (
                f"رغم احتساب النموذج والتسعير، أخفقت بوابة واحدة على الأقل. "
                f"البوابات التي لم تُجتَز: {failed_text}. "
                f"{AR_LABELS['model_pd']} {_fmt_pct(pd_v)} مقابل {AR_LABELS['max_pd']} "
                f"{_fmt_pct(max_pd)}، {AR_LABELS['credit_score']} {score} مقابل "
                f"{AR_LABELS['min_score']} {min_score}، "
                f"{AR_LABELS['final_dbr']} {_fmt_pct(dbr)} مقابل {AR_LABELS['sama_cap']} (33.33%)، "
                f"و{AR_LABELS['expected_profit']} {_fmt_sar_ar(profit)}."
            )
        else:
            risk_summary = (
                f"The application was rejected because one or more decision gates failed. "
                f"Primary reason: {primary}"
            )
            failed_text = ", ".join(failed) if failed else "none"
            decision_explanation = (
                f"Although the model and pricing were computed, at least one gate failed "
                f"(failed gates: {failed_text}). Model PD {_fmt_pct(pd_v)} vs max {_fmt_pct(max_pd)}, "
                f"credit score {score} vs min {min_score}, final DBR {_fmt_pct(dbr)} vs SAMA cap 33.33%, "
                f"expected profit {_fmt_sar(profit)}."
            )

    return {
        "risk_summary": risk_summary,
        "key_strengths": key_strengths,
        "key_concerns": key_concerns,
        "decision_explanation": decision_explanation,
        "suggested_actions": suggested_actions,
    }


def _contains_any(haystack: str, needles: list[str]) -> bool:
    text = (haystack or "").lower()
    return any(n.lower() in text for n in needles)


def _validate_against_facts(
    output: dict[str, Any], ml_result: dict[str, Any]
) -> bool:
    """Return False when the LLM contradicts gate results (spec section 4).

    Only used when an external LLM is layered over the deterministic report;
    not invoked in the current code path. Kept here so the validation rules
    live next to the deterministic builder if the LLM polish is re-enabled.
    """
    failed = set(ml_result.get("failed_rules") or [])
    concerns = " ".join(output.get("key_concerns") or [])
    strengths = " ".join(output.get("key_strengths") or [])
    explanation = output.get("decision_explanation") or ""
    summary = output.get("risk_summary") or ""

    if "pd_above_max" in failed:
        if not _contains_any(
            concerns + " " + explanation,
            ["pd", "احتمالية التعثر"],
        ):
            return False
        if _contains_any(
            strengths,
            ["pd is below", "pd within", "pd ضمن", "احتمالية التعثر ضمن"],
        ):
            return False

    if "score_below_min" not in failed:
        if _contains_any(
            concerns,
            ["score is below", "below the minimum", "الدرجة الائتمانية أقل"],
        ):
            return False

    if "unprofitable" not in failed:
        if _contains_any(
            explanation + " " + summary,
            [
                "profit was not computed",
                "profit was not calculated",
                "profit not computed",
                "profit not calculated",
                "profit failed",
                "الربح لم يُحتسب",
            ],
        ):
            return False

    if ml_result.get("expected_profit") is not None:
        if _contains_any(
            explanation + " " + summary,
            ["profit was not calculated", "profit was not computed", "الربح لم يُحتسب"],
        ):
            return False

    return True


def generate(
    ml_result: dict[str, Any],
    shap_result: dict[str, Any],  # noqa: ARG001 — kept for call-site compatibility
    features: dict[str, Any],     # noqa: ARG001
    bank_type: str,               # noqa: ARG001
    language: str,
) -> dict[str, Any]:
    """Build the structured report directly from backend gate results.

    The external LLM is intentionally bypassed (spec section 3, simpler path):
    every prior production failure was a hallucination where the LLM contradicted
    `failed_rules`, so the safest fix is to never let the LLM author the report.
    `_validate_against_facts` is retained for any future polish layer.
    """
    return _build_deterministic(ml_result, language)
