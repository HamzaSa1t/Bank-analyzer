You are Codex working in my project repo. Do these tasks carefully.

## 1. Add helpful code comments

Add concise comments to important parts of the codebase, especially:

* ML training/evaluation logic
* inference / prediction flow
* pricing and expected-profit logic
* hard-rule checks
* LLM/report generation
* main frontend result sections

Rules:

* Comments should explain WHY the code exists, not obvious syntax.
* Do not over-comment every line.
* Keep comments professional and short.
* Do not change app behavior.

---

## 2. Create README file

Create or update `README.md`.

Include:

* Project overview
* Tech stack
* How the system works
* ML model explanation
* Bank simulation / decision logic
* How to run backend
* How to run frontend
* Environment variables
* Model performance summary
* Disclaimer that this is a simulation, not a real lending system

Important:

* Do NOT commit README or any changes.
* Just leave the file modified in the working tree.

---

## 3. Add “Check model details” link on website

Find the text on the website:

```text
Uses the XGBoost algorithm to train a credit-risk model on large-scale real-world loan data (Home Credit dataset).
```

Under it, add a small link/button:

```text
Check the model details
```

Arabic:

```text
عرض تفاصيل النموذج
```

When clicked, it should open my GitHub model training file.

Use a constant for the URL, for example:

```js
const MODEL_TRAINING_GITHUB_URL = "PUT_GITHUB_TRAINING_FILE_URL_HERE";
```

If you can infer the actual GitHub URL from project config/package/repo remote, use it. Otherwise leave a clear placeholder and add a TODO comment.

Open the link in a new tab:

```jsx
target="_blank"
rel="noreferrer"
```

---

## 4. Make model training file show performance output clearly on GitHub

Goal:
When someone opens the model training file on GitHub, they should immediately see the model performance output clearly.

Find the model training file, likely:

```text
src/train.py
```

Add a large comment block near the top or bottom containing the latest performance output exactly and clearly.

Use a format like:

```python
"""
MODEL PERFORMANCE OUTPUT

Metric summary:
| Metric | Result |
|---|---:|
| ROC-AUC / OOF AUC | 0.7868 |
| Mean validation AUC | 0.7868 |
| Validation AUC std | 0.0035 |
| Mean train AUC | 0.8334 |
| Train-validation gap | 0.0466 |
| PR-AUC | 0.2812 |
| Brier score | 0.0659 |

Dataset / training:
| Metric | Result |
|---|---:|
| Mean best iteration | 1300 |
| Total rows | 307,511 |
| Positive rate | 0.0807 |
| Feature count | 289 |

Per-fold results:
| Fold | Validation AUC | Train AUC | Best Iteration |
|---:|---:|---:|---:|
| 1 | 0.7822 | 0.8265 | 1022 |
| 2 | 0.7916 | 0.8306 | 1270 |
| 3 | 0.7859 | 0.8366 | 1405 |
| 4 | 0.7900 | 0.8445 | 1702 |
| 5 | 0.7842 | 0.8287 | 1100 |

Threshold results:
| Threshold | Precision | Recall | F1 | Approval Rate | Confusion Matrix |
|---|---:|---:|---:|---:|---|
| Conservative 0.05 | 0.1415 | 0.8441 | 0.2423 | 0.5183 | TN=155511, FP=127175, FN=3869, TP=20956 |
| Aggressive 0.15 | 0.2618 | 0.4744 | 0.3374 | 0.8537 | TN=249481, FP=33205, FN=13049, TP=11776 |

Notes:
- Default threshold 0.5 is intentionally omitted because it is not meaningful for this imbalanced credit-risk use case.
- The model is used for risk ranking / PD estimation.
- Final loan decisions are made by the bank simulation using risk, pricing, profitability, and policy gates.
"""
```

Important:

* Do not add the default threshold 0.5 output.
* Keep Conservative and Aggressive metrics.
* Do not change training behavior unless needed to keep comments/doc output clean.

---

## 5. Verify

Run formatting/build checks if available:

```bash
git status
```

If frontend build exists:

```bash
cd frontend
npm run build
```

If Python smoke tests exist, run them.

Return a short summary:

* comments added
* README created/updated
* GitHub link added or placeholder left
* training file performance output added
* tests/build status

Do NOT commit the changes.

