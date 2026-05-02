"""Credit Risk preprocessing — Home Credit Default Risk + SIMAH-style aggregates.

Builds one row per applicant (SK_ID_CURR) with engineered + aggregated features,
ready for XGBoost training. Single-file pandas pipeline; no sklearn.

Run standalone:
    python src/preprocessing.py

Reads (flat layout under data/):
    application_train.csv
    bureau.csv
    installments_payments.csv
    credit_card_balance.csv

Writes:
    data/processed/features.csv
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
OUT_PATH = DATA_DIR / "processed" / "features.csv"


# Step 1 — Clean application_train.csv
def step1_application() -> pd.DataFrame:
    keep = [
        "SK_ID_CURR", "TARGET",
        "AMT_INCOME_TOTAL", "AMT_CREDIT", "AMT_ANNUITY",
        "DAYS_BIRTH", "DAYS_EMPLOYED", "NAME_INCOME_TYPE",
        "EXT_SOURCE_1", "EXT_SOURCE_2", "EXT_SOURCE_3",
        "AMT_REQ_CREDIT_BUREAU_MON",
    ]
    df = pd.read_csv(DATA_DIR / "application_train.csv", usecols=keep)

    df["AGE_YEARS"] = df["DAYS_BIRTH"].abs() / 365.0

    # 365243 is the Home Credit sentinel for "no employment data" (unemployed/retired).
    # Treat these rows as 0 years employed.
    years_employed = df["DAYS_EMPLOYED"].abs() / 365.0
    df["YEARS_EMPLOYED"] = years_employed.where(df["DAYS_EMPLOYED"] != 365243, 0.0)

    df["DBR"] = df["AMT_ANNUITY"] / df["AMT_INCOME_TOTAL"]
    df["CREDIT_INCOME_RATIO"] = df["AMT_CREDIT"] / df["AMT_INCOME_TOTAL"]
    df["EXT_SOURCE_AVG"] = df[["EXT_SOURCE_1", "EXT_SOURCE_2", "EXT_SOURCE_3"]].mean(axis=1, skipna=True)
    df["SIMAH_SCORE"] = 300.0 + (df["EXT_SOURCE_AVG"] * 600.0)
    df["IS_EMPLOYED"] = df["NAME_INCOME_TYPE"].isin(["Working", "State servant"]).astype(int)

    # NAME_INCOME_TYPE's predictive content is captured by IS_EMPLOYED — drop the
    # raw string so the frame is fully numeric and XGBoost-ready.
    df = df.drop(columns=["NAME_INCOME_TYPE", "DAYS_BIRTH", "DAYS_EMPLOYED"])
    return df


# Step 2 — Aggregate bureau.csv
def step2_bureau() -> pd.DataFrame:
    bureau = pd.read_csv(
        DATA_DIR / "bureau.csv",
        usecols=[
            "SK_ID_CURR", "AMT_CREDIT_MAX_OVERDUE", "CREDIT_DAY_OVERDUE",
            "AMT_CREDIT_SUM_DEBT", "AMT_CREDIT_SUM_LIMIT", "DAYS_CREDIT",
            "CNT_CREDIT_PROLONG", "CREDIT_ACTIVE",
        ],
    )
    bureau["__is_active"] = (bureau["CREDIT_ACTIVE"] == "Active").astype(int)

    agg = bureau.groupby("SK_ID_CURR").agg(
        BUREAU_MAX_OVERDUE=("AMT_CREDIT_MAX_OVERDUE", "max"),
        BUREAU_DAYS_OVERDUE_MAX=("CREDIT_DAY_OVERDUE", "max"),
        BUREAU_DEBT_TOTAL=("AMT_CREDIT_SUM_DEBT", "sum"),
        BUREAU_LIMIT_TOTAL=("AMT_CREDIT_SUM_LIMIT", "sum"),
        BUREAU_DAYS_CREDIT_MIN=("DAYS_CREDIT", "min"),
        BUREAU_PROLONGED_COUNT=("CNT_CREDIT_PROLONG", "sum"),
        BUREAU_ACTIVE_COUNT=("__is_active", "sum"),
    ).reset_index()

    agg["BUREAU_UTIL_RATIO"] = agg["BUREAU_DEBT_TOTAL"] / (agg["BUREAU_LIMIT_TOTAL"] + 1.0)
    agg["BUREAU_CREDIT_AGE_MAX"] = agg["BUREAU_DAYS_CREDIT_MIN"].abs()
    agg = agg.drop(columns=["BUREAU_DAYS_CREDIT_MIN"])
    return agg


# Step 3 — Aggregate installments_payments.csv
def step3_installments() -> pd.DataFrame:
    inst = pd.read_csv(
        DATA_DIR / "installments_payments.csv",
        usecols=["SK_ID_CURR", "DAYS_INSTALMENT", "DAYS_ENTRY_PAYMENT", "AMT_INSTALMENT", "AMT_PAYMENT"],
    )
    # DAYS_* are negative offsets from the current date. Payment landed AFTER the
    # scheduled installment when DAYS_ENTRY_PAYMENT > DAYS_INSTALMENT (closer to 0),
    # so positive (DAYS_ENTRY_PAYMENT - DAYS_INSTALMENT) = days late. With this
    # convention, INSTAL_DAYS_LATE_MAX is the worst-case lateness, as the name implies.
    inst["__late_days"] = inst["DAYS_ENTRY_PAYMENT"] - inst["DAYS_INSTALMENT"]
    inst["__pay_rate"] = inst["AMT_PAYMENT"] / (inst["AMT_INSTALMENT"] + 1.0)
    inst["__is_late"] = (inst["__late_days"] > 0).astype(int)

    agg = inst.groupby("SK_ID_CURR").agg(
        INSTAL_DAYS_LATE_MAX=("__late_days", "max"),
        INSTAL_DAYS_LATE_MEAN=("__late_days", "mean"),
        INSTAL_PAYMENT_RATE=("__pay_rate", "mean"),
        INSTAL_PCT_LATE=("__is_late", "mean"),
    ).reset_index()
    return agg


# Step 4 — Aggregate credit_card_balance.csv
def step4_credit_card() -> pd.DataFrame:
    cc = pd.read_csv(
        DATA_DIR / "credit_card_balance.csv",
        usecols=[
            "SK_ID_CURR", "MONTHS_BALANCE", "AMT_BALANCE",
            "AMT_CREDIT_LIMIT_ACTUAL", "AMT_PAYMENT_CURRENT", "SK_DPD",
        ],
    )
    cc["__util"] = cc["AMT_BALANCE"] / (cc["AMT_CREDIT_LIMIT_ACTUAL"] + 1.0)
    cc["__pay_ratio"] = cc["AMT_PAYMENT_CURRENT"] / (cc["AMT_BALANCE"] + 1.0)

    agg = cc.groupby("SK_ID_CURR").agg(
        CARD_UTIL_RATIO_AVG=("__util", "mean"),
        CARD_UTIL_RATIO_MAX=("__util", "max"),
        CARD_DPD_MAX=("SK_DPD", "max"),
        CARD_PAYMENT_RATIO=("__pay_ratio", "mean"),
        CARD_MONTHS_ACTIVE=("MONTHS_BALANCE", "nunique"),
    ).reset_index()
    return agg


# Step 5 — Merge everything
def step5_merge(app: pd.DataFrame, bureau: pd.DataFrame,
                installments: pd.DataFrame, card: pd.DataFrame) -> pd.DataFrame:
    out = app.merge(bureau, on="SK_ID_CURR", how="left")
    out = out.merge(installments, on="SK_ID_CURR", how="left")
    out = out.merge(card, on="SK_ID_CURR", how="left")

    # Applicants without bureau/installments/card history get NaN from the left join.
    # Spec says fill those with 0. EXT_SOURCE_* and any other application-side NaN
    # are intentionally left untouched — XGBoost handles them natively.
    fill_cols = (
        [c for c in bureau.columns if c != "SK_ID_CURR"]
        + [c for c in installments.columns if c != "SK_ID_CURR"]
        + [c for c in card.columns if c != "SK_ID_CURR"]
    )
    out[fill_cols] = out[fill_cols].fillna(0)
    return out


# Step 6 — Save output
def main() -> None:
    print("Step 1: cleaning application_train ...")
    app = step1_application()
    print(f"  -> {app.shape}")

    print("Step 2: aggregating bureau ...")
    bureau = step2_bureau()
    print(f"  -> {bureau.shape}")

    print("Step 3: aggregating installments_payments ...")
    installments = step3_installments()
    print(f"  -> {installments.shape}")

    print("Step 4: aggregating credit_card_balance ...")
    card = step4_credit_card()
    print(f"  -> {card.shape}")

    print("Step 5: merging ...")
    features = step5_merge(app, bureau, installments, card)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    features.to_csv(OUT_PATH, index=False)

    print(f"\nSaved {OUT_PATH}")
    print(f"shape: {features.shape}")
    print("columns:")
    for c in features.columns:
        print(f"  - {c}")
    print("\nTARGET distribution:")
    print(features["TARGET"].value_counts(dropna=False).to_string())
    print(f"default rate: {features['TARGET'].mean():.4f}")


if __name__ == "__main__":
    main()
