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

import numpy as np
import pandas as pd

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
OUT_PATH = DATA_DIR / "processed" / "features.csv"

RATIO_CLIP_UPPER = 10.0
APP_CATEGORICAL_COLS = [
    "NAME_CONTRACT_TYPE",
    "CODE_GENDER",
    "FLAG_OWN_CAR",
    "FLAG_OWN_REALTY",
    "NAME_TYPE_SUITE",
    "NAME_INCOME_TYPE",
    "NAME_EDUCATION_TYPE",
    "NAME_FAMILY_STATUS",
    "NAME_HOUSING_TYPE",
    "OCCUPATION_TYPE",
    "ORGANIZATION_TYPE",
]
APP_NUMERIC_COLS = [
    "CNT_CHILDREN",
    "AMT_GOODS_PRICE",
    "REGION_POPULATION_RELATIVE",
    "DAYS_REGISTRATION",
    "DAYS_ID_PUBLISH",
    "OWN_CAR_AGE",
    "FLAG_EMP_PHONE",
    "FLAG_WORK_PHONE",
    "FLAG_PHONE",
    "FLAG_EMAIL",
    "CNT_FAM_MEMBERS",
    "REGION_RATING_CLIENT",
    "REGION_RATING_CLIENT_W_CITY",
    "REG_CITY_NOT_LIVE_CITY",
    "REG_CITY_NOT_WORK_CITY",
    "LIVE_CITY_NOT_WORK_CITY",
    "DEF_30_CNT_SOCIAL_CIRCLE",
    "DEF_60_CNT_SOCIAL_CIRCLE",
    "DAYS_LAST_PHONE_CHANGE",
    "AMT_REQ_CREDIT_BUREAU_YEAR",
]
BUREAU_CREDIT_TYPES = [
    "Consumer credit",
    "Credit card",
    "Car loan",
    "Mortgage",
    "Microloan",
]
CREDIT_CARD_STATUS = ["Active", "Completed", "Signed", "Demand", "Sent proposal", "Refused"]


def _safe_ratio(numerator: pd.Series, denominator: pd.Series) -> pd.Series:
    """Return numerator / denominator only where the denominator is positive."""
    numerator = pd.to_numeric(numerator, errors="coerce")
    denominator = pd.to_numeric(denominator, errors="coerce")
    out = numerator / denominator.where(denominator > 0)
    return out.replace([np.inf, -np.inf], np.nan).clip(lower=0, upper=RATIO_CLIP_UPPER)


def _flatten_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [
        "_".join(str(part) for part in col if part)
        if isinstance(col, tuple)
        else str(col)
        for col in df.columns
    ]
    return df


def _prefix_columns(df: pd.DataFrame, prefix: str) -> pd.DataFrame:
    return df.rename(columns={c: f"{prefix}_{c}" for c in df.columns if c != "SK_ID_CURR"})


