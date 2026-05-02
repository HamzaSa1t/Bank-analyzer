import { motion } from 'framer-motion'
import CreditScoreGauge from './CreditScoreGauge.jsx'
import ShapPlot from './ShapPlot.jsx'
import LLMReport from './LLMReport.jsx'

const riskMap = {
  HIGH: { key: 'riskHigh', cls: 'text-red-300 border-red-400/30' },
  MEDIUM: { key: 'riskMedium', cls: 'text-amber-300 border-amber-400/30' },
  LOW: { key: 'riskLow', cls: 'text-growth-300 border-growth-500/30' },
}

const fmtPct = (n) => `${(Number(n || 0) * 100).toFixed(1)}%`

export default function ResultsDashboard({ result, t }) {
  if (!result) return null

  const r = riskMap[result.risk_level] || riskMap.MEDIUM
  // SAMA hard cap is 33.33% for every applicant (matches rules_engine.py and the spec).
  const samaLimit = 0.3333
  const exceedsSama = (result.dbr || 0) > samaLimit
  const samaMessage = exceedsSama ? t.samaExceedsPriv : t.samaWithinPriv

  const dbrPct = Math.min(100, Math.max(0, (result.dbr || 0) * 100))
  const dbrTone = exceedsSama ? 'bg-red-400' : result.dbr > 0.25 ? 'bg-amber-400' : 'bg-growth-400'

  return (
    <motion.section
      id="report"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="space-y-6 scroll-mt-20"
    >
      <h2 className="text-2xl font-bold sm:text-3xl">
        <span className="bg-gradient-to-r from-white to-growth-300 bg-clip-text text-transparent">
          {t.resultsTitle}
        </span>
      </h2>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6 space-y-6">
          <CreditScoreGauge score={result.credit_score} label={t.creditScore} />

          <div className="flex flex-wrap items-center gap-3">
            <span className={`pill ${r.cls}`}>
              <span className="label-muted text-inherit">{t.riskLevel}:</span>
              <span className="font-semibold">{t[r.key]}</span>
            </span>
            <span className="pill">
              PD: <span className="font-mono">{fmtPct(result.pd_prob)}</span>
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="label-muted">{t.dbr}</span>
              <span className="font-mono text-white/80">{fmtPct(result.dbr)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${dbrPct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`h-full ${dbrTone}`}
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="label-muted">{t.samaStatus}</span>
              <span
                className={`text-xs font-semibold ${
                  exceedsSama ? 'text-red-300' : 'text-growth-300'
                }`}
              >
                {samaMessage}
              </span>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <ShapPlot top5={result.shap_top5} t={t} />
        </div>
      </div>

      <LLMReport
        decision={result.decision}
        reason={result.llm_reason}
        recommendation={result.llm_recommendation}
        hardRuleRejection={result.hard_rule_rejection}
        t={t}
      />
    </motion.section>
  )
}
