// Single source of truth for user-facing labels of model feature columns.

export const FEATURE_LABELS = {
  EXT_SOURCE_AVG: 'Overall credit history strength',
  EXT_SOURCE_1: 'Credit history strength',
  EXT_SOURCE_2: 'Repayment behavior score',
  EXT_SOURCE_3: 'External credit profile score',
  EXT_SOURCE_STD: 'Credit score variability',
  EXT_SOURCE_MIN: 'Lowest external credit score',
  EXT_SOURCE_MAX: 'Highest external credit score',
  EXT_SOURCE_1_MISSING: 'Missing external score 1',
  EXT_SOURCE_2_MISSING: 'Missing external score 2',
  EXT_SOURCE_3_MISSING: 'Missing external score 3',
  SIMAH_SCORE: 'Simulated credit score',
  AMT_CREDIT: 'Requested loan amount',
  AMT_GOODS_PRICE: 'Estimated financed item value',
  AMT_ANNUITY: 'Monthly payment amount',
  AMT_INCOME_TOTAL: 'Monthly income',
  YEARS_EMPLOYED: 'Employment length',
  AGE_YEARS: 'Applicant age',
  ID_PUBLISH_YEARS: 'Years since ID was published',
  REGISTRATION_YEARS: 'Years since civil registration',
  LAST_PHONE_CHANGE_YEARS: 'Years since last phone update',
  DAYS_EMPLOYED_ANOMALY: 'Employment record anomaly',
  DBR: 'Monthly debt burden',
  CREDIT_INCOME_RATIO: 'Loan size compared with income',
  INSTAL_PCT_LATE: 'Late payment history',
  INSTAL_DAYS_LATE_MAX: 'Worst payment delay',
  INSTAL_DAYS_LATE_MEAN: 'Average payment delay',
  INSTAL_PAYMENT_RATE: 'Past payment consistency',
  INSTAL_VERSION_MEAN: 'Loan reschedule frequency',
  INSTAL_VERSION_MAX: 'Maximum loan reschedules',
  INSTAL_COUNT: 'Number of past installments',
  INSTAL_AMT_INSTAL_MEAN: 'Average past installment amount',
  INSTAL_AMT_PAYMENT_MEAN: 'Average past payment amount',
  INSTAL_DPD_MEAN: 'Average days past due',
  PREV_APP_COUNT: 'Number of previous applications',
  PREV_AMT_CREDIT_MEAN: 'Average previous loan amount',
  PREV_DOWN_PAYMENT_MEAN: 'Average previous down payment',
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
  AMT_REQ_CREDIT_BUREAU_YEAR: 'Credit inquiries in past year',
  ANNUITY_CREDIT_RATIO: 'Monthly payment pressure',
  GOODS_CREDIT_RATIO: 'Financed amount compared with item value',
  BUREAU_DEBT_CREDIT_RATIO_MAX: 'Highest debt pressure on existing credit',
  OWN_CAR_AGE: 'Vehicle age',
  CODE_GENDER_M: 'Applicant gender',
  CNT_CHILDREN: 'Number of children',
  CNT_FAM_MEMBERS: 'Family size',
  INCOME_PER_PERSON: 'Income per family member',
  CHILDREN_RATIO: 'Children-to-family ratio',
  REGION_POPULATION_RELATIVE: 'Region population density',
  REGION_RATING_CLIENT: 'Region risk rating',
  REGION_RATING_CLIENT_W_CITY: 'Region and city risk rating',
  REG_CITY_NOT_LIVE_CITY: 'Lives outside registered city',
  REG_CITY_NOT_WORK_CITY: 'Works outside registered city',
  LIVE_CITY_NOT_WORK_CITY: 'Lives outside work city',
  DEF_30_CNT_SOCIAL_CIRCLE: '30-day defaults in social circle',
  DEF_60_CNT_SOCIAL_CIRCLE: '60-day defaults in social circle',
  FLAG_EMP_PHONE: 'Employer phone on file',
  FLAG_WORK_PHONE: 'Work phone on file',
  FLAG_PHONE: 'Phone on file',
  FLAG_EMAIL: 'Email on file',
  FLAG_OWN_CAR_Y: 'Owns a car',
  FLAG_OWN_CAR_N: 'Does not own a car',
  FLAG_OWN_REALTY_Y: 'Owns property',
  FLAG_OWN_REALTY_N: 'Does not own property',
  HOUR_APPR_PROCESS_START: 'Application hour',
}

// Prefix-based fallback for one-hot encoded categorical features. The model
// emits SHAP per one-hot column (e.g. NAME_INCOME_TYPE_Working); without this
// the UI would surface raw names like "NAME_FAMILY_STATUS_Married".
const ONE_HOT_PREFIXES = {
  NAME_CONTRACT_TYPE: 'Loan product type',
  NAME_TYPE_SUITE: 'Accompanying party',
  NAME_INCOME_TYPE: 'Income source',
  NAME_EDUCATION_TYPE: 'Education level',
  NAME_FAMILY_STATUS: 'Marital status',
  NAME_HOUSING_TYPE: 'Housing type',
  ORGANIZATION_TYPE: 'Employer type',
  OCCUPATION_TYPE: 'Occupation',
  WEEKDAY_APPR_PROCESS_START: 'Application weekday',
  CODE_GENDER: 'Applicant gender',
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

const humanizeOneHotSuffix = (suffix) =>
  suffix.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()

export const prettyFeature = (name, t) => {
  if (!name) return name
  const direct = t?.[`feat_${name}`] ?? FEATURE_LABELS[name]
  if (direct) return direct

  // One-hot fallback: NAME_INCOME_TYPE_Working → "Income source: Working"
  for (const [prefix, fallbackLabel] of Object.entries(ONE_HOT_PREFIXES)) {
    if (name.startsWith(prefix + '_')) {
      const label = t?.[`feat_prefix_${prefix}`] ?? fallbackLabel
      const suffix = humanizeOneHotSuffix(name.slice(prefix.length + 1))
      return suffix ? `${label}: ${suffix}` : label
    }
  }
  return name
}

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
