import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useAssessment } from '../hooks/useAssessment.js'

import Hero from '../components/Hero.jsx'
import ResultsThatMatter from '../components/ResultsThatMatter.jsx'
import BankSelector from '../components/BankSelector.jsx'
import UserInputForm from '../components/UserInputForm.jsx'
import SimahPanel from '../components/SimahPanel.jsx'
import GosiPanel from '../components/GosiPanel.jsx'
import ResultsDashboard from '../components/ResultsDashboard.jsx'

export default function Home({ t, lang }) {
  const a = useAssessment({ lang })
  const appRef = useRef(null)
  const reportRef = useRef(null)

  useEffect(() => {
    if (a.result && reportRef.current) {
      reportRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [a.result])

  const scrollToApp = () => {
    appRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <Hero
        t={t}
        onPrimary={scrollToApp}
        onSecondary={() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' })}
      />

      <ResultsThatMatter t={t} />

      <main
        id="how"
        ref={appRef}
        className="relative mx-auto max-w-7xl space-y-10 px-6 py-20 scroll-mt-20"
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl"
        >
          <span className="label-muted">{t.heroEyebrow}</span>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">
            <span className="bg-gradient-to-r from-white to-electric-400 bg-clip-text text-transparent">
              {t.brand}
            </span>
          </h2>
        </motion.div>

        <BankSelector
          t={t}
          value={a.bankType}
          onSelect={a.setBankType}
        />

        <SimahPanel
          t={t}
          simah={a.simah}
          onSimulate={a.runSimulateBureau}
          loading={a.bureauLoading}
        />

        <GosiPanel
          t={t}
          gosi={a.gosi}
          onSectorChange={a.setGosiSector}
        />

        {a.error === 'sama_min_employment' && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="-mt-6 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            role="alert"
          >
            {t.samaMinEmployment}
          </motion.div>
        )}

        <UserInputForm
          t={t}
          onSubmit={a.runAssess}
          disabled={!a.bankType || !a.simah}
          loading={a.loading}
          employmentType={a.employmentType}
          onEmploymentTypeChange={a.setEmploymentType}
        />

        {a.error && a.error !== 'sama_min_employment' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          >
            {a.error === 'select_bank'
              ? t.selectBankFirst
              : a.error === 'simulate_first'
              ? t.simulateFirst
              : a.error}
          </motion.div>
        )}

        <div ref={reportRef}>
          {a.result && <ResultsDashboard result={a.result} t={t} />}
        </div>
      </main>
    </>
  )
}