# Step 1 — Clean application_train.csv
def step1_application() -> pd.DataFrame:
    keep = [
        "SK_ID_CURR", "TARGET",
        "AMT_INCOME_TOTAL", "AMT_CREDIT", "AMT_ANNUITY",
        "DAYS_BIRTH", "DAYS_EMPLOYED", "NAME_INCOME_TYPE",
        "EXT_SOURCE_1", "EXT_SOURCE_2", "EXT_SOURCE_3",
        "AMT_REQ_CREDIT_BUREAU_MON",
    ] + APP_NUMERIC_COLS + APP_CATEGORICAL_COLS
    keep = list(dict.fromkeys(keep))
    df = pd.read_csv(DATA_DIR / "application_train.csv", usecols=keep)

    df["AGE_YEARS"] = df["DAYS_BIRTH"].abs() / 365.0
    df["REGISTRATION_YEARS"] = df["DAYS_REGISTRATION"].abs() / 365.0
    df["ID_PUBLISH_YEARS"] = df["DAYS_ID_PUBLISH"].abs() / 365.0
    df["LAST_PHONE_CHANGE_YEARS"] = df["DAYS_LAST_PHONE_CHANGE"].abs() / 365.0

    # 365243 is the Home Credit sentinel for "no employment data" (unemployed/retired).
    # Treat these rows as 0 years employed.
    years_employed = df["DAYS_EMPLOYED"].abs() / 365.0
    df["YEARS_EMPLOYED"] = years_employed.where(df["DAYS_EMPLOYED"] != 365243, 0.0)
    df["DAYS_EMPLOYED_ANOMALY"] = (df["DAYS_EMPLOYED"] == 365243).astype(int)

    df["DBR"] = _safe_ratio(df["AMT_ANNUITY"], df["AMT_INCOME_TOTAL"])
    df["CREDIT_INCOME_RATIO"] = _safe_ratio(df["AMT_CREDIT"], df["AMT_INCOME_TOTAL"])
    df["GOODS_CREDIT_RATIO"] = _safe_ratio(df["AMT_GOODS_PRICE"], df["AMT_CREDIT"])
    df["ANNUITY_CREDIT_RATIO"] = _safe_ratio(df["AMT_ANNUITY"], df["AMT_CREDIT"])
    df["INCOME_PER_PERSON"] = _safe_ratio(df["AMT_INCOME_TOTAL"], df["CNT_FAM_MEMBERS"].fillna(1))
    df["CHILDREN_RATIO"] = _safe_ratio(df["CNT_CHILDREN"], df["CNT_FAM_MEMBERS"].fillna(1))
    df["EXT_SOURCE_AVG"] = df[["EXT_SOURCE_1", "EXT_SOURCE_2", "EXT_SOURCE_3"]].mean(axis=1, skipna=True)
    df["EXT_SOURCE_STD"] = df[["EXT_SOURCE_1", "EXT_SOURCE_2", "EXT_SOURCE_3"]].std(axis=1, skipna=True)
    df["EXT_SOURCE_MIN"] = df[["EXT_SOURCE_1", "EXT_SOURCE_2", "EXT_SOURCE_3"]].min(axis=1, skipna=True)
    df["EXT_SOURCE_MAX"] = df[["EXT_SOURCE_1", "EXT_SOURCE_2", "EXT_SOURCE_3"]].max(axis=1, skipna=True)
    df["SIMAH_SCORE"] = 300.0 + (df["EXT_SOURCE_AVG"] * 600.0)
    for col in ["EXT_SOURCE_1", "EXT_SOURCE_2", "EXT_SOURCE_3"]:
        df[f"{col}_MISSING"] = df[col].isna().astype(int)
    df["IS_EMPLOYED"] = df["NAME_INCOME_TYPE"].isin(["Working", "State servant"]).astype(int)

    cat = pd.get_dummies(
        df[APP_CATEGORICAL_COLS].fillna("MISSING"),
        columns=APP_CATEGORICAL_COLS,
        prefix=APP_CATEGORICAL_COLS,
        dtype=int,
    )
    df = pd.concat([df.drop(columns=APP_CATEGORICAL_COLS), cat], axis=1)
    df = df.drop(columns=["DAYS_BIRTH", "DAYS_EMPLOYED", "DAYS_REGISTRATION", "DAYS_ID_PUBLISH", "DAYS_LAST_PHONE_CHANGE"])
    return df


