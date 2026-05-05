You are Codex working in my project repo. Do these tasks carefully.

## 1. Commit current code first

Before making any changes, run:

```bash
git status
git add .
git commit -m "checkpoint before performance and responsive fixes"
```

If there is nothing to commit, continue.

---

## 2. Remove threshold = 0.5 model-performance output from ML files only

Find the ML/training/evaluation files that print or export model performance at the default threshold `0.5`.

Remove only the default threshold `0.5` reporting/output.

Keep:

* Conservative threshold results
* Aggressive threshold results
* AUC-ROC
* PR-AUC
* Brier score
* fold results
* calibration
* feature importance

Do NOT remove threshold logic used by the app unless it is only for printing/reporting default threshold `0.5`.

Expected result:

* No printed/exported “Default 0.5” threshold result from ML files
* Conservative and Aggressive bank metrics remain visible and unchanged

---

## 3. Fix responsive UI issues on mobile

When opening the website on a phone, some UI elements shift, resize strangely, or break layout.

Audit the frontend and make the layout responsive across:

* mobile
* tablet
* desktop

Focus on:

* navbar
* hero section
* cards
* model performance page
* apply/assessment form
* results dashboard
* charts/cards grids
* buttons and text overflow

Use Tailwind responsive classes where possible.

Guidelines:

* Use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` style patterns
* Avoid fixed widths that break on mobile
* Replace large fixed heights with `min-h-*` when needed
* Add `overflow-x-auto` for wide charts/tables
* Ensure cards use `w-full`
* Ensure text wraps properly with `break-words`
* Ensure buttons do not overflow
* Ensure RTL Arabic layout remains correct
* Keep current visual design as much as possible

---

## 4. Verify

After changes, run:

```bash
npm run build
```

from the frontend folder if applicable.

Also run any existing Python smoke test if available.

Then run:

```bash
git status
```

Summarize:

* what files changed
* what was removed
* what responsive fixes were applied
* whether build/tests passed

Do not change backend decision logic, pricing logic, ML model, or metrics values.
