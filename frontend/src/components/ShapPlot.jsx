import { prettyFeature } from '../lib/featureLabels.js'

// SHAP magnitude below this is treated as effectively zero — the feature
// barely moved this prediction either way, so we color it neutrally rather
// than misleading the reader with a strong red/green based on a tiny sign.
const NEUTRAL_THRESHOLD = 0.005

export default function ShapPlot({ top5, t }) {
  const items = (Array.isArray(top5) ? top5 : []).filter(
    (d) => d?.feature !== 'CODE_GENDER_M' && !String(d?.feature ?? '').startsWith('CODE_GENDER'),
  )
  // Normalize each driver's contribution as a share of the visible top-N
  // sum, so each row reads as a clean "X% impact" instead of a raw SHAP value.
  const total = items.reduce((sum, d) => sum + Math.abs(Number(d?.shap_value) || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h4 className="break-words text-sm font-semibold text-white/80">{t.shapTitle}</h4>
        {t.shapSubtitle && (
          <span className="break-words text-[11px] font-normal text-white/45">
            ({t.shapSubtitle})
          </span>
        )}
      </div>

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((d, i) => {
            const value = Number(d.shap_value)
            const magnitude = Math.abs(value)
            const isNeutral = !Number.isFinite(value) || magnitude < NEUTRAL_THRESHOLD
            const raisesPd = !isNeutral && (d.direction === 'positive' || value > 0)

            const valueCls = isNeutral
              ? 'text-white/60'
              : raisesPd
              ? 'text-red-300'
              : 'text-growth-300'

            const badgeCls = isNeutral
              ? 'border-white/15 bg-white/5 text-white/60'
              : raisesPd
              ? 'border-red-400/30 bg-red-500/10 text-red-300'
              : 'border-growth-500/30 bg-growth-500/10 text-growth-300'

            const badgeText = isNeutral
              ? t.driverNeutral
              : raisesPd
              ? t.driverHurting
              : t.driverHelping

            // Hurting (raises PD) → ↓ red: drags approval down.
            // Helping (lowers PD)  → ↑ green: lifts approval up.
            const arrow = isNeutral ? '·' : raisesPd ? '↓' : '↑'
            const pct = total > 0 ? Math.round((magnitude / total) * 100) : 0

            return (
              <li
                key={i}
                className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 break-words text-white/80">{prettyFeature(d.feature, t)}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeCls}`}
                  >
                    {badgeText}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 font-mono text-xs ${valueCls}`}
                    aria-label={`${pct}% impact, ${badgeText}`}
                  >
                    <span aria-hidden>{arrow}</span>
                    {pct}%
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