# Step 2 — Aggregate bureau.csv
def step2_bureau() -> pd.DataFrame:
    bureau = pd.read_csv(
        DATA_DIR / "bureau.csv",
        usecols=[
            "SK_ID_CURR", "AMT_CREDIT_MAX_OVERDUE", "CREDIT_DAY_OVERDUE",
            "AMT_CREDIT_SUM_DEBT", "AMT_CREDIT_SUM_LIMIT", "DAYS_CREDIT",
            "CNT_CREDIT_PROLONG", "CREDIT_ACTIVE", "DAYS_CREDIT_ENDDATE",
            "DAYS_ENDDATE_FACT", "AMT_CREDIT_SUM", "AMT_CREDIT_SUM_OVERDUE",
            "CREDIT_TYPE", "DAYS_CREDIT_UPDATE", "AMT_ANNUITY",
        ],
    )
    bureau["__is_active"] = (bureau["CREDIT_ACTIVE"] == "Active").astype(int)
    bureau["__is_closed"] = (bureau["CREDIT_ACTIVE"] == "Closed").astype(int)
    bureau["__is_overdue"] = (bureau["CREDIT_DAY_OVERDUE"] > 0).astype(int)
    bureau["__debt_credit_ratio"] = _safe_ratio(bureau["AMT_CREDIT_SUM_DEBT"], bureau["AMT_CREDIT_SUM"])
    bureau["__overdue_credit_ratio"] = _safe_ratio(bureau["AMT_CREDIT_SUM_OVERDUE"], bureau["AMT_CREDIT_SUM"])

    agg = bureau.groupby("SK_ID_CURR").agg(
        BUREAU_LOAN_COUNT=("SK_ID_CURR", "size"),
        BUREAU_MAX_OVERDUE=("AMT_CREDIT_MAX_OVERDUE", "max"),
        BUREAU_MEAN_OVERDUE=("AMT_CREDIT_MAX_OVERDUE", "mean"),
        BUREAU_DAYS_OVERDUE_MAX=("CREDIT_DAY_OVERDUE", "max"),
        BUREAU_DAYS_OVERDUE_MEAN=("CREDIT_DAY_OVERDUE", "mean"),
        BUREAU_DEBT_TOTAL=("AMT_CREDIT_SUM_DEBT", "sum"),
        BUREAU_DEBT_MEAN=("AMT_CREDIT_SUM_DEBT", "mean"),
        BUREAU_LIMIT_TOTAL=("AMT_CREDIT_SUM_LIMIT", "sum"),
        BUREAU_CREDIT_SUM_TOTAL=("AMT_CREDIT_SUM", "sum"),
        BUREAU_CREDIT_SUM_MEAN=("AMT_CREDIT_SUM", "mean"),
        BUREAU_CREDIT_SUM_MAX=("AMT_CREDIT_SUM", "max"),
        BUREAU_OVERDUE_SUM_TOTAL=("AMT_CREDIT_SUM_OVERDUE", "sum"),
        BUREAU_ANNUITY_SUM=("AMT_ANNUITY", "sum"),
        BUREAU_ANNUITY_MEAN=("AMT_ANNUITY", "mean"),
        BUREAU_DAYS_CREDIT_MIN=("DAYS_CREDIT", "min"),
        BUREAU_DAYS_CREDIT_MAX=("DAYS_CREDIT", "max"),
        BUREAU_DAYS_CREDIT_MEAN=("DAYS_CREDIT", "mean"),
        BUREAU_DAYS_CREDIT_UPDATE_MEAN=("DAYS_CREDIT_UPDATE", "mean"),
        BUREAU_DAYS_CREDIT_UPDATE_MIN=("DAYS_CREDIT_UPDATE", "min"),
        BUREAU_DAYS_CREDIT_ENDDATE_MEAN=("DAYS_CREDIT_ENDDATE", "mean"),
        BUREAU_DAYS_CREDIT_ENDDATE_MAX=("DAYS_CREDIT_ENDDATE", "max"),
        BUREAU_DAYS_ENDDATE_FACT_MEAN=("DAYS_ENDDATE_FACT", "mean"),
        BUREAU_DAYS_ENDDATE_FACT_MIN=("DAYS_ENDDATE_FACT", "min"),
        BUREAU_PROLONGED_COUNT=("CNT_CREDIT_PROLONG", "sum"),
        BUREAU_ACTIVE_COUNT=("__is_active", "sum"),
        BUREAU_CLOSED_COUNT=("__is_closed", "sum"),
        BUREAU_OVERDUE_LOAN_COUNT=("__is_overdue", "sum"),
        BUREAU_DEBT_CREDIT_RATIO_MEAN=("__debt_credit_ratio", "mean"),
        BUREAU_DEBT_CREDIT_RATIO_MAX=("__debt_credit_ratio", "max"),
        BUREAU_OVERDUE_CREDIT_RATIO_MAX=("__overdue_credit_ratio", "max"),
    ).reset_index()

    agg["BUREAU_LIMIT_INVALID"] = (agg["BUREAU_LIMIT_TOTAL"] <= 0).astype(int)
    agg["BUREAU_UTIL_RATIO"] = _safe_ratio(agg["BUREAU_DEBT_TOTAL"], agg["BUREAU_LIMIT_TOTAL"])
    agg["BUREAU_UTIL_RATIO"] = agg["BUREAU_UTIL_RATIO"].fillna(0)
    agg["BUREAU_CREDIT_AGE_MAX"] = agg["BUREAU_DAYS_CREDIT_MIN"].abs()
    agg = agg.drop(columns=["BUREAU_DAYS_CREDIT_MIN"])

    active = bureau[bureau["CREDIT_ACTIVE"] == "Active"].groupby("SK_ID_CURR").agg(
        ACTIVE_BUREAU_DEBT_TOTAL=("AMT_CREDIT_SUM_DEBT", "sum"),
        ACTIVE_BUREAU_CREDIT_TOTAL=("AMT_CREDIT_SUM", "sum"),
        ACTIVE_BUREAU_LIMIT_TOTAL=("AMT_CREDIT_SUM_LIMIT", "sum"),
        ACTIVE_BUREAU_DAYS_CREDIT_MEAN=("DAYS_CREDIT", "mean"),
        ACTIVE_BUREAU_DAYS_CREDIT_MAX=("DAYS_CREDIT", "max"),
    ).reset_index()
    active["ACTIVE_BUREAU_DEBT_CREDIT_RATIO"] = _safe_ratio(
        active["ACTIVE_BUREAU_DEBT_TOTAL"], active["ACTIVE_BUREAU_CREDIT_TOTAL"]
    ).fillna(0)

    credit_type_df = pd.get_dummies(bureau[["SK_ID_CURR", "CREDIT_TYPE"]], columns=["CREDIT_TYPE"], dtype=int)
    keep_cols = ["SK_ID_CURR"] + [
        f"CREDIT_TYPE_{credit_type}" for credit_type in BUREAU_CREDIT_TYPES
        if f"CREDIT_TYPE_{credit_type}" in credit_type_df.columns
    ]
    credit_type_df = credit_type_df[keep_cols].groupby("SK_ID_CURR").sum().reset_index()
    credit_type_df = _prefix_columns(credit_type_df, "BUREAU")

    active_types = bureau[bureau["CREDIT_ACTIVE"] == "Active"]
    active_type = pd.get_dummies(active_types[["SK_ID_CURR", "CREDIT_TYPE"]], columns=["CREDIT_TYPE"], dtype=int)
    keep_active_cols = ["SK_ID_CURR"] + [
        f"CREDIT_TYPE_{credit_type}" for credit_type in BUREAU_CREDIT_TYPES
        if f"CREDIT_TYPE_{credit_type}" in active_type.columns
    ]
    active_type = active_type[keep_active_cols].groupby("SK_ID_CURR").sum().reset_index()
    active_type = _prefix_columns(active_type, "ACTIVE_BUREAU")

    agg = agg.merge(active, on="SK_ID_CURR", how="left")
    agg = agg.merge(credit_type_df, on="SK_ID_CURR", how="left")
    agg = agg.merge(active_type, on="SK_ID_CURR", how="left")
    return agg


