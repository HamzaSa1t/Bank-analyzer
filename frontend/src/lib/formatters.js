// Single source of truth for value formatting in the result UI.
// Returns the localized "Unavailable" placeholder when a value is missing
// (null / undefined / NaN) so callers don't each invent their own fallback.

export const SAMA_LIMIT = 0.3333

export const isFiniteNumber = (n) =>
  n !== null && n !== undefined && Number.isFinite(Number(n))

const unavailableLabel = (t) => t?.unavailable ?? 'Unavailable'

export const fmtPct = (n, dp = 1, t) =>
  isFiniteNumber(n) ? `${(Number(n) * 100).toFixed(dp)}%` : unavailableLabel(t)

export const fmtSar = (n, t) =>
  isFiniteNumber(n)
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(n))
    : unavailableLabel(t)

export const fmtSarPrefixed = (n, t) =>
  isFiniteNumber(n) ? `SAR ${fmtSar(n, t)}` : unavailableLabel(t)
