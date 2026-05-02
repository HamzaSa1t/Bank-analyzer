import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const initial = {
  gross_salary: 8000,
  loan_amount: 80000,
  loan_months: 36,
  age: 30,
}

export default function UserInputForm({ t, onSubmit, disabled, loading, employmentType, onEmploymentTypeChange }) {
  const [v, setV] = useState(initial)
  const [showEmploymentHint, setShowEmploymentHint] = useState(false)

  const set = (k) => (e) => setV({ ...v, [k]: e.target.value })

  const submit = (e) => {
    e.preventDefault()
    onSubmit({ ...v, employment_type: employmentType })
  }

  return (
    <form onSubmit={submit} className="card p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">{t.formTitle}</h3>
        <span className="label-muted">02</span>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label={t.grossSalary}>
          <input
            type="number"
            min="0"
            step="100"
            value={v.gross_salary}
            onChange={set('gross_salary')}
            className="input-field"
            required
          />
        </Field>

        <Field label={t.loanAmount}>
          <input
            type="number"
            min="0"
            step="500"
            value={v.loan_amount}
            onChange={set('loan_amount')}
            className="input-field"
            required
          />
        </Field>

        <Field label={`${t.loanMonths} — ${v.loan_months}`}>
          <input
            type="range"
            min="12"
            max="60"
            step="1"
            value={v.loan_months}
            onChange={set('loan_months')}
            className="w-full accent-electric-500"
          />
        </Field>

        <Field label={t.employmentType}>
          <div className="relative">
            <select
              value={employmentType}
              onChange={(e) => onEmploymentTypeChange(e.target.value)}
              onFocus={() => setShowEmploymentHint(true)}
              onBlur={() => setShowEmploymentHint(false)}
              onClick={() => setShowEmploymentHint(true)}
              title={t.gosiOverrideHint}
              className="input-field"
            >
              <option value="government">{t.employmentGov}</option>
              <option value="private">{t.employmentPriv}</option>
              <option value="self">{t.employmentSelf}</option>
            </select>
            <AnimatePresence>
              {showEmploymentHint && (
                <motion.div
                  key="employment-hint"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 right-0 top-full z-10 mt-2 rounded-lg border border-electric-400/30 bg-navy-900/95 p-2.5 text-[11px] leading-snug text-white/80 shadow-glow"
                >
                  {t.gosiOverrideHint}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Field>

        <Field label={t.age}>
          <input
            type="number"
            min="18"
            max="80"
            value={v.age}
            onChange={set('age')}
            className="input-field"
            required
          />
        </Field>
      </div>

      <div className="pt-2">
        <button type="submit" disabled={disabled || loading} className="btn-primary w-full md:w-auto">
          {loading ? t.loading : t.submitBtn}
        </button>
      </div>
    </form>
  )
}

function Field({ label, children }) {
  return (
    <label className="block space-y-2">
      <span className="label-muted">{label}</span>
      {children}
    </label>
  )
}
