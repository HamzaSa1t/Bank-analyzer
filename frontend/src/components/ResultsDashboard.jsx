import { useEffect } from 'react'
import { motion } from 'framer-motion'
import CreditScoreGauge from './CreditScoreGauge.jsx'
import ShapPlot from './ShapPlot.jsx'
import LLMReport from './LLMReport.jsx'
import { isFiniteNumber, fmtPct, fmtSar, SAMA_LIMIT } from '../lib/formatters.js'

const riskMap = {
  HIGH: { key: 'riskHigh', cls: 'text-red-300 border-red-400/30' },
  MEDIUM: { key: 'riskMedium', cls: 'text-amber-300 border-amber-400/30' },
  LOW: { key: 'riskLow', cls: 'text-growth-300 border-growth-500/30' },
}

// Backend response keys that callers expect to be present in the post-ML
// path. Used for an undefined-vs-null check so we can distinguish a deploy
// mismatch (field missing entirely) from a hard-rule rejection (field
// intentionally null).
const POST_ML_FIELDS = [
  'model_pd', 'max_pd_allowed', 'pd_threshold', 'min_score', 'credit_score',
  'final_dbr', 'offered_interest_rate', 'final_monthly_payment',
  'expected_revenue', 'expected_loss', 'expected_profit',
]

