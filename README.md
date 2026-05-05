# Credit Risk Analyzer

Bilingual Arabic/English credit-risk simulation built on the Home Credit Default Risk dataset. The app estimates probability of default, explains the strongest risk drivers, simulates bank policy gates, and presents a structured lending report.

## Tech Stack

- Frontend: React, Vite, Tailwind CSS, Framer Motion, Recharts
- Backend: FastAPI and Pydantic
- Machine learning: XGBoost, scikit-learn, pandas, NumPy, SHAP
- Model artifacts: joblib, JSON, CSV outputs under `models/`
- Reporting: deterministic backend report generator in `src/llm/reporter.py`
- Deployment files: `railway.json` plus standard frontend Vite build

## How The System Works

1. The frontend collects loan, income, employment, and bank-strategy inputs.
2. A simulated SIMAH-like profile and GOSI-like employment profile provide credit and employment signals.
3. The backend builds the same feature vector shape used during training.
4. Hard policy rules run first. If a hard rule fails, ML scoring, pricing, and profit evaluation are skipped.
5. If hard rules pass, the XGBoost model estimates probability of default (PD).
6. The selected bank policy prices the loan, recomputes the final DBR, and checks profitability.
7. The response includes gate outcomes, SHAP-style drivers, financial breakdown, and a deterministic report.

## ML Model

The training pipeline is in `src/train.py`. It trains an `XGBClassifier` on engineered Home Credit features from `data/processed/features.csv`.

Validation uses 5-fold StratifiedKFold. Each fold keeps an outer validation set untouched by fitting and early stopping. Out-of-fold predictions are stitched together so every applicant is evaluated by a model that did not train on that applicant.

The model is used for risk ranking and PD estimation. It does not make the final lending decision by itself.

Training artifacts:

- `models/model.pkl`: final model retrained on the full dataset
- `models/xgboost_model.pkl`: compatibility alias
- `models/feature_cols.pkl`: exact feature order expected by inference
- `models/feature_order.json`: JSON feature order
- `models/median_vals.pkl`: EXT_SOURCE median values used by inference
- `models/metrics.json`: validation, threshold, and dataset metrics
- `models/oof_predictions.csv`: out-of-fold predictions

## Bank Simulation And Decision Logic

The lending decision is an AND gate. Approval requires all of these to pass:

- Hard rules, such as active default, minimum salary, age, maturity age, and DBR limit
- Model PD under the selected bank maximum
- Credit score above the selected bank minimum
- Final priced DBR at or below the SAMA cap
- Expected profit greater than zero

The conservative bank uses stricter risk tolerance and lower pricing. The aggressive bank accepts higher PD only when pricing and expected profit still support the loan.

Expected profit is calculated as interest revenue minus expected credit loss:

```text
expected_loss = PD * LGD * loan_amount
expected_profit = interest_revenue - expected_loss
```

## Run Backend

Create a Python environment and install dependencies:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Start the API:

```bash
python -m uvicorn api.main:app --reload --port 8000
```

## Run Frontend

Install frontend dependencies:

```bash
cd frontend
npm install
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

## Training Pipeline

Download the Home Credit Default Risk data into `data/`, then run:

```bash
python src/preprocessing.py
python src/train.py
```

`src/preprocessing.py` creates `data/processed/features.csv`. `src/train.py` trains the model and writes artifacts to `models/`.

## Environment Variables

Create `.env` from `.env.example` and fill values as needed.

```text
GROQ_API_KEY=
KAGGLE_USERNAME=
KAGGLE_KEY=
```

Notes:

- `KAGGLE_USERNAME` and `KAGGLE_KEY` are needed only when downloading data through the Kaggle CLI.
- `GROQ_API_KEY` is kept for LLM/reporting integrations. The current report path is deterministic and does not require an external LLM call.

## Model Performance Summary

Latest cross-validation summary:

| Metric | Result |
|---|---:|
| ROC-AUC / OOF AUC | 0.7868 |
| Mean validation AUC | 0.7868 |
| Validation AUC std | 0.0035 |
| Mean train AUC | 0.8334 |
| Train-validation gap | 0.0466 |
| PR-AUC | 0.2812 |
| Brier score | 0.0659 |
| Total rows | 307,511 |
| Positive rate | 0.0807 |
| Feature count | 289 |

Policy threshold summary:

| Policy | Threshold | Precision | Recall | F1 | Approval rate |
|---|---:|---:|---:|---:|---:|
| Conservative | 0.05 | 0.1415 | 0.8441 | 0.2423 | 0.5183 |
| Aggressive | 0.15 | 0.2618 | 0.4744 | 0.3374 | 0.8537 |

The default 0.5 threshold is intentionally not highlighted because it is not meaningful for this imbalanced credit-risk use case.

## Disclaimer

This project is a simulation and demonstration system. It is not a real lending system, credit bureau product, regulatory approval workflow, or production underwriting engine. Outputs should not be used to make real credit, lending, pricing, compliance, or consumer decisions.
