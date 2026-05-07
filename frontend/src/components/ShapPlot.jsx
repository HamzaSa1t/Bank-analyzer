import { prettyFeature } from '../lib/featureLabels.js'

// SHAP magnitude below this is treated as effectively zero — the feature
// barely moved this prediction either way, so we color it neutrally rather
// than misleading the reader with a strong red/green based on a tiny sign.
const NEUTRAL_THRESHOLD = 0.005

export default function ShapPlot({ top5, t }) {
  return (
    <div className="space-y-4">
      <div className="flex min-w-0 items-center justify-between">
        <h4 className="break-words text-sm font-semibold text-white/80">{t.shapTitle}</h4>
      </div>

      {top5 && top5.length > 0 && (
        <ul className="space-y-2">
          {top5.map((d, i) => {
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

            const sign = isNeutral ? '' : raisesPd ? '+' : ''

            return (
              <li
                key={i}
                className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm"
              >
                <span className="min-w-0 break-words text-white/80">{prettyFeature(d.feature, t)}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeCls}`}
                  >
                    {badgeText}
                  </span>
                  <span className={`font-mono text-xs ${valueCls}`}>
                    {sign}
                    {value.toFixed(3)}
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
