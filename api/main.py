"""FastAPI entry, CORS for Vite dev server, SIMAH cache on startup."""

from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from src import data_loader

from .schemas import AssessmentRequest, AssessmentResponse, SimahProfile
from .services import run_assessment

ROOT = Path(__file__).resolve().parents[1]
FEATURES_CSV = ROOT / "data" / "processed" / "features.csv"
MODEL_PATH = ROOT / "models" / "model.pkl"
FEATURE_COLS_PATH = ROOT / "models" / "feature_cols.pkl"
METRICS_PATH = ROOT / "models" / "metrics.json"
CALIBRATION_PATH = ROOT / "models" / "calibration_buckets.json"
DRIVERS_PATH = ROOT / "models" / "feature_importance.json"
POLICY_THRESHOLDS = {"conservative": 0.05, "aggressive": 0.15}

app = FastAPI(title="Credit Risk Analyzer", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _cache_simah() -> None:
    try:
        app.state.simah_df = data_loader.get_simah_profiles()
    except Exception as exc:  # noqa: BLE001
        app.state.simah_df = None
        app.state.simah_error = str(exc)


def _clean(value: Any) -> Any:
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return 0.0
    return value


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/simulate-simah", response_model=SimahProfile)
def simulate_simah() -> SimahProfile:
    df: pd.DataFrame | None = getattr(app.state, "simah_df", None)
    if df is None or df.empty:
        raise HTTPException(status_code=503, detail="SIMAH profiles unavailable. Did the dataset load?")

    row = df.sample(n=1, random_state=None).iloc[0]
    raw = {k: _clean(v) for k, v in row.to_dict().items()}

    # Fields kept on stable names for the frontend; populated from the new
    # BUREAU_* aggregates produced by src/preprocessing.py.
    return SimahProfile(
        total_debt=float(raw.get("BUREAU_DEBT_TOTAL") or 0.0),
        max_overdue=float(raw.get("BUREAU_MAX_OVERDUE") or 0.0),
        inquiries_last_month=int(float(raw.get("AMT_REQ_CREDIT_BUREAU_MON") or 0)),
        credit_history_days=int(float(raw.get("BUREAU_CREDIT_AGE_MAX") or 0)),
        max_dpd=int(float(raw.get("BUREAU_DAYS_OVERDUE_MAX") or 0)),
        raw_features=raw,
    )


@app.post("/assess", response_model=AssessmentResponse)
def assess(req: AssessmentRequest) -> AssessmentResponse:
    return run_assessment(req)


@app.get("/model-performance")
@lru_cache(maxsize=1)
def computed_model_performance() -> dict[str, dict[str, float]]:
    """Return policy metrics from the OOF threshold report saved by src/train.py.

    The final model in models/model.pkl is retrained on the FULL dataset, so any
    re-evaluation here would leak. metrics.json carries the unbiased OOF numbers
    (5-fold StratifiedKFold) — read those.
    """
    if not METRICS_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail="metrics.json missing - run `python src/train.py` first.",
        )

    metrics = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
    thresholds = metrics.get("thresholds", {})

    def _pick(key: str) -> dict[str, float]:
        block = thresholds.get(key)
        if not block:
            raise HTTPException(
                status_code=503,
                detail=f"metrics.json missing thresholds.{key} - retrain the model.",
            )
        return {
            "threshold": float(block["threshold"]),
            "precision": float(block["precision"]),
            "recall": float(block["recall"]),
            "f1": float(block["f1"]),
            "approval_rate": float(block["approval_rate"]),
        }

    return {
        "conservative": _pick("conservative_0.05"),
        "aggressive": _pick("aggressive_0.15"),
    }


@app.get("/metrics-summary")
@lru_cache(maxsize=1)
def metrics_summary() -> dict[str, Any]:
    """Headline metrics for the model-performance page hero/gauge tiles."""
    if not METRICS_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail="metrics.json missing - run `python src/train.py` first.",
        )
    metrics = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
    cv = metrics.get("cv") or {}
    return {
        "oof_auc": float(metrics.get("auc_roc", 0.0)),
        "brier_score": float(metrics.get("brier_score", 0.0)),
        "pr_auc": float(metrics.get("pr_auc", 0.0)),
        "n_total": int(metrics.get("n_total", 0)),
        "positive_rate": float(metrics.get("positive_rate", 0.0)),
        "feature_count": int(metrics.get("feature_count", 0)),
        "validation_method": str(metrics.get("validation_method", "")),
        "mean_val_auc": float(cv.get("mean_val_auc", 0.0)),
        "std_val_auc": float(cv.get("std_val_auc", 0.0)),
        "mean_train_auc": float(cv.get("mean_train_auc", 0.0)),
        "train_val_gap": float(cv.get("train_val_gap", 0.0)),
        "n_splits": int(cv.get("n_splits", 0)),
    }


@app.get("/calibration")
@lru_cache(maxsize=1)
def calibration_payload() -> dict[str, Any]:
    """Reliability buckets computed on OOF predictions (calibration_check.py)."""
    if not CALIBRATION_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail="calibration_buckets.json missing - run `python src/calibration_check.py`.",
        )
    return json.loads(CALIBRATION_PATH.read_text(encoding="utf-8"))


@app.get("/feature-importance")
@lru_cache(maxsize=1)
def feature_importance_payload() -> dict[str, Any]:
    """Top SHAP drivers from the final model (feature_importance.py)."""
    if not DRIVERS_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail="feature_importance.json missing - run `python src/feature_importance.py`.",
        )
    return json.loads(DRIVERS_PATH.read_text(encoding="utf-8"))
