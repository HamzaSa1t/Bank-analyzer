import { motion, AnimatePresence } from 'framer-motion'

const fmt = (n, digits = 0) => {
  if (n === undefined || n === null || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export default function SimahPanel({ t, simah, onSimulate, loading }) {
  return (
    <div className="card p-6 md:p-8 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <span className="label-muted block">01</span>
          <h3 className="mt-1 text-xl font-semibold">{t.simahTitle}</h3>
        </div>
        <button
          type="button"
          onClick={onSimulate}
          disabled={loading}
          className="btn-ghost"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-growth-400" />
              {t.loading}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 10a7 7 0 0114-1M17 10a7 7 0 01-14 1M3 5v4h4M17 15v-4h-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t.simulateBtn}
            </span>
          )}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {simah ? (
          <motion.div
            key="simah-data"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="grid grid-cols-2 gap-3 md:grid-cols-5"
          >
            <Cell label={t.simahTotalDebt} value={fmt(simah.total_debt)} />
            <Cell
              label={t.simahMaxOverdue}
              value={fmt(simah.max_overdue)}
              tone={simah.max_overdue > 0 ? 'danger' : 'ok'}
            />
            <Cell label={t.simahInquiries} value={fmt(simah.inquiries_last_month)} />
            <Cell label={t.simahHistory} value={fmt(simah.credit_history_days)} />
            <Cell
              label={t.simahDpd}
              value={fmt(simah.max_dpd)}
              tone={simah.max_dpd > 30 ? 'warn' : 'ok'}
            />
          </motion.div>
        ) : (
          <motion.p
            key="simah-empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm text-white/40"
          >
            {t.simulateFirst}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

function Cell({ label, value, tone }) {
  const accent =
    tone === 'danger'
      ? 'text-red-300 border-red-400/30'
      : tone === 'warn'
      ? 'text-amber-300 border-amber-400/30'
      : 'text-growth-300 border-growth-500/20'
  return (
    <div className={`rounded-xl border bg-white/[0.02] p-3 ${accent.split(' ')[1]}`}>
      <div className={`text-base font-semibold ${accent.split(' ')[0]}`}>{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-white/40">{label}</div>
    </div>
  )
}
