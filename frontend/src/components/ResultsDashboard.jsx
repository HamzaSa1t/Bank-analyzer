import { motion } from 'framer-motion'
import CreditScoreGauge from './CreditScoreGauge.jsx'
import ShapPlot from './ShapPlot.jsx'
import LLMReport from './LLMReport.jsx'

const riskMap = {
  HIGH: { key: 'riskHigh', cls: 'text-red-300 border-red-400/30' },
  MEDIUM: { key: 'riskMedium', cls: 'text-amber-300 border-amber-400/30' },
  LOW: { key: 'riskLow', cls: 'text-growth-300 border-growth-500/30' },
}

const fmtPct = (n, dp = 1) => `${(Number(n || 0) * 100).toFixed(dp)}%`
const fmtSar = (n) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(n || 0))

const SAMA_LIMIT = 0.3333

export default function ResultsDashboard({ result, t }) {
  if (!result) return null

  const isHardRejected = result.passed_hard_rules === false
  const r = riskMap[result.risk_level] || riskMap.MEDIUM

  const modelPd = Number(result.model_pd ?? result.pd_prob ?? 0)
  const maxPd = Number(result.max_pd_allowed ?? 0)
  const pdRef = Number(result.pd_threshold ?? 0)
  const minScore = Number(result.min_score ?? 0)
  const creditScore = Number(result.credit_score ?? 0)
  const finalDbr = Number(result.final_dbr ?? result.dbr ?? 0)
  const profit = Number(result.expected_profit ?? 0)
  const failedRules = Array.isArray(result.failed_rules) ? result.failed_rules : []

  // When hard rules fail, the four model-dependent gates were never evaluated —
  // mark them `skipped` so the UI can render ⏭ instead of a misleading ✕ with
  // zero values.
  const gates = [
    { label: t.gateHardRules, pass: !isHardRejected },
    {
      label: t.gatePdMax,
      pass: !isHardRejected && modelPd <= maxPd,
      skipped: isHardRejected,
      detail: isHardRejected ? null : `${fmtPct(modelPd, 2)} / ${fmtPct(maxPd, 2)}`,
      sub: isHardRejected ? null : `${t.preferredRef}: ${fmtPct(pdRef, 2)}`,
    },
    {
      label: t.gateScoreMin,
      pass: !isHardRejected && creditScore >= minScore,
      skipped: isHardRejected,
      detail: isHardRejected ? null : `${creditScore} / ${minScore}`,
    },
    {
      label: t.gateFinalDbr,
      pass: !isHardRejected && finalDbr <= SAMA_LIMIT,
      skipped: isHardRejected,
      detail: isHardRejected ? null : `${fmtPct(finalDbr, 2)} / ${fmtPct(SAMA_LIMIT, 2)}`,
    },
    {
      label: t.gateProfit,
      pass: !isHardRejected && profit > 0,
      skipped: isHardRejected,
      detail: isHardRejected ? null : `SAR ${fmtSar(profit)}`,
    },
  ]

  const approved = result.decision === 'APPROVED'
  const failedReasons = failedRules.map((code) => t[`fr_${code}`] || code)
  const policyReason = isHardRejected
    ? failedReasons[0] || result.hard_rule_rejection
    : null

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

      <div
        role="note"
        className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white/60"
      >
        {t.resultsDisclaimer}
      </div>

      {isHardRejected ? (
        <AssessmentStatus t={t} />
      ) : (
        <>
          <ScoreAndShapGrid result={result} riskBadge={r} t={t} modelPd={modelPd} />
          <FinancialBreakdown
            t={t}
            modelPd={modelPd}
            offeredRate={Number(result.offered_interest_rate ?? 0)}
            monthlyPayment={Number(result.final_monthly_payment ?? 0)}
            finalDbr={finalDbr}
            revenue={Number(result.expected_revenue ?? 0)}
            loss={Number(result.expected_loss ?? 0)}
            profit={profit}
          />
        </>
      )}

      <DecisionLogic t={t} gates={gates} />

      <WhyBlock
        t={t}
        approved={approved}
        failedReasons={failedReasons}
        policyReason={policyReason}
      />

      <LLMReport
        decision={result.decision}
        riskSummary={result.risk_summary}
        keyStrengths={result.key_strengths}
        keyConcerns={result.key_concerns}
        decisionExplanation={result.decision_explanation}
        suggestedActions={result.suggested_actions}
        hardRuleRejection={result.hard_rule_rejection}
        t={t}
      />
    </motion.section>
  )
}

function ScoreAndShapGrid({ result, riskBadge, t, modelPd }) {
  const exceedsSama = (result.dbr || 0) > SAMA_LIMIT
  const samaMessage = exceedsSama ? t.samaExceedsPriv : t.samaWithinPriv
  const dbrPct = Math.min(100, Math.max(0, (result.dbr || 0) * 100))
  const dbrTone = exceedsSama ? 'bg-red-400' : result.dbr > 0.25 ? 'bg-amber-400' : 'bg-growth-400'

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card p-6 space-y-6">
        <CreditScoreGauge score={result.credit_score} label={t.creditScore} />

        <div className="flex flex-wrap items-center gap-3">
          <span className={`pill ${riskBadge.cls}`}>
            <span className="label-muted text-inherit">{t.riskLevel}:</span>
            <span className="font-semibold">{t[riskBadge.key]}</span>
          </span>
          <span className="pill" title={t.modelPdTooltip}>
            {t.modelPdShort}: <span className="font-mono">{fmtPct(modelPd)}</span>
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
  )
}

