import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAssessment } from '../hooks/useAssessment.js'

import Hero from '../components/Hero.jsx'
import BankSelector from '../components/BankSelector.jsx'
import UserInputForm from '../components/UserInputForm.jsx'
import SimahPanel from '../components/SimahPanel.jsx'
import GosiPanel from '../components/GosiPanel.jsx'
import ResultsDashboard from '../components/ResultsDashboard.jsx'

export default function Home({ t, lang }) {
  const a = useAssessment({ lang })
  const appRef = useRef(null)
  const applyRef = useRef(null)
  const simahRef = useRef(null)
  const reportRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (a.result && reportRef.current) {
      reportRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [a.result])

  const scrollToApply = () => {
    applyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const scrollToSimah = () => {
    simahRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const selectBank = (bankType) => {
    a.setBankType(bankType)
    requestAnimationFrame(() => setTimeout(scrollToSimah, 80))
  }

  const goToHowItWorks = () => {
    navigate('/model-performance')
    requestAnimationFrame(() => {
      setTimeout(() => {
        document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
      }, 80)
    })
  }

  return (
    <>
      <Hero
        t={t}
        onPrimary={scrollToApply}
        onSecondary={goToHowItWorks}
      />

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

        <div id="apply" ref={applyRef} className="scroll-mt-20">
          <BankSelector
            t={t}
            value={a.bankType}
            onSelect={selectBank}
          />
        </div>

        <div ref={simahRef} className="scroll-mt-24">
          <SimahPanel
            t={t}
            simah={a.simah}
            onSimulate={a.runSimulateBureau}
            loading={a.bureauLoading}
          />
        </div>

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
