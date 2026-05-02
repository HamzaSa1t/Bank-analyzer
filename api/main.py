"""FastAPI entry, CORS for Vite dev server, SIMAH cache on startup."""

from __future__ import annotations

import math
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sklearn.metrics import f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split

from src import data_loader

from .schemas import AssessmentRequest, AssessmentResponse, SimahProfile
from .services import run_assessment

ROOT = Path(__file__).resolve().parents[1]
FEATURES_CSV = ROOT / "data" / "processed" / "features.csv"
MODEL_PATH = ROOT / "models" / "model.pkl"
FEATURE_COLS_PATH = ROOT / "models" / "feature_cols.pkl"
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
    """Compute policy metrics on the same held-out split used during training."""
    if not FEATURES_CSV.exists() or not MODEL_PATH.exists() or not FEATURE_COLS_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail="Model performance artifacts are missing - run `python src/train.py` first.",
        )

    df = pd.read_csv(FEATURES_CSV)
    feature_cols = joblib.load(FEATURE_COLS_PATH)
    missing = [col for col in feature_cols if col not in df.columns]
    if missing:
        raise HTTPException(
            status_code=503,
            detail=f"Feature columns missing from {FEATURES_CSV.name}: {missing[:5]}",
        )

    X = df[feature_cols]
    y = df["TARGET"].astype(int)
    _, X_test, _, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        stratify=y,
        random_state=42,
    )

    model = joblib.load(MODEL_PATH)
    y_proba = model.predict_proba(X_test)[:, 1]

    def _metrics(threshold: float) -> dict[str, float]:
        y_pred = (y_proba >= threshold).astype(int)
        return {
            "threshold": threshold,
            "precision": float(precision_score(y_test, y_pred, zero_division=0)),
            "recall": float(recall_score(y_test, y_pred, zero_division=0)),
            "f1": float(f1_score(y_test, y_pred, zero_division=0)),
            "approval_rate": float((y_proba < threshold).mean()),
        }

    return {
        "conservative": _metrics(POLICY_THRESHOLDS["conservative"]),
        "aggressive": _metrics(POLICY_THRESHOLDS["aggressive"]),
    }
