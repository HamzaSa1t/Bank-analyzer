# Credit Risk Analyzer

Bilingual (AR/EN) credit risk assessment built on the Home Credit Default Risk dataset.

## Architecture

- **Frontend** — React + Vite + Tailwind + shadcn/ui (`frontend/`)
- **Backend** — FastAPI (`api/`)
- **ML service** — XGBoost + SHAP (`src/ml/`)
- **LLM service** — LangChain + Groq (`src/llm/`)

See `calaude.md` for the full specification.

## Setup

```bash
# Python env
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt

# Environment
cp .env.example .env
# Fill GROQ_API_KEY, KAGGLE_USERNAME, KAGGLE_KEY

# Dataset (uses KAGGLE_* from .env)
kaggle competitions download -c home-credit-default-risk
unzip home-credit-default-risk.zip -d data/

# Prepare data and train model
python src/preprocessing.py
python src/train.py

# Training produces:
# - models/model.pkl and models/feature_cols.pkl for the API
# - models/xgboost_model.pkl and models/feature_order.json as compatibility aliases
# - models/metrics.json with validation metrics for the saved model
```

## Run

```bash
# Backend
uvicorn api.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev     # localhost:5173
```
