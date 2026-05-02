import { motion } from 'framer-motion'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.18, delayChildren: 0.05 },
  },
}

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

export default function ResultsThatMatter({ t }) {
  const stats = [
    { value: t.stat1Value, label: t.stat1Label, accent: 'growth' },
    { value: t.stat2Value, label: t.stat2Label, accent: 'electric' },
    { value: t.stat3Value, label: t.stat3Label, accent: 'growth' },
  ]
  return (
    <section id="results" className="relative py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="mb-12 max-w-2xl"
        >
          <h2 className="text-3xl font-bold sm:text-4xl">
            <span className="bg-gradient-to-r from-white to-growth-300 bg-clip-text text-transparent">
              {t.statsTitle}
            </span>
          </h2>
          <p className="mt-3 text-white/55">{t.statsSub}</p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="grid gap-6 md:grid-cols-3"
        >
          {stats.map((s, i) => (
            <motion.div
              key={i}
              variants={item}
              className="card card-hover group relative overflow-hidden p-8"
            >
              <div
                className={`absolute -right-12 -top-12 h-40 w-40 rounded-full blur-3xl opacity-30 transition group-hover:opacity-50 ${
                  s.accent === 'growth' ? 'bg-growth-500' : 'bg-electric-500'
                }`}
              />
              <div className="relative">
                <div className={`text-4xl font-extrabold tracking-tight ${s.accent === 'growth' ? 'text-growth-300' : 'text-electric-400'}`}>
                  {s.value}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-white/70">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
