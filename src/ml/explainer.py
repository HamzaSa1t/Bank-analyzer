"""SHAP explainer — returns top-5 contributions + base64 waterfall PNG.

This module computes per-prediction feature attributions using TreeSHAP, which
exactly decomposes the XGBoost score into an additive sum of feature contributions:

    log-odds(prediction) = base_value + Σ shap_value[i]

A POSITIVE shap_value pushes the prediction toward "default" (raises PD).
A NEGATIVE shap_value pushes it toward "non-default" (lowers PD).
"""

from __future__ import annotations

import base64
import io
from typing import Any

import matplotlib
# 'Agg' is a headless backend — required because uvicorn runs without a display.
# Without this, matplotlib tries to open a Tk window and crashes.
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import shap

from .inference import _load, _vector_for


# Cache the explainer at module level. shap.TreeExplainer construction is cheap
# but reusing the instance keeps state (e.g. expected_value) stable.
_explainer = None


def _get_explainer():
    global _explainer
    if _explainer is None:
        model, _ = _load()
        _explainer = shap.TreeExplainer(model)
    return _explainer


def explain(features: dict[str, Any], model: Any = None) -> dict[str, Any]:
    """Compute SHAP values for one applicant and return the top-5 + a waterfall PNG."""
    _, order = _load()
    # Reuses the SAME _vector_for from inference.py — so SHAP sees the exact
    # same input the model scored. Now that the categorical-encoding bug
    # (BUGS #1-#3) is fixed in feature_engineering._vectorize, SHAP values
    # for one-hot columns reflect the applicant's actual category, not zeros.
    X = _vector_for(features, order)

    explainer = _get_explainer()
    shap_values = explainer.shap_values(X)

    # Some SHAP versions return a list (one element per class) for binary
    # classifiers; newer versions return a single ndarray. Normalize to ndarray.
    if isinstance(shap_values, list):
        shap_arr = np.asarray(shap_values[1])  # class=1 (default)
    else:
        shap_arr = np.asarray(shap_values)
    row = shap_arr[0]  # we only ever pass one row at a time

    # Top 5 by absolute magnitude — these are the biggest drivers of THIS prediction.
    abs_idx = np.argsort(-np.abs(row))[:5]
    top5 = []
    for i in abs_idx:
        top5.append({
            "feature": order[int(i)],
            "shap_value": float(row[int(i)]),
            "direction": "positive" if row[int(i)] > 0 else "negative",
            # 'positive' direction means "raised PD" → bad for the applicant.
            # The frontend colors red for positive, green for negative.
        })

    # ------------------------------------------------------------------
    # Waterfall plot — PNG returned to the frontend as base64.
    # Shows the decomposition: base_value → +/- shap contributions → final prediction.
    # ------------------------------------------------------------------
    try:
        # base_values for binary XGB can be a scalar or a 2-element array
        # depending on shap version. Normalize to a single float.
        expected_value = explainer.expected_value
        if isinstance(expected_value, (list, np.ndarray)) and np.ndim(expected_value) > 0:
            expected_value = float(np.asarray(expected_value).flatten()[-1])

        explanation = shap.Explanation(
            values=row,
            base_values=expected_value,
            data=X[0],
            feature_names=order,
        )
        plt.figure(figsize=(8, 5))
        shap.plots.waterfall(explanation, max_display=10, show=False)

        # Render to in-memory PNG → base64. Saves an HTTP round-trip vs. serving
        # the image as a separate static asset.
        buf = io.BytesIO()
        plt.tight_layout()
        plt.savefig(buf, format="png", dpi=100, bbox_inches="tight")
        plt.close("all")
        buf.seek(0)
        b64 = base64.b64encode(buf.read()).decode("ascii")
    except Exception:
        # If shap's waterfall plot fails (version skew, missing fonts, etc.),
        # fall back to a simple bar chart of the top-5. Better than no plot.
        b64 = _fallback_plot(top5)

    return {"shap_top5": top5, "shap_plot_b64": b64}


def _fallback_plot(top5: list[dict[str, Any]]) -> str:
    """Simple horizontal bar chart used when the SHAP waterfall plot raises."""
    fig, ax = plt.subplots(figsize=(8, 4))
    # Reverse so the largest magnitude is at the top of the chart.
    names = [t["feature"] for t in top5][::-1]
    vals = [t["shap_value"] for t in top5][::-1]
    # Red = raises PD (bad), Green = lowers PD (good) — same color semantics as the UI.
    colors = ["#d62728" if v > 0 else "#2ca02c" for v in vals]
    ax.barh(names, vals, color=colors)
    ax.set_xlabel("SHAP value")
    ax.set_title("Top drivers")
    buf = io.BytesIO()
    plt.tight_layout()
    plt.savefig(buf, format="png", dpi=100, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("ascii")
