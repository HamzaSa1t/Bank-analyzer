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

# Train model (produces models/xgboost_model.pkl + models/feature_order.json)
jupyter notebook notebooks/training.ipynb
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