export default function ResultsDashboard({ result, t }) {
  if (!result) return null

  const isHardRejected = result.passed_hard_rules === false
  const r = riskMap[result.risk_level] || riskMap.MEDIUM

  const modelPd = result.model_pd
  const maxPd = result.max_pd_allowed
  const pdRef = result.pd_threshold
  const minScore = result.min_score
  const creditScore = result.credit_score
  const finalDbr = result.final_dbr
  const profit = result.expected_profit
  const failedRules = Array.isArray(result.failed_rules) ? result.failed_rules : []

  // Prefer the backend-emitted gate_results so client and server can never
  // disagree. Fall back to the recomputed-from-numbers logic only if the
  // backend response is missing the field (legacy responses).
  const backendGates =
    result.gate_results && typeof result.gate_results === 'object'
      ? result.gate_results
      : null

  const gateStatus = (key, fallback) => {
    if (backendGates && typeof backendGates[key] === 'string') {
      const v = backendGates[key]
      return { pass: v === 'pass', skipped: v === 'skipped' }
    }
    return fallback
  }

  const hardStatus = gateStatus('hard_rules', { pass: !isHardRejected, skipped: false })
  const pdStatus = gateStatus('pd_limit', {
    pass:
      !isHardRejected &&
      isFiniteNumber(modelPd) &&
      isFiniteNumber(maxPd) &&
      Number(modelPd) <= Number(maxPd),
    skipped: isHardRejected,
  })
  const scoreStatus = gateStatus('credit_score', {
    pass:
      !isHardRejected &&
      isFiniteNumber(creditScore) &&
      isFiniteNumber(minScore) &&
      Number(creditScore) >= Number(minScore),
    skipped: isHardRejected,
  })
  const dbrStatus = gateStatus('final_dbr', {
    pass: !isHardRejected && isFiniteNumber(finalDbr) && Number(finalDbr) <= SAMA_LIMIT,
    skipped: isHardRejected,
  })
  const profitStatus = gateStatus('profitability', {
    pass: !isHardRejected && isFiniteNumber(profit) && Number(profit) > 0,
    skipped: isHardRejected,
  })

  // Detail / sub strings stay client-side they read the displayed numbers
  // straight off the response and are never shown when the gate was skipped.
  const gates = [
    { label: t.gateHardRules, ...hardStatus },
    {
      label: t.gatePdMax,
      ...pdStatus,
      detail: pdStatus.skipped ? null : `${fmtPct(modelPd, 2)} / ${fmtPct(maxPd, 2)}`,
      sub: pdStatus.skipped ? null : `${t.preferredRef}: ${fmtPct(pdRef, 2)}`,
    },
    {
      label: t.gateScoreMin,
      ...scoreStatus,
      detail: scoreStatus.skipped ? null : `${creditScore} / ${minScore}`,
    },
    {
      label: t.gateFinalDbr,
      ...dbrStatus,
      detail: dbrStatus.skipped ? null : `${fmtPct(finalDbr, 2)} / ${fmtPct(SAMA_LIMIT, 2)}`,
    },
    {
      label: t.gateProfit,
      ...profitStatus,
      detail: profitStatus.skipped ? null : `SAR ${fmtSar(profit)}`,
    },
  ]

  const approved = result.decision === 'APPROVED'
  const failedReasons = failedRules.map((code) => t[`fr_${code}`] || code)
  const policyReason = isHardRejected
    ? failedReasons[0] || result.hard_rule_rejection
    : null

  // Consistency check: the backend already enforces decision/gates agreement
  // (api/services.py::enforce_decision_consistency). Warn loudly in DevTools
  // if a deploy ever drifts so we catch it without silently mis-rendering.
  useEffect(() => {
    if (approved && gates.some((g) => !g.skipped && !g.pass)) {
      // eslint-disable-next-line no-console
      console.warn(
        '[decision-consistency] backend reported APPROVED but a gate failed',
        { decision: result.decision, gates, failed_rules: failedRules },
      )
    }
  }, [approved, gates, failedRules, result.decision])

  // Missing-field observability: undefined (vs null) means the response is
  // partial — usually a deploy mismatch where Railway is older than the
  // local code. Null is intentional (hard-rule rejection nulls pricing).
  useEffect(() => {
    if (isHardRejected) return
    const missing = POST_ML_FIELDS.filter((k) => result[k] === undefined)
    if (missing.length) {
      // eslint-disable-next-line no-console
      console.warn('[result] backend response missing fields:', missing)
    }
  }, [result, isHardRejected])

  return (
    <motion.section
      id="report"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="space-y-6 scroll-mt-20"
    >
      <DecisionBanner approved={approved} t={t} />

      <h2 className="break-words text-2xl font-bold sm:text-3xl">
        <span className="bg-gradient-to-r from-white to-growth-300 bg-clip-text text-transparent">
          {t.resultsTitle}
        </span>
      </h2>

      <div
        role="note"
        className="break-words rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white/60"
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
            offeredRate={result.offered_interest_rate}
            monthlyPayment={result.final_monthly_payment}
            finalDbr={finalDbr}
            revenue={result.expected_revenue}
            loss={result.expected_loss}
            profit={profit}
          />
        </>
      )}

      <DecisionLogic t={t} gates={gates} />

      <WhyBlock
        t={t}
        approved={approved}
        failedRules={failedRules}
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
  const dbr = result.final_dbr ?? result.dbr
  const exceedsSama = isFiniteNumber(dbr) && Number(dbr) > SAMA_LIMIT
  const samaMessage = exceedsSama ? t.samaExceedsPriv : t.samaWithinPriv
  const dbrPct = isFiniteNumber(dbr) ? Math.min(100, Math.max(0, Number(dbr) * 100)) : 0
  const dbrTone = exceedsSama ? 'bg-red-400' : Number(dbr || 0) > 0.25 ? 'bg-amber-400' : 'bg-growth-400'

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card space-y-6 p-5 sm:p-6">
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
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="label-muted">{t.dbr}</span>
            <span className="font-mono text-white/80">{fmtPct(dbr)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${dbrPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={`h-full ${dbrTone}`}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
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

      <div className="card p-5 sm:p-6">
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
      className="card p-5 sm:p-6"
    >
      <h3 className="break-words text-lg font-semibold text-white">{t.assessmentStatusTitle}</h3>
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
    Number(profit) > 0 ? 'text-growth-300' : Number(profit) < 0 ? 'text-red-300' : 'text-white/80'
  const dbrTone = Number(finalDbr) > SAMA_LIMIT ? 'text-red-300' : 'text-white/80'

  const rows = [
    { label: t.modelPd, value: fmtPct(modelPd, 2) },
    { label: t.offeredInterestRate, value: fmtPct(offeredRate, 2) },
    {
      label: t.finalMonthlyPayment,
      value: isFiniteNumber(monthlyPayment) ? `SAR ${fmtSar(monthlyPayment)}` : 'Unavailable',
    },
    { label: t.finalDbr, value: fmtPct(finalDbr, 2), valueClass: dbrTone },
    {
      label: t.expectedRevenue,
      value: isFiniteNumber(revenue) ? `SAR ${fmtSar(revenue)}` : 'Unavailable',
    },
    {
      label: t.expectedLoss,
      value: isFiniteNumber(loss) ? `SAR ${fmtSar(loss)}` : 'Unavailable',
      valueClass: 'text-red-300/80',
    },
    {
      label: t.expectedProfit,
      value: isFiniteNumber(profit) ? `SAR ${fmtSar(profit)}` : 'Unavailable',
      valueClass: profitTone,
      bold: true,
    },
  ]

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="card p-5 sm:p-6"
    >
      <h3 className="break-words text-lg font-semibold text-white">{t.financialBreakdown}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex min-w-0 flex-col gap-1 rounded-lg border border-white/5 bg-white/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="label-muted">{row.label}</span>
            <span
              className={`break-words font-mono ${row.valueClass || 'text-white/80'} ${
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
      className="card p-5 sm:p-6"
    >
      <h3 className="break-words text-lg font-semibold text-white">{t.decisionLogic}</h3>
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
              className="flex min-w-0 flex-col gap-3 rounded-lg border border-white/5 bg-white/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${iconCls}`}
                >
                  {icon}
                </span>
                <div className="min-w-0 space-y-0.5">
                  <div className={`break-words ${gate.skipped ? 'text-white/50' : 'text-white/80'}`}>
                    {gate.label}
                  </div>
                  {gate.sub && <div className="text-xs text-white/40">{gate.sub}</div>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                {gate.detail && (
                  <span className="break-words font-mono text-xs text-white/60">{gate.detail}</span>
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

function WhyBlock({ t, approved, failedRules, failedReasons, policyReason }) {
  if (approved && failedRules.length === 0) {
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

  // Hard-rule rejection single-sentence policy-rule message.
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

  // Model-decision rejection bullet list of post-pricing failures.
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

function DecisionBanner({ approved, t }) {
  const tone = approved
    ? 'border-growth-500/40 bg-gradient-to-r from-growth-500/15 via-growth-500/10 to-growth-500/5 text-growth-100'
    : 'border-red-500/40 bg-gradient-to-r from-red-500/15 via-red-500/10 to-red-500/5 text-red-100'
  const labelTone = approved ? 'text-growth-300' : 'text-red-300'
  const label = approved ? t.decisionApproved : t.decisionRejected
  const subtitle = approved
    ? t.decisionApprovedSubtitle
    : t.decisionRejectedSubtitle
  const icon = approved ? (
    <svg viewBox="0 0 24 24" className="h-7 w-7 sm:h-9 sm:w-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-7 w-7 sm:h-9 sm:w-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`flex flex-col gap-3 rounded-2xl border px-5 py-5 sm:flex-row sm:items-center sm:gap-5 sm:px-7 sm:py-6 ${tone}`}
    >
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 sm:h-14 sm:w-14 ${labelTone}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className={`break-words text-3xl font-extrabold uppercase tracking-wide sm:text-4xl ${labelTone}`}>
          {label}
        </div>
        {subtitle && (
          <p className="mt-1 break-words text-sm text-white/75">{subtitle}</p>
        )}
      </div>
    </motion.div>
  )
}
