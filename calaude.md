# Credit Risk Analyzer — Project Specification

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│         (frontend/ — UI only, zero logic)               │
│         Vite + React + Tailwind + shadcn/ui             │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP (fetch / axios)
┌──────────────────────▼──────────────────────────────────┐
│                   FastAPI Backend                        │
│                   (api/main.py)                          │
│                                                          │
│  POST /assess   → Rules → ML Service → LLM Service      │
│  POST /simulate → SIMAH random profile                   │
│  GET  /health                                            │
└──────────┬──────────────────────────┬───────────────────┘
           │                          │
┌──────────▼──────────┐   ┌───────────▼──────────┐
│     ML Service      │   │      LLM Service      │
│  src/ml/inference   │   │   src/llm/reporter    │
│  src/ml/explainer   │   │                       │
│                     │   │  LangChain + Groq      │
│  XGBoost + SHAP     │   │  PydanticOutputParser  │
└─────────────────────┘   └───────────────────────┘
```

---

## Project Structure

```
credit_risk_analyzer/
│
├── data/
│   ├── application_train.csv
│   ├── bureau.csv
│   └── bureau_balance.csv
│
├── src/
│   ├── data_loader.py
│   ├── feature_engineering.py
│   ├── rules_engine.py
│   ├── ml/
│   │   ├── inference.py
│   │   └── explainer.py
│   └── llm/
│       └── reporter.py
│
├── api/
│   ├── main.py
│   ├── schemas.py
│   └── services.py
│
├── models/
│   └── xgboost_model.pkl
│
├── notebooks/
│   └── training.ipynb
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── BankSelector.jsx
│   │   │   ├── UserInputForm.jsx
│   │   │   ├── SimahPanel.jsx
│   │   │   ├── ResultsDashboard.jsx
│   │   │   ├── CreditScoreGauge.jsx
│   │   │   ├── ShapPlot.jsx
│   │   │   └── LLMReport.jsx
│   │   ├── hooks/
│   │   │   └── useAssessment.js
│   │   ├── lib/
│   │   │   ├── api.js          # all fetch calls to FastAPI
│   │   │   └── strings.js      # AR/EN translations
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── package.json
│
├── requirements.txt
├── .env.example
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS + shadcn/ui |
| Charts | Recharts (score gauge) + plain `<img>` for SHAP base64 |
| State | React useState / useReducer (no Redux needed) |
| HTTP | Axios |
| Backend | FastAPI + Uvicorn |
| ML | XGBoost + SHAP |
| LLM | LangChain + Groq (Llama 3.1 8B) |
| Dataset | Home Credit Default Risk — Kaggle |

---

## API Endpoints (api/main.py)

```
POST /simulate-simah   → SimahProfile (random bureau sample)
POST /assess           → AssessmentResponse
GET  /health           → {"status": "ok"}
```

CORS: allow `http://localhost:5173` (Vite default).

---

## Schemas (api/schemas.py)

```python
class AssessmentRequest(BaseModel):
    bank_type: str          # "conservative" | "aggressive"
    gross_salary: float
    loan_amount: float
    loan_months: int
    employment_type: str    # "government" | "private" | "self"
    age: int
    language: str           # "ar" | "en"
    simah_profile: dict

class AssessmentResponse(BaseModel):
    passed_hard_rules: bool
    hard_rule_rejection: str | None
    pd_prob: float
    credit_score: int           # 300–900
    decision: str               # "APPROVED" | "REJECTED"
    risk_level: str             # "LOW" | "MEDIUM" | "HIGH"
    dbr: float
    shap_top5: list[dict]
    shap_plot_b64: str          # base64 PNG
    llm_reason: str
    llm_recommendation: str

class SimahProfile(BaseModel):
    total_debt: float
    max_overdue: float
    inquiries_last_month: int
    credit_history_days: int
    max_dpd: int
    raw_features: dict
```

---

## Service Orchestration (api/services.py)

```python
def run_assessment(req) -> AssessmentResponse:
    features = feature_engineering.build(req)
    rules    = rules_engine.check(features, req.bank_type, req.language)
    if not rules["passed"]:
        return early_rejection(rules["reason"])
    ml       = ml_inference.predict(features, req.bank_type)
    shap     = ml_explainer.explain(features, ml["pd_prob"])
    llm      = llm_reporter.generate(ml, shap, features, req.bank_type, req.language)
    return AssessmentResponse(**ml, **shap, **llm, passed_hard_rules=True, dbr=features["dbr"])
```

---

## ML Service (src/ml/inference.py)

```python
THRESHOLDS = {"conservative": 0.05, "aggressive": 0.15}
MIN_SCORES = {"conservative": 650,  "aggressive": 480}

def predict(features, bank_type) -> dict:
    pd_prob      = model.predict_proba([vector])[0][1]
    credit_score = max(300, min(900, int(900 - pd_prob * 600)))
    decision     = "REJECTED" if (pd_prob > THRESHOLDS[bank_type]
                   or credit_score < MIN_SCORES[bank_type]) else "APPROVED"
    risk_level   = "HIGH" if pd_prob > 0.15 else "MEDIUM" if pd_prob > 0.05 else "LOW"
    return {"pd_prob": pd_prob, "credit_score": credit_score,
            "decision": decision, "risk_level": risk_level}
```

---

## LLM Service (src/llm/reporter.py)

