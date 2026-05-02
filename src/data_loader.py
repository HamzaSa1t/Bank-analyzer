"""Load the preprocessed feature frame for serving.

`src/preprocessing.py` is the source of truth for feature construction. This
module just memoizes the resulting CSV so /simulate-simah doesn't pay disk I/O
on every request.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
FEATURES_CSV = DATA_DIR / "processed" / "features.csv"

_CACHE: pd.DataFrame | None = None


def load_features() -> pd.DataFrame:
    """Read data/processed/features.csv once per process and cache it."""
    global _CACHE
    if _CACHE is not None:
        return _CACHE
    if not FEATURES_CSV.exists():
        raise FileNotFoundError(
            f"{FEATURES_CSV} is missing. Run `python src/preprocessing.py` first."
        )
    _CACHE = pd.read_csv(FEATURES_CSV)
    return _CACHE


def get_simah_profiles() -> pd.DataFrame:
    """Alias kept for /simulate-simah — one random row per request."""
    return load_features()
