import { motion, AnimatePresence } from 'framer-motion'

const sectorLabel = (t, sector) => {
  if (sector === 'government') return t.gosiSectorGov
  if (sector === 'self') return t.gosiSectorSelf
  return t.gosiSectorPriv
}

export default function GosiPanel({ t, gosi }) {
  return (
    <div className="card space-y-5 p-5 sm:p-6 md:p-8">
      <div className="min-w-0">
        <span className="label-muted block">{`${t.mpStep} 3`}</span>
        <h3 className="mt-1 break-words text-xl font-semibold">{t.gosiTitle}</h3>
        <p className="mt-2 max-w-xl break-words text-sm text-white/55">{t.gosiHelper}</p>
      </div>

      <AnimatePresence mode="wait">
        {gosi ? (
          <motion.div
            key="gosi-data"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="grid grid-cols-1 gap-3 md:grid-cols-3"
          >
            <Cell
              label={t.gosiYears}
              value={`${gosi.years_of_service} ${t.gosiYearsUnit}`}
            />
            <Cell
              label={t.gosiSector}
              value={sectorLabel(t, gosi.employer_sector)}
            />
            <Cell
              label={t.gosiStatus}
              value={t.gosiActive}
              tone="ok"
            />
          </motion.div>
        ) : (
          <motion.p
            key="gosi-empty"
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
    <div className={`min-w-0 rounded-xl border bg-white/[0.02] p-3 ${accent.split(' ')[1]}`}>
      <div className={`break-words text-base font-semibold ${accent.split(' ')[0]}`}>{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-white/40">{label}</div>
    </div>
  )
}