function AssessmentStatus({ t }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="card p-6"
    >
      <h3 className="text-lg font-semibold text-white">{t.assessmentStatusTitle}</h3>
      <p className="mt-3 text-sm leading-relaxed text-white/70 whitespace-pre-line">
        {t.assessmentStatusBody}
      </p>
    </motion.section>
  )
}

function FinancialBreakdown({
  t,
  modelPd,
  offeredRate,
  monthlyPayment,
  finalDbr,
  revenue,
  loss,
  profit,
}) {
  const profitTone =
    profit > 0 ? 'text-growth-300' : profit < 0 ? 'text-red-300' : 'text-white/80'
  const dbrTone = finalDbr > SAMA_LIMIT ? 'text-red-300' : 'text-white/80'

  const rows = [
    { label: t.modelPd, value: fmtPct(modelPd, 2) },
    { label: t.offeredInterestRate, value: fmtPct(offeredRate, 2) },
    { label: t.finalMonthlyPayment, value: `SAR ${fmtSar(monthlyPayment)}` },
    { label: t.finalDbr, value: fmtPct(finalDbr, 2), valueClass: dbrTone },
    { label: t.expectedRevenue, value: `SAR ${fmtSar(revenue)}` },
    { label: t.expectedLoss, value: `SAR ${fmtSar(loss)}`, valueClass: 'text-red-300/80' },
    { label: t.expectedProfit, value: `SAR ${fmtSar(profit)}`, valueClass: profitTone, bold: true },
  ]

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="card p-6"
    >
      <h3 className="text-lg font-semibold text-white">{t.financialBreakdown}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-4 py-3"
          >
            <span className="label-muted">{row.label}</span>
            <span
              className={`font-mono ${row.valueClass || 'text-white/80'} ${
                row.bold ? 'font-semibold' : ''
              }`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </motion.section>
  )
}

function DecisionLogic({ t, gates }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="card p-6"
    >
      <h3 className="text-lg font-semibold text-white">{t.decisionLogic}</h3>
      <ul className="mt-4 space-y-2">
        {gates.map((gate) => {
          const iconCls = gate.skipped
            ? 'bg-white/10 text-white/50'
            : gate.pass
            ? 'bg-growth-500/20 text-growth-300'
            : 'bg-red-500/20 text-red-300'
          const verdictCls = gate.skipped
            ? 'text-white/50'
            : gate.pass
            ? 'text-growth-300'
            : 'text-red-300'
          const icon = gate.skipped ? '⏭' : gate.pass ? '✓' : '✕'
          const verdict = gate.skipped ? t.gateSkipped : gate.pass ? t.gatePass : t.gateFail

          return (
            <li
              key={gate.label}
              className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-4 py-3 text-sm"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${iconCls}`}
                >
                  {icon}
                </span>
                <div className="space-y-0.5">
                  <div className={gate.skipped ? 'text-white/50' : 'text-white/80'}>
                    {gate.label}
                  </div>
                  {gate.sub && <div className="text-xs text-white/40">{gate.sub}</div>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {gate.detail && (
                  <span className="font-mono text-xs text-white/60">{gate.detail}</span>
                )}
                <span className={`text-xs font-semibold ${verdictCls}`}>{verdict}</span>
              </div>
            </li>
          )
        })}
      </ul>
    </motion.section>
  )
}

function WhyBlock({ t, approved, failedReasons, policyReason }) {
  if (approved) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-xl border border-growth-500/30 bg-growth-500/10 p-5 text-sm text-growth-200"
      >
        <div className="font-semibold">{t.whyApproved}</div>
        <p className="mt-1 text-growth-100/90">{t.whyApprovedBody}</p>
      </motion.div>
    )
  }

  // Hard-rule rejection — single-sentence policy-rule message.
  if (policyReason) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-xl border border-red-400/30 bg-red-500/10 p-5 text-sm text-red-200"
      >
        <div className="font-semibold">{t.whyRejected}</div>
        <p className="mt-1 text-red-100/90">
          {t.whyRejectedPolicy} <span className="font-medium">{policyReason}</span>
        </p>
      </motion.div>
    )
  }

  // Model-decision rejection — bullet list of post-pricing failures.
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-red-400/30 bg-red-500/10 p-5 text-sm text-red-200"
    >
      <div className="font-semibold">{t.whyRejected}</div>
      {failedReasons.length === 0 ? (
        <p className="mt-1 text-red-100/90">{t.whyRejectedPrefix}</p>
      ) : (
        <>
          <p className="mt-1 text-red-100/90">{t.whyRejectedPrefix}</p>
          <ul className="mt-2 space-y-1.5">
            {failedReasons.map((reason, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </motion.div>
  )
}
