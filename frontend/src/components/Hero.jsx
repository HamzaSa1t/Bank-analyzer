import { motion } from 'framer-motion'
import AnimatedStockChart from './AnimatedStockChart.jsx'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
}

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
}

export default function Hero({ t, onPrimary, onSecondary }) {
  return (
    <section id="home" className="relative isolate overflow-hidden">
      <AnimatedStockChart t={t} />

      <div className="relative mx-auto flex min-h-[78vh] max-w-7xl flex-col items-center justify-center px-4 py-16 text-center sm:min-h-[88vh] sm:px-6 sm:py-24">
        <motion.div variants={container} initial="hidden" animate="show" className="w-full min-w-0 space-y-6 sm:space-y-8">
          <motion.div variants={item}>
            <span className="pill border-growth-500/30 bg-growth-500/10 text-growth-300">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-growth-400 animate-pulse" />
              {t.heroEyebrow}
            </span>
          </motion.div>

          <motion.h1
            variants={item}
            className="mx-auto max-w-4xl break-words text-balance text-3xl font-extrabold leading-[1.12] tracking-tight text-white sm:text-5xl md:text-6xl"
          >
            <span className="bg-gradient-to-r from-white via-white to-growth-300 bg-clip-text text-transparent">
              {t.heroHeading}
            </span>
          </motion.h1>

          <motion.p
            variants={item}
            className="mx-auto max-w-2xl break-words text-base text-white/60 sm:text-lg"
          >
            {t.heroSub}
          </motion.p>

          <motion.p
            variants={item}
            className="mx-auto max-w-2xl break-words text-sm text-white/45"
          >
            {t.heroDesc}
          </motion.p>

          <motion.div variants={item} className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <button type="button" onClick={onPrimary} className="btn-primary w-full sm:w-auto">
              {t.ctaPrimary}
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
                <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button type="button" onClick={onSecondary} className="btn-ghost w-full sm:w-auto">
              {t.ctaSecondary}
            </button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