# Step 3 — Aggregate installments_payments.csv
def step3_installments() -> pd.DataFrame:
    inst = pd.read_csv(
        DATA_DIR / "installments_payments.csv",
        usecols=[
            "SK_ID_PREV", "SK_ID_CURR", "NUM_INSTALMENT_VERSION",
            "NUM_INSTALMENT_NUMBER", "DAYS_INSTALMENT", "DAYS_ENTRY_PAYMENT",
            "AMT_INSTALMENT", "AMT_PAYMENT",
        ],
    )
    # DAYS_* are negative offsets from the current date. Payment landed AFTER the
    # scheduled installment when DAYS_ENTRY_PAYMENT > DAYS_INSTALMENT (closer to 0),
    # so positive (DAYS_ENTRY_PAYMENT - DAYS_INSTALMENT) = days late. With this
    # convention, INSTAL_DAYS_LATE_MAX is the worst-case lateness, as the name implies.
    inst["__late_days"] = inst["DAYS_ENTRY_PAYMENT"] - inst["DAYS_INSTALMENT"]
    inst["__pay_rate"] = inst["AMT_PAYMENT"] / (inst["AMT_INSTALMENT"] + 1.0)
    inst["__safe_pay_rate"] = _safe_ratio(inst["AMT_PAYMENT"], inst["AMT_INSTALMENT"])
    inst["__underpayment"] = (inst["AMT_INSTALMENT"] - inst["AMT_PAYMENT"]).clip(lower=0)
    inst["__underpayment_rate"] = _safe_ratio(inst["__underpayment"], inst["AMT_INSTALMENT"])
    inst["__is_late"] = (inst["__late_days"] > 0).astype(int)
    inst["__is_underpaid"] = (inst["__underpayment"] > 0).astype(int)
    inst["__recent_12m"] = (inst["DAYS_INSTALMENT"] >= -365).astype(int)

    agg = inst.groupby("SK_ID_CURR").agg(
        INSTAL_COUNT=("SK_ID_CURR", "size"),
        INSTAL_PREV_COUNT=("SK_ID_PREV", "nunique"),
        INSTAL_DAYS_LATE_MAX=("__late_days", "max"),
        INSTAL_DAYS_LATE_MEAN=("__late_days", "mean"),
        INSTAL_DAYS_LATE_STD=("__late_days", "std"),
        INSTAL_PAYMENT_RATE=("__safe_pay_rate", "mean"),
        INSTAL_PAYMENT_RATE_MIN=("__safe_pay_rate", "min"),
        INSTAL_PCT_LATE=("__is_late", "mean"),
        INSTAL_UNDERPAYMENT_TOTAL=("__underpayment", "sum"),
        INSTAL_UNDERPAYMENT_MEAN=("__underpayment", "mean"),
        INSTAL_UNDERPAYMENT_RATE_MEAN=("__underpayment_rate", "mean"),
        INSTAL_PCT_UNDERPAID=("__is_underpaid", "mean"),
        INSTAL_PAYMENT_TOTAL=("AMT_PAYMENT", "sum"),
        INSTAL_PAYMENT_MEAN=("AMT_PAYMENT", "mean"),
        INSTAL_PAYMENT_MIN=("AMT_PAYMENT", "min"),
        INSTAL_AMOUNT_TOTAL=("AMT_INSTALMENT", "sum"),
        INSTAL_AMOUNT_MEAN=("AMT_INSTALMENT", "mean"),
        INSTAL_DAYS_INSTALMENT_MEAN=("DAYS_INSTALMENT", "mean"),
        INSTAL_DAYS_INSTALMENT_MIN=("DAYS_INSTALMENT", "min"),
        INSTAL_DAYS_ENTRY_PAYMENT_MEAN=("DAYS_ENTRY_PAYMENT", "mean"),
        INSTAL_DAYS_ENTRY_PAYMENT_MIN=("DAYS_ENTRY_PAYMENT", "min"),
        INSTAL_VERSION_MEAN=("NUM_INSTALMENT_VERSION", "mean"),
        INSTAL_VERSION_MIN=("NUM_INSTALMENT_VERSION", "min"),
        INSTAL_VERSION_SUM=("NUM_INSTALMENT_VERSION", "sum"),
        INSTAL_RECENT_12M_COUNT=("__recent_12m", "sum"),
    ).reset_index()
    recent = inst[inst["DAYS_INSTALMENT"] >= -365].groupby("SK_ID_CURR").agg(
        INSTAL_RECENT_12M_DAYS_LATE_MAX=("__late_days", "max"),
        INSTAL_RECENT_12M_DAYS_LATE_MEAN=("__late_days", "mean"),
        INSTAL_RECENT_12M_PCT_LATE=("__is_late", "mean"),
        INSTAL_RECENT_12M_PAYMENT_RATE=("__safe_pay_rate", "mean"),
        INSTAL_RECENT_12M_UNDERPAYMENT_RATE=("__underpayment_rate", "mean"),
    ).reset_index()
    agg = agg.merge(recent, on="SK_ID_CURR", how="left")
    return agg


