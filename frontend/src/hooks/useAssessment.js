import { useCallback, useEffect, useState } from 'react'
import * as api from '../lib/api'

// preprocessing.py drops DAYS_EMPLOYED but keeps YEARS_EMPLOYED (already in
// years, with Home Credit's 365243 sentinel mapped to 0.0) read that column.
const yearsFromYearsEmployed = (yearsEmployed) => {
  const y = Number(yearsEmployed)
  if (!Number.isFinite(y)) return 0
  return Math.max(0, Math.floor(y))
}

const monthsFromYearsEmployed = (yearsEmployed) => {
  const y = Number(yearsEmployed)
  if (!Number.isFinite(y)) return 0
  return Math.max(0, y * 12)
}

const SAMA_MIN_MONTHS = { government: 3, private: 12, self: 12 }

export function useAssessment({ lang }) {
  const [bankType, setBankType] = useState(null)
  const [employmentType, setEmploymentType] = useState('private')
  const [simah, setSimah] = useState(null)
  const [gosi, setGosi] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [bureauLoading, setBureauLoading] = useState(false)
  const [error, setError] = useState(null)

  const runSimulateBureau = useCallback(async () => {
    setBureauLoading(true)
    setError(null)
    try {
      const data = await api.simulateSimah()
      setSimah(data)
      const years = data?.raw_features?.YEARS_EMPLOYED
      setGosi({
        years_of_service: yearsFromYearsEmployed(years),
        months_of_service: monthsFromYearsEmployed(years),
        employer_sector: employmentType,
        subscription_status: 'active',
      })
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Simulation failed')
    } finally {
      setBureauLoading(false)
    }
  }, [employmentType])

  // Two-way sync: when the Employment dropdown changes, the GOSI panel sector
  // updates automatically to match (display-only; backend always uses the dropdown).
  useEffect(() => {
    setGosi((g) => (g ? { ...g, employer_sector: employmentType } : g))
  }, [employmentType])

  const setGosiSector = useCallback((sector) => {
    setGosi((g) => (g ? { ...g, employer_sector: sector } : g))
  }, [])

  const runAssess = useCallback(async (formValues) => {
    if (!bankType) {
      setError('select_bank')
      return
    }
    if (!simah) {
      setError('simulate_first')
      return
    }
    const minMonths = SAMA_MIN_MONTHS[employmentType] ?? 12
    if (!gosi || (gosi.months_of_service ?? 0) < minMonths) {
      setError('sama_min_employment')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const payload = {
        bank_type: bankType,
        gross_salary: Number(formValues.gross_salary),
        loan_amount: Number(formValues.loan_amount),
        loan_months: Number(formValues.loan_months),
        employment_type: employmentType,
        age: Number(formValues.age),
        language: lang,
        simah_profile: simah,
      }
      const data = await api.assess(payload)
      setResult({ ...data, employment_type: employmentType, gross_salary: Number(formValues.gross_salary) })
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Assessment failed')
    } finally {
      setLoading(false)
    }
  }, [bankType, simah, gosi, lang, employmentType])

  const reset = useCallback(() => {
    setResult(null)
    setSimah(null)
    setGosi(null)
    setError(null)
  }, [])

  return {
    bankType, setBankType,
    employmentType, setEmploymentType,
    simah, gosi,
    runSimulateBureau, bureauLoading,
    setGosiSector,
    result, runAssess, loading,
    error, setError,
    reset,
  }
}