```python
def generate(ml_result, shap_result, features, bank_type, language) -> dict:
    # ChatGroq + PydanticOutputParser
    # System prompt: senior credit officer, SHAP-only, no legal advice
    # Returns: {"llm_reason": str, "llm_recommendation": str}
```

---

## SAMA Hard Rules (src/rules_engine.py)

```python
RULES = [
    {"check": lambda f: f["max_overdue"] > 0,
     "ar": "يوجد تعثر ائتماني نشط في سجلك لدى سمة",
     "en": "Active credit default found on SIMAH record"},

    {"check": lambda f: f["dbr"] > 0.3333,
     "ar": "نسبة عبء الدين تتجاوز الحد المسموح به 33.33% وفق أنظمة ساما",
     "en": "Debt Burden Ratio exceeds SAMA mandatory limit of 33.33%"},

    {"check": lambda f: f["gross_salary"] < 4000,
     "ar": "الراتب الشهري أقل من الحد الأدنى المطلوب 4,000 ريال",
     "en": "Monthly salary below minimum threshold of SAR 4,000"},

    {"check": lambda f: f["age"] < 21,
     "ar": "يشترط ألا يقل عمر المتقدم عن 21 سنة",
     "en": "Applicant must be at least 21 years old"},

    {"check": lambda f: f["age"] + f["loan_months"] / 12 > 60,
     "ar": "سيتجاوز عمرك 60 سنة عند انتهاء مدة القرض",
     "en": "Age at loan maturity exceeds maximum of 60 years"},
]
```

---

## React Frontend

### strings.js — all UI text
```js
export const STRINGS = {
  ar: {
    title:           "محلل المخاطر الائتمانية",
    bankConservative:"البنك المحافظ",
    bankAggressive:  "البنك الجريء",
    simulateBtn:     "محاكاة سحب بيانات سمة 🔄",
    submitBtn:       "تقييم الطلب",
    approved:        "✅ تم القبول",
    rejected:        "❌ تم الرفض",
    reason:          "سبب القرار",
    recommendation:  "التوصية",
    // ... all labels
  },
  en: {
    title:           "Credit Risk Analyzer",
    bankConservative:"Conservative Bank",
    bankAggressive:  "Aggressive Bank",
    simulateBtn:     "Simulate SIMAH Pull 🔄",
    submitBtn:       "Assess Application",
    approved:        "✅ Approved",
    rejected:        "❌ Rejected",
    reason:          "Decision Reason",
    recommendation:  "Recommendation",
  }
}
```

### api.js — all fetch calls
```js
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

export const simulateSimah = () =>
  fetch(`${BASE}/simulate-simah`, { method: "POST" }).then(r => r.json())

export const assess = (payload) =>
  fetch(`${BASE}/assess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then(r => r.json())
```

### App.jsx — state & layout
```jsx
const [lang, setLang]           = useState("ar")
const [bankType, setBankType]   = useState(null)
const [simah, setSimah]         = useState(null)
const [result, setResult]       = useState(null)
const [loading, setLoading]     = useState(false)
const t = STRINGS[lang]

// dir="rtl" on root div when lang === "ar"
```

### Component breakdown

| Component | Responsibility |
|---|---|
| `BankSelector` | Two cards, conservative vs aggressive, highlight selected |
| `UserInputForm` | salary, loan amount, duration, employment, age |
| `SimahPanel` | Simulate button + display pulled profile in a card |
| `CreditScoreGauge` | Recharts RadialBarChart 300–900, color-coded |
| `ShapPlot` | Render `shap_plot_b64` as `<img src={\`data:image/png;base64,${b64}\`}>` |
| `LLMReport` | Decision banner (green/red) + reason + recommendation |
| `ResultsDashboard` | Layout: 2-col (gauge + shap), full-width (LLM report) |

### RTL handling
```jsx
// App.jsx root div
<div dir={lang === "ar" ? "rtl" : "ltr"} className="min-h-screen ...">
```

---

## Bank Profiles

| Parameter | Conservative | Aggressive |
|---|---|---|
| PD threshold | 5% | 15% |
| Min SIMAH score | 650 | 480 |
| Interest rate | 2%–4% fixed | 7%–15% variable |
| Min salary | SAR 5,000 | SAR 4,000 |
| Max DBR | 33.33% (SAMA) | 33.33% (SAMA) |

---

## Feature Engineering

```python
new_annuity       = P * r / (1 - (1+r)**-n)
DBR               = (existing_obligations + new_annuity) / gross_salary
ANNUITY_TO_INCOME = new_annuity / gross_salary
EXT_SOURCE_avg    = mean([EXT_SOURCE_1, EXT_SOURCE_2, EXT_SOURCE_3])
SIMAH_SCORE       = 300 + (EXT_SOURCE_avg * 600)
```

---

## Model Training

```python
XGBClassifier(scale_pos_weight=11.5, n_estimators=300,
              max_depth=6, learning_rate=0.05,
              eval_metric="auc", early_stopping_rounds=20)
# Metrics: AUC-ROC (primary) + Recall (critical). NEVER accuracy.
```

---

## Environment Variables

```
# Backend (.env)
GROQ_API_KEY=
KAGGLE_USERNAME=
KAGGLE_KEY=

# Frontend (.env)
VITE_API_URL=http://localhost:8000
```

---

## Run Commands

```bash
# Download dataset
kaggle competitions download -c home-credit-default-risk
unzip home-credit-default-risk.zip -d data/

# Train model
jupyter notebook notebooks/training.ipynb

# Backend
uvicorn api.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev        # runs on localhost:5173
```

---