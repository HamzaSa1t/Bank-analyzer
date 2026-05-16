import { useState } from 'react'

const initial = {
  gross_salary: 8000,
  loan_amount: 80000,
  loan_months: 36,
  age: 30,
}

const plainInputClass = 'w-full rounded-xl border border-white/10 bg-navy-900/60 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none'

export default function UserInputForm({ t, onSubmit, disabled, loading, employmentType, onEmploymentTypeChange }) {
  const [v, setV] = useState(initial)

  const set = (k) => (e) => setV({ ...v, [k]: e.target.value })

  const submit = (e) => {
    e.preventDefault()
    onSubmit({ ...v, employment_type: employmentType })
  }

  return (
    <form onSubmit={submit} className="card space-y-6 p-5 sm:p-6 md:p-8">
      <div className="min-w-0">
        <span className="label-muted block">{`${t.mpStep} 4`}</span>
        <h3 className="mt-1 break-words text-xl font-semibold">{t.formTitle}</h3>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label={t.grossSalary}>
          <input
            type="number"
            min="0"
            step="100"
            value={v.gross_salary}
            onChange={set('gross_salary')}
            className={plainInputClass}
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
            className={plainInputClass}
            required
          />
        </Field>

        <Field label={`${t.loanMonths} - ${v.loan_months}`}>
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
              title={t.gosiOverrideHint}
              className={plainInputClass}
            >
              <option value="government">{t.employmentGov}</option>
              <option value="private">{t.employmentPriv}</option>
              <option value="self">{t.employmentSelf}</option>
            </select>
          </div>
        </Field>

        <Field label={t.age}>
          <input
            type="number"
            min="18"
            max="80"
            value={v.age}
            onChange={set('age')}
            className={plainInputClass}
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
