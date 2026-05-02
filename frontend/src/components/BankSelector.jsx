import { motion } from 'framer-motion'

const banks = [
  {
    type: 'conservative',
    titleKey: 'bankConservative',
    descKey: 'bankConservativeDesc',
    pd: '5%',
    minScore: '650',
    rate: '2–4%',
    accent: 'electric',
  },
  {
    type: 'aggressive',
    titleKey: 'bankAggressive',
    descKey: 'bankAggressiveDesc',
    pd: '15%',
    minScore: '480',
    rate: '7–15%',
    accent: 'growth',
  },
]

export default function BankSelector({ t, value, onSelect }) {
  return (
    <section className="relative">
      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mb-8 text-2xl font-bold sm:text-3xl"
      >
        {t.pickBank}
      </motion.h2>

      <div className="grid gap-5 md:grid-cols-2">
        {banks.map((b, i) => {
          const selected = value === b.type
          const accentRing = b.accent === 'growth' ? 'ring-growth-400' : 'ring-electric-400'
          const accentGlow = b.accent === 'growth' ? 'shadow-glowGreen' : 'shadow-glow'
          const accentText = b.accent === 'growth' ? 'text-growth-300' : 'text-electric-400'

          return (
            <motion.button
              key={b.type}
              type="button"
              onClick={() => onSelect(b.type)}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`card card-hover group relative overflow-hidden p-6 text-start transition ${
                selected ? `ring-2 ${accentRing} ${accentGlow}` : ''
              }`}
            >
              <div
                className={`absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl opacity-20 transition group-hover:opacity-40 ${
                  b.accent === 'growth' ? 'bg-growth-500' : 'bg-electric-500'
                }`}
              />
              <div className="relative space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold">{t[b.titleKey]}</h3>
                  {selected && (
                    <span className={`pill ${b.accent === 'growth' ? 'border-growth-400/40 text-growth-300' : 'border-electric-400/40 text-electric-400'}`}>
                      ✓
                    </span>
                  )}
                </div>
                <p className="text-sm text-white/55">{t[b.descKey]}</p>
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <Stat label={t.pdThreshold} value={b.pd} accent={accentText} />
                  <Stat label={t.minScore} value={b.minScore} accent={accentText} />
                  <Stat label={t.interestRate} value={b.rate} accent={accentText} />
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>
    </section>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <div className={`text-base font-semibold ${accent}`}>{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-white/40">{label}</div>
    </div>
  )
}