# Step 4 — Aggregate credit_card_balance.csv
def step4_credit_card() -> pd.DataFrame:
    cc = pd.read_csv(
        DATA_DIR / "credit_card_balance.csv",
        usecols=[
            "SK_ID_CURR", "MONTHS_BALANCE", "AMT_BALANCE",
            "AMT_CREDIT_LIMIT_ACTUAL", "AMT_PAYMENT_CURRENT", "SK_DPD",
            "SK_ID_PREV", "AMT_DRAWINGS_ATM_CURRENT", "AMT_DRAWINGS_CURRENT",
            "AMT_DRAWINGS_POS_CURRENT", "AMT_INST_MIN_REGULARITY",
            "AMT_RECEIVABLE_PRINCIPAL", "AMT_RECIVABLE", "AMT_TOTAL_RECEIVABLE",
            "CNT_DRAWINGS_ATM_CURRENT", "CNT_DRAWINGS_CURRENT",
            "CNT_DRAWINGS_POS_CURRENT", "NAME_CONTRACT_STATUS", "SK_DPD_DEF",
        ],
    )
    cc["__limit_invalid"] = (cc["AMT_CREDIT_LIMIT_ACTUAL"] <= 0).astype(int)
    cc["__balance_invalid"] = (cc["AMT_BALANCE"] <= 0).astype(int)
    cc["__util"] = _safe_ratio(cc["AMT_BALANCE"], cc["AMT_CREDIT_LIMIT_ACTUAL"])
    cc["__pay_ratio"] = _safe_ratio(cc["AMT_PAYMENT_CURRENT"], cc["AMT_BALANCE"])
    cc["__min_payment_ratio"] = _safe_ratio(cc["AMT_PAYMENT_CURRENT"], cc["AMT_INST_MIN_REGULARITY"])
    cc["__recent_12m"] = (cc["MONTHS_BALANCE"] >= -12).astype(int)

    agg = cc.groupby("SK_ID_CURR").agg(
        CARD_RECORD_COUNT=("SK_ID_CURR", "size"),
        CARD_PREV_COUNT=("SK_ID_PREV", "nunique"),
        CARD_BALANCE_MEAN=("AMT_BALANCE", "mean"),
        CARD_BALANCE_MAX=("AMT_BALANCE", "max"),
        CARD_BALANCE_MIN=("AMT_BALANCE", "min"),
        CARD_TOTAL_RECEIVABLE_MEAN=("AMT_TOTAL_RECEIVABLE", "mean"),
        CARD_TOTAL_RECEIVABLE_MAX=("AMT_TOTAL_RECEIVABLE", "max"),
        CARD_RECEIVABLE_PRINCIPAL_MEAN=("AMT_RECEIVABLE_PRINCIPAL", "mean"),
        CARD_DRAWINGS_CURRENT_MEAN=("AMT_DRAWINGS_CURRENT", "mean"),
        CARD_DRAWINGS_CURRENT_MAX=("AMT_DRAWINGS_CURRENT", "max"),
        CARD_DRAWINGS_CURRENT_STD=("AMT_DRAWINGS_CURRENT", "std"),
        CARD_DRAWINGS_ATM_MEAN=("AMT_DRAWINGS_ATM_CURRENT", "mean"),
        CARD_DRAWINGS_POS_MEAN=("AMT_DRAWINGS_POS_CURRENT", "mean"),
        CARD_CNT_DRAWINGS_CURRENT_MEAN=("CNT_DRAWINGS_CURRENT", "mean"),
        CARD_CNT_DRAWINGS_CURRENT_MAX=("CNT_DRAWINGS_CURRENT", "max"),
        CARD_CNT_DRAWINGS_CURRENT_STD=("CNT_DRAWINGS_CURRENT", "std"),
        CARD_CNT_DRAWINGS_ATM_MEAN=("CNT_DRAWINGS_ATM_CURRENT", "mean"),
        CARD_CNT_DRAWINGS_ATM_MAX=("CNT_DRAWINGS_ATM_CURRENT", "max"),
        CARD_CNT_DRAWINGS_ATM_STD=("CNT_DRAWINGS_ATM_CURRENT", "std"),
        CARD_CNT_DRAWINGS_POS_MEAN=("CNT_DRAWINGS_POS_CURRENT", "mean"),
        CARD_CNT_DRAWINGS_POS_MAX=("CNT_DRAWINGS_POS_CURRENT", "max"),
        CARD_MIN_REGULARITY_MEAN=("AMT_INST_MIN_REGULARITY", "mean"),
        CARD_MIN_REGULARITY_MAX=("AMT_INST_MIN_REGULARITY", "max"),
        CARD_MIN_REGULARITY_STD=("AMT_INST_MIN_REGULARITY", "std"),
        CARD_MIN_PAYMENT_RATIO_MEAN=("__min_payment_ratio", "mean"),
        CARD_UTIL_RATIO_AVG=("__util", "mean"),
        CARD_UTIL_RATIO_MAX=("__util", "max"),
        CARD_DPD_MAX=("SK_DPD", "max"),
        CARD_DPD_DEF_MAX=("SK_DPD_DEF", "max"),
        CARD_DPD_MEAN=("SK_DPD", "mean"),
        CARD_DPD_DEF_MEAN=("SK_DPD_DEF", "mean"),
        CARD_PAYMENT_RATIO=("__pay_ratio", "mean"),
        CARD_MONTHS_ACTIVE=("MONTHS_BALANCE", "nunique"),
        CARD_LIMIT_INVALID_RATE=("__limit_invalid", "mean"),
        CARD_BALANCE_INVALID_RATE=("__balance_invalid", "mean"),
        CARD_RECENT_12M_COUNT=("__recent_12m", "sum"),
    ).reset_index()
    agg[["CARD_UTIL_RATIO_AVG", "CARD_UTIL_RATIO_MAX", "CARD_PAYMENT_RATIO"]] = agg[
        ["CARD_UTIL_RATIO_AVG", "CARD_UTIL_RATIO_MAX", "CARD_PAYMENT_RATIO"]
    ].fillna(0)
    recent = cc[cc["MONTHS_BALANCE"] >= -12].groupby("SK_ID_CURR").agg(
        CARD_RECENT_12M_BALANCE_MEAN=("AMT_BALANCE", "mean"),
        CARD_RECENT_12M_UTIL_MEAN=("__util", "mean"),
        CARD_RECENT_12M_PAYMENT_RATIO=("__pay_ratio", "mean"),
        CARD_RECENT_12M_CNT_DRAWINGS_MEAN=("CNT_DRAWINGS_CURRENT", "mean"),
        CARD_RECENT_12M_DPD_MAX=("SK_DPD", "max"),
    ).reset_index()

    status = pd.get_dummies(cc[["SK_ID_CURR", "NAME_CONTRACT_STATUS"]], columns=["NAME_CONTRACT_STATUS"], dtype=int)
    keep_status = ["SK_ID_CURR"] + [
        f"NAME_CONTRACT_STATUS_{status_name}" for status_name in CREDIT_CARD_STATUS
        if f"NAME_CONTRACT_STATUS_{status_name}" in status.columns
    ]
    status = status[keep_status].groupby("SK_ID_CURR").sum().reset_index()
    status = _prefix_columns(status, "CARD")

    agg = agg.merge(recent, on="SK_ID_CURR", how="left")
    agg = agg.merge(status, on="SK_ID_CURR", how="left")
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
