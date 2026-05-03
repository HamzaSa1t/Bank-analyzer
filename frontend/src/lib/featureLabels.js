// Single source of truth for user-facing labels of model feature columns.

export const FEATURE_LABELS = {
  EXT_SOURCE_AVG: 'Overall credit history strength',
  EXT_SOURCE_1: 'Credit history strength',
  EXT_SOURCE_2: 'Repayment behavior score',
  EXT_SOURCE_3: 'External credit profile score',
  SIMAH_SCORE: 'Simulated credit score',
  AMT_CREDIT: 'Requested loan amount',
  AMT_GOODS_PRICE: 'Estimated financed item value',
  AMT_ANNUITY: 'Monthly payment amount',
  AMT_INCOME_TOTAL: 'Monthly income',
  YEARS_EMPLOYED: 'Employment length',
  AGE_YEARS: 'Applicant age',
  DBR: 'Monthly debt burden',
  CREDIT_INCOME_RATIO: 'Loan size compared with income',
  INSTAL_PCT_LATE: 'Late payment history',
  INSTAL_DAYS_LATE_MAX: 'Worst payment delay',
  INSTAL_DAYS_LATE_MEAN: 'Average payment delay',
  INSTAL_PAYMENT_RATE: 'Past payment consistency',
  BUREAU_CREDIT_AGE_MAX: 'Credit history length',
  BUREAU_MAX_OVERDUE: 'Highest overdue balance',
  BUREAU_DAYS_OVERDUE_MAX: 'Longest overdue period',
  BUREAU_DEBT_TOTAL: 'Existing credit obligations',
  BUREAU_LIMIT_TOTAL: 'Available credit limit',
  BUREAU_UTIL_RATIO: 'Credit usage level',
  BUREAU_ACTIVE_COUNT: 'Number of active loans',
  BUREAU_PROLONGED_COUNT: 'Repeated loan extensions',
  CARD_UTIL_RATIO_AVG: 'Average card usage',
  CARD_UTIL_RATIO_MAX: 'Highest card usage',
  CARD_DPD_MAX: 'Worst card payment delay',
  CARD_PAYMENT_RATIO: 'Card repayment consistency',
  CARD_MONTHS_ACTIVE: 'Recent card activity',
  IS_EMPLOYED: 'Stable employment status',
  AMT_REQ_CREDIT_BUREAU_MON: 'Recent credit applications',
  ANNUITY_CREDIT_RATIO: 'Monthly payment pressure',
  GOODS_CREDIT_RATIO: 'Financed amount compared with item value',
  BUREAU_DEBT_CREDIT_RATIO_MAX: 'Highest debt pressure on existing credit',
  OWN_CAR_AGE: 'Vehicle age',
  CODE_GENDER_M: 'Applicant gender',
}

const FEATURE_ALIASES = {
  EXT_SOURCE_AVG: ['Credit Bureau Score (Average)'],
  EXT_SOURCE_1: ['Credit Bureau Score (Source 1)'],
  EXT_SOURCE_2: ['Credit Bureau Score (Source 2)'],
  EXT_SOURCE_3: ['Credit Bureau Score (Source 3)'],
  SIMAH_SCORE: ['SIMAH Score'],
  AMT_CREDIT: ['Loan Amount'],
  AMT_ANNUITY: ['Monthly Installment'],
  AMT_INCOME_TOTAL: ['Monthly Income'],
  YEARS_EMPLOYED: ['Years of Employment'],
  DBR: ['Debt Burden Ratio'],
  CREDIT_INCOME_RATIO: ['Loan-to-Income Ratio'],
  INSTAL_PCT_LATE: ['Late Payment Rate'],
  BUREAU_DEBT_TOTAL: ['Total Bureau Debt'],
  BUREAU_LIMIT_TOTAL: ['Total Credit Limit'],
  BUREAU_UTIL_RATIO: ['Credit Utilization Ratio'],
  ANNUITY_CREDIT_RATIO: ['Annuity-to-Loan Ratio'],
  GOODS_CREDIT_RATIO: ['Goods Price-to-Loan Ratio'],
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const prettyFeature = (name, t) => t?.[`feat_${name}`] ?? FEATURE_LABELS[name] ?? name

export const humanizeFeatureText = (text, t) => {
  if (!text) return text
  let out = String(text)
  Object.entries(FEATURE_LABELS).forEach(([key, fallback]) => {
    const label = t?.[`feat_${key}`] ?? fallback
    out = out.replace(new RegExp(`\\b${escapeRegExp(key)}\\b`, 'g'), label)
    out = out.replace(new RegExp(escapeRegExp(fallback), 'g'), label)
    ;(FEATURE_ALIASES[key] ?? []).forEach((alias) => {
      out = out.replace(new RegExp(escapeRegExp(alias), 'g'), label)
    })
  })
  return out
}
