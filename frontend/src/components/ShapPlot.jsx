import { prettyFeature } from '../lib/featureLabels.js'

export default function ShapPlot({ top5, t }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white/80">{t.shapTitle}</h4>
      </div>

      {top5 && top5.length > 0 && (
        <ul className="space-y-2">
          {top5.map((d, i) => {
            const positive = d.direction === 'positive'
            return (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm"
              >
                <span className="truncate text-white/80">{prettyFeature(d.feature, t)}</span>
                <span
                  className={`font-mono text-xs ${
                    positive ? 'text-red-300' : 'text-growth-300'
                  }`}
                >
                  {positive ? '+' : ''}
                  {Number(d.shap_value).toFixed(3)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
