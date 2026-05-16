import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import {
  RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, Legend,
  LineChart, Line,
} from 'recharts'
import {
  fetchModelPerformance,
  fetchCalibration,
  fetchFeatureImportance,
  fetchMetricsSummary,
} from '../lib/api.js'
import { prettyFeature } from '../lib/featureLabels.js'
import AnimatedStockChart from './AnimatedStockChart.jsx'

const MODEL_TRAINING_GITHUB_URL = 'https://github.com/HamzaSa1t/Bank-analyzer/blob/main/src/train.py'

// Headline numbers used as fallback when /metrics-summary is unreachable.
// Sourced from the last successful CV run.
const SUMMARY_FALLBACK = {
  oof_auc: 0.787,
  n_total: 307511,
  brier_score: 0.0659,
}

function useMetricsSummary() {
  const [summary, setSummary] = useState(SUMMARY_FALLBACK)
  useEffect(() => {
    let cancelled = false
    fetchMetricsSummary()
      .then((res) => {
        if (cancelled || !res) return
        // Only override the fallback when the API returns a positive value.
        // A freshly-deployed backend that hasn't run training yet returns
        // 0 for these keys; without this guard the counter would freeze at 0.
        const positive = (n) => Number.isFinite(Number(n)) && Number(n) > 0
        setSummary({
          oof_auc: positive(res.oof_auc) ? Number(res.oof_auc) : SUMMARY_FALLBACK.oof_auc,
          n_total: positive(res.n_total) ? Number(res.n_total) : SUMMARY_FALLBACK.n_total,
          brier_score: positive(res.brier_score) ? Number(res.brier_score) : SUMMARY_FALLBACK.brier_score,
        })
      })
      .catch(() => { /* keep fallback */ })
    return () => { cancelled = true }
  }, [])
  return summary
}

// Tracks viewport width so charts can drop forced min-widths and shrink axis
// labels on phones. SSR-safe: starts at desktop width, syncs on first effect.
function useWindowWidth() {
  const [width, setWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1280,
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    onResize()
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

const IMPACT_COLORS = {
  good: '#34e89f',
  bad: '#ef4444',
  neutral: '#9ca3af',
}
const IMPACT_DOT_CLS = {
  good: 'bg-growth-400',
  bad: 'bg-red-400',
  neutral: 'bg-white/40',
}

// ---------- shared bits -------------------------------------------------

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

function SectionHeader({ eyebrow, title, sub }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      className="relative z-10 max-w-3xl break-words"
    >
      {eyebrow && <span className="label-muted">{eyebrow}</span>}
      <h3 className="mt-3 text-2xl font-bold leading-[1.25] sm:text-4xl">
        <span className="inline-block bg-gradient-to-r from-white to-electric-400 bg-clip-text py-1 text-transparent">
          {title}
        </span>
      </h3>
      {sub && <p className="mt-3 break-words text-white/60">{sub}</p>}
    </motion.div>
  )
}

// Collapses prose-heavy sections on mobile to keep the page short. On md+
// the section renders normally with its full SectionHeader.
function CollapsibleSection({ eyebrow, title, children }) {
  const width = useWindowWidth()
  const isMobile = width < 768
  const [open, setOpen] = useState(false)

  if (!isMobile) {
    return (
      <div className="space-y-6">
        <SectionHeader eyebrow={eyebrow} title={title} />
        {children}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left transition hover:border-white/20"
      >
        <div className="min-w-0">
          {eyebrow && <span className="label-muted">{eyebrow}</span>}
          <h3 className="mt-1 break-words text-lg font-bold leading-[1.2]">
            <span className="bg-gradient-to-r from-white to-electric-400 bg-clip-text text-transparent">
              {title}
            </span>
          </h3>
        </div>
        <svg
          viewBox="0 0 20 20"
          className={`h-5 w-5 shrink-0 text-white/60 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="pt-2">{children}</div>}
    </div>
  )
}

function Counter({ value, decimals = 0, format = (n) => n.toLocaleString() }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!inView) return
    const start = performance.now()
    const dur = 1400
    const ease = (t) => 1 - Math.pow(1 - t, 3)
    let raf
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur)
      setN(value * ease(t))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [inView, value])
  return <span ref={ref}>{format(decimals ? Number(n.toFixed(decimals)) : Math.round(n))}</span>
}

// ---------- Section 1: Hero ---------------------------------------------

function HeroBlock({ t }) {
  const summary = useMetricsSummary()
  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={t.mpEyebrow}
        title={t.mpHeroTitle}
        sub={t.mpHeroSub}
      />
      <motion.a
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        href={MODEL_TRAINING_GITHUB_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-electric-400/45 bg-electric-500/15 px-5 py-2.5 text-center text-sm font-semibold text-electric-100 shadow-glow transition hover:border-electric-300/70 hover:bg-electric-500/20 hover:text-white"
      >
        {t.mpModelDetailsLink}
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M7 4l6 6-6 6" />
        </svg>
      </motion.a>
      <motion.div
        variants={{ show: { transition: { staggerChildren: 0.12 } } }}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3"
      >
        <Stat
          label={t.mpStatAuc}
          value={<Counter value={summary.oof_auc} decimals={3} format={(n) => n.toFixed(3)} />}
          desc={t.mpStatAucDesc}
          extra={t.mpAucKaggleNote}
          accent="growth"
        />
        <Stat
          label={t.mpStatApplicants}
          value={<Counter value={summary.n_total} format={(n) => n.toLocaleString()} />}
          desc={t.mpStatApplicantsDesc}
          accent="electric"
        />
        <Stat
          label={t.mpStatEce}
          value={<Counter value={summary.brier_score} decimals={4} format={(n) => n.toFixed(4)} />}
          desc={t.mpStatEceDesc}
          accent="growth"
          className="col-span-2 sm:col-span-1"
        />
      </motion.div>
    </div>
  )
}

function Stat({ label, value, desc, extra, accent, className = '' }) {
  const text = accent === 'growth' ? 'text-growth-300' : 'text-electric-400'
  const blob = accent === 'growth' ? 'bg-growth-500' : 'bg-electric-500'
  return (
    <motion.div
      variants={fadeUp}
      className={`card card-hover group relative overflow-hidden p-5 sm:p-7 ${className}`}
    >
      <div className={`absolute -right-12 -top-12 h-40 w-40 rounded-full blur-3xl opacity-25 transition group-hover:opacity-40 ${blob}`} />
      <div className="relative">
        <div className={`break-words text-2xl font-extrabold tracking-tight sm:text-4xl ${text}`}>{value}</div>
        <p className="mt-3 break-words text-sm text-white/70">{label}</p>
        {desc && <p className="mt-2 break-words text-xs leading-relaxed text-white/55">{desc}</p>}
        {extra && (
          <p className="mt-3 break-words border-t border-white/10 pt-3 text-[11px] leading-relaxed text-white/45">
            {extra}
          </p>
        )}
      </div>
    </motion.div>
  )
}

// ---------- Section 1b: System overview (prediction vs decision) --------

function SystemOverviewBlock({ t }) {
  const bullets = [t.mpSystemBullet1, t.mpSystemBullet2, t.mpSystemBullet3, t.mpSystemBullet4]
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      className="relative z-10"
    >
      <div className="card relative overflow-hidden p-5 sm:p-6">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-electric-500 blur-3xl opacity-20" />
        <div className="relative space-y-4 break-words text-sm leading-relaxed text-white/75">
          <p className="text-white/90">{t.mpSystemBody1}</p>
          <p>{t.mpSystemBody2}</p>
          <div>
            <p>{t.mpSystemBody3}</p>
            <ul className="mt-2 space-y-1.5">
              {bullets.map((b, i) => (
                <li key={i} className="flex min-w-0 items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-growth-400" />
                  <span className="min-w-0 break-words">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ---------- Section 1c: What makes this system realistic? --------------

function RealisticBlock({ t }) {
  const bullets = [
    t.mpRealisticBullet1,
    t.mpRealisticBullet2,
    t.mpRealisticBullet3,
    t.mpRealisticBullet4,
  ]
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      className="card relative overflow-hidden p-5 sm:p-6"
    >
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-growth-500 blur-3xl opacity-15" />
      <div className="relative space-y-4 break-words text-sm leading-relaxed text-white/75">
        <p className="text-white/90">{t.mpRealisticIntro}</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {bullets.map((b, i) => (
            <li key={i} className="flex min-w-0 items-start gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-white/75">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-growth-400" />
              <span className="min-w-0 break-words">{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  )
}

// ---------- Section 2: How a credit decision is made --------------------

function FlowBlock({ t }) {
  const steps = [
    { icon: <IconForm />,    title: t.mpStep1Title, body: t.mpStep1Body, extras: null },
    { icon: <IconBureau />,  title: t.mpStep2Title, body: t.mpStep2Body, extras: null },
    { icon: <IconBrain />,   title: t.mpStep3Title, body: t.mpStep3Body, extras: null },
    { icon: <IconSignals />, title: t.mpStep4Title, body: t.mpStep4Body, extras: null },
    {
      icon: <IconGavel />,
      title: t.mpStep5Title,
      body: t.mpStep5Body,
      extras: {
        gates: [t.mpStep5Gate1, t.mpStep5Gate2, t.mpStep5Gate3, t.mpStep5Gate4, t.mpStep5Gate5],
        footer: t.mpStep5Footer,
      },
    },
  ]
  return (
    <div id="how-it-works" className="space-y-8 scroll-mt-20">
      <SectionHeader eyebrow={t.mpFlowEyebrow} title={t.mpFlowTitle} />
      <motion.ol
        variants={{ show: { transition: { staggerChildren: 0.1 } } }}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        {steps.map((s, i) => (
          <motion.li key={i} variants={fadeUp} className="card relative p-5">
            <div className="flex min-w-0 items-start gap-3 lg:flex-col lg:items-start">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-electric-500/30 to-growth-500/30 border border-white/10 text-white">
                {s.icon}
              </div>
              <div className="min-w-0 flex-1">
                <span className="label-muted">{`${t.mpStep} ${i + 1}`}</span>
                <h5 className="mt-1 break-words text-sm font-semibold text-white/95">{s.title}</h5>
                <p className="mt-1.5 break-words text-xs leading-relaxed text-white/65">{s.body}</p>
                {s.extras && (
                  <>
                    <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-white/70">
                      {s.extras.gates.map((g, gi) => (
                        <li key={gi} className="flex min-w-0 items-start gap-1.5">
                          <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-electric-400" />
                          <span className="min-w-0 break-words">{g}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-[11px] font-semibold text-growth-300">{s.extras.footer}</p>
                  </>
                )}
              </div>
            </div>
          </motion.li>
        ))}
      </motion.ol>
    </div>
  )
}

// ---------- Section 2b: Business logic + insight box --------------------

function DecisionLogicBlock({ t }) {
  const bullets = [
    t.mpDecisionsBullet1,
    t.mpDecisionsBullet2,
    t.mpDecisionsBullet3,
    t.mpDecisionsBullet4,
    t.mpDecisionsBullet5,
  ]
  const insightBullets = [t.mpInsightBullet1, t.mpInsightBullet2]
  return (
    <motion.div
      variants={{ show: { transition: { staggerChildren: 0.08 } } }}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      className="grid gap-5 lg:grid-cols-5"
    >
        <motion.div variants={fadeUp} className="card relative overflow-hidden p-5 sm:p-6 lg:col-span-3">
          <div className="absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-electric-500 blur-3xl opacity-20" />
          <div className="relative space-y-4 break-words text-sm leading-relaxed text-white/75">
            <p className="text-white/90">{t.mpDecisionsBody}</p>
            <ul className="space-y-1.5">
              {bullets.map((b, i) => (
                <li key={i} className="flex min-w-0 items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-electric-400" />
                  <span className="min-w-0 break-words">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
        <motion.div
          variants={fadeUp}
          className="card relative overflow-hidden border border-amber-400/30 p-5 sm:p-6 lg:col-span-2"
        >
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-amber-500 blur-3xl opacity-15" />
          <div className="relative space-y-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg border border-amber-400/40 bg-amber-500/10 text-amber-300">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                </svg>
              </span>
              <h5 className="min-w-0 break-words text-sm font-semibold text-amber-200">{t.mpInsightTitle}</h5>
            </div>
            <p className="break-words text-xs leading-relaxed text-white/75">{t.mpInsightBody}</p>
            <ul className="space-y-1.5 text-xs leading-relaxed text-white/70">
              {insightBullets.map((b, i) => (
                <li key={i} className="flex min-w-0 items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  <span className="min-w-0 break-words">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
    </motion.div>
  )
}

// ---------- Section 2c: Same applicant, different decisions -------------

function ExampleBlock({ t }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      className="card relative overflow-hidden p-5 sm:p-6"
    >
        <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-electric-500 blur-3xl opacity-15" />
        <div className="relative space-y-5">
          <p className="break-words text-sm leading-relaxed text-white/80">{t.mpExampleIntro}</p>

          <div className="grid items-stretch gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
              <span className="label-muted">{t.mpExampleApplicant}</span>
              <div className="mt-2 inline-grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/[0.04] text-white/70">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21a8 8 0 0 1 16 0" />
                </svg>
              </div>
            </div>
            <div className="hidden items-center justify-center text-white/30 md:flex">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </div>
            <div className="rounded-xl border border-electric-400/30 bg-electric-500/[0.06] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h5 className="min-w-0 break-words text-sm font-semibold text-electric-400">{t.mpExampleConservativeLabel}</h5>
                <span className="rounded-full border border-red-400/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300">
                  {t.mpExampleConservativeOutcome}
                </span>
              </div>
              <p className="mt-2 break-words text-xs leading-relaxed text-white/70">{t.mpExampleBullet1}</p>
            </div>
            <div className="hidden items-center justify-center text-white/30 md:flex">
              <span className="text-2xl font-light">·</span>
            </div>
            <div className="rounded-xl border border-growth-500/30 bg-growth-500/[0.06] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h5 className="min-w-0 break-words text-sm font-semibold text-growth-300">{t.mpExampleAggressiveLabel}</h5>
                <span className="rounded-full border border-growth-400/40 bg-growth-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-growth-300">
                  {t.mpExampleAggressiveOutcome}
                </span>
              </div>
              <p className="mt-2 break-words text-xs leading-relaxed text-white/70">{t.mpExampleBullet2}</p>
            </div>
          </div>
        </div>
    </motion.div>
  )
}

// ---------- Section 2d: Why model performance alone is not enough -------

function WhyAloneBlock({ t }) {
  const bullets = [
    t.mpAloneBullet1,
    t.mpAloneBullet2,
    t.mpAloneBullet3,
    t.mpAloneBullet4,
    t.mpAloneBullet5,
  ]
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      className="card relative overflow-hidden p-5 sm:p-6"
    >
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-electric-500 blur-3xl opacity-15" />
      <div className="relative space-y-4 break-words text-sm leading-relaxed text-white/75">
        <p className="text-white/90">{t.mpAloneIntro}</p>
        <p className="text-white/70">{t.mpAloneSub}</p>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {bullets.map((b, i) => (
            <li key={i} className="flex min-w-0 items-start gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-white/75">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-electric-400" />
              <span className="min-w-0 break-words">{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  )
}

// ---------- Section 3 (intro): Per-policy performance cards -------------

function PolicyMetricsBlock({ t }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchModelPerformance()
      .then((res) => { if (!cancelled) setData(res) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [])

  const cards = [
    {
      key: 'conservative',
      title: t.mpPolicyConservative,
      tone: 'electric',
      values: data?.conservative,
      strategyHeading: t.mpPolicyConservativeStrategy,
      strategyBullets: [
        t.mpPolicyConservativeBullet1,
        t.mpPolicyConservativeBullet2,
        t.mpPolicyConservativeBullet3,
      ],
      strategyInterp: t.mpPolicyConservativeInterp,
    },
    {
      key: 'aggressive',
      title: t.mpPolicyAggressive,
      tone: 'growth',
      values: data?.aggressive,
      strategyHeading: t.mpPolicyAggressiveStrategy,
      strategyBullets: [
        t.mpPolicyAggressiveBullet1,
        t.mpPolicyAggressiveBullet2,
        t.mpPolicyAggressiveBullet3,
      ],
      strategyInterp: t.mpPolicyAggressiveInterp,
    },
  ]

  return (
    <motion.div
      variants={{ show: { transition: { staggerChildren: 0.08 } } }}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      className="space-y-4"
    >
      <div className="flex flex-col gap-1">
        <h4 className="break-words text-sm font-semibold text-white/80">{t.mpPolicyTitle}</h4>
        <p className="break-words text-xs leading-relaxed text-white/55">{t.mpPolicyHint}</p>
      </div>

      <motion.div
        variants={fadeUp}
        className="card relative overflow-hidden border border-electric-400/20 p-5"
      >
        <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-electric-500 blur-3xl opacity-15" />
        <div className="relative space-y-2">
          <h5 className="break-words text-sm font-semibold text-electric-300">{t.mpMetricContextTitle}</h5>
          <p className="break-words text-xs leading-relaxed text-white/70">{t.mpMetricContextBody}</p>
        </div>
      </motion.div>

      {error && (
        <div className="card p-5 text-sm text-red-300">{t.mpPolicyError}</div>
      )}

      {!error && (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            {cards.map((c) => (
              <PolicyCard
                key={c.key}
                t={t}
                title={c.title}
                tone={c.tone}
                values={c.values}
                strategyHeading={c.strategyHeading}
                strategyBullets={c.strategyBullets}
                strategyInterp={c.strategyInterp}
              />
            ))}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center text-xs leading-relaxed text-white/65">
            {t.mpPolicySharedNote}
          </div>
        </>
      )}
    </motion.div>
  )
}

function PolicyCard({ t, title, tone, values, strategyHeading, strategyBullets, strategyInterp }) {
  // tone: 'electric' (blue) for conservative, 'growth' (green) for aggressive.
  const styles = tone === 'growth'
    ? { ring: 'border-growth-500/30',   blob: 'bg-growth-500',   text: 'text-growth-300' }
    : { ring: 'border-electric-400/30', blob: 'bg-electric-500', text: 'text-electric-400' }

  const metrics = [
    { key: 'precision',     label: t.mpPolicyMetricPrecision, desc: t.mpPolicyMetricPrecisionDesc, value: values?.precision     },
    { key: 'recall',        label: t.mpPolicyMetricRecall,    desc: t.mpPolicyMetricRecallDesc,    value: values?.recall        },
    { key: 'approval_rate', label: t.mpPolicyMetricApproval,  desc: t.mpPolicyMetricApprovalDesc,  value: values?.approval_rate },
    { key: 'f1',            label: t.mpPolicyMetricF1,        desc: t.mpPolicyMetricF1Desc,        value: values?.f1            },
  ]

  return (
    <motion.div
      variants={fadeUp}
      className={`card card-hover group relative overflow-hidden border ${styles.ring} p-5 sm:p-6`}
    >
      <div className={`absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl opacity-20 transition group-hover:opacity-35 ${styles.blob}`} />
      <div className="relative space-y-5">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <h5 className={`min-w-0 break-words text-base font-semibold ${styles.text}`}>{title}</h5>
        </div>

        {strategyHeading && strategyBullets?.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="break-words text-xs font-semibold text-white/85">{strategyHeading}</p>
            <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-white/65">
              {strategyBullets.map((b, i) => (
                <li key={i} className="flex min-w-0 items-start gap-2">
                  <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${styles.blob}`} />
                  <span className="min-w-0 break-words">{b}</span>
                </li>
              ))}
            </ul>
            {strategyInterp && (
              <p className="mt-3 break-words border-t border-white/10 pt-3 text-[11px] leading-relaxed text-white/70">
                {strategyInterp}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {metrics.map((m) => (
            <div key={m.key} className="min-w-0 space-y-1 rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className={`break-words text-2xl font-extrabold tracking-tight ${styles.text}`}>
                {m.value == null
                  ? <span className="text-white/30">...</span>
                  : `${(m.value * 100).toFixed(1)}%`}
              </div>
              <p className="break-words text-xs font-semibold text-white/85">{m.label}</p>
              <p className="break-words text-[11px] leading-relaxed text-white/55">{m.desc}</p>
            </div>
          ))}
        </div>

        {!values && (
          <p className="text-xs text-white/40">{t.mpPolicyLoading}</p>
        )}
      </div>
    </motion.div>
  )
}

// ---------- Section 3a: AUC gauge ---------------------------------------

function AucGauge({ t }) {
  const summary = useMetricsSummary()
  const auc = summary.oof_auc
  const data = [{ name: 'auc', value: auc * 100, fill: '#34e89f' }]
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      className="card space-y-4 p-5 sm:p-6"
    >
      <h4 className="break-words text-sm font-semibold text-white/80">{t.mpAucTitle}</h4>
      <div className="relative h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="78%" outerRadius="100%" data={data} startAngle={210} endAngle={-30}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar background={{ fill: 'rgba(255,255,255,0.06)' }} dataKey="value" cornerRadius={20} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="label-muted">AUC-ROC</span>
          <span className="mt-1 text-3xl font-extrabold tracking-tight text-growth-300 sm:text-4xl">{auc.toFixed(3)}</span>
          <span className="text-[10px] text-white/40">/ 1.000</span>
        </div>
      </div>
      <p className="break-words text-center text-sm font-semibold text-growth-300">{t.mpAucLabel}</p>
      <div className="grid grid-cols-1 gap-2 text-center text-[11px] sm:grid-cols-3">
        <Scale label={t.mpAucScaleRandom} value="0.50" tone="muted" />
        <Scale label={t.mpAucScaleGood} value="0.70" tone="electric" />
        <Scale label={t.mpAucScaleExcellent} value="0.80" tone="growth" />
      </div>
    </motion.div>
  )
}

function Scale({ label, value, tone }) {
  const cls =
    tone === 'growth' ? 'text-growth-300 border-growth-500/30'
    : tone === 'electric' ? 'text-electric-400 border-electric-400/30'
    : 'text-white/60 border-white/10'
  return (
    <div className={`min-w-0 rounded-lg border bg-white/[0.02] px-2 py-2 ${cls}`}>
      <div className="font-mono font-semibold">{value}</div>
      <div className="mt-1 break-words text-[9px] uppercase tracking-wider text-white/50">{label}</div>
    </div>
  )
}

// ---------- Section 3b: Approval / Recall by threshold ------------------

function ThresholdsBar({ t }) {
  const FALLBACK = [
    { name: t.mpThrConservative, approval: 52, recall: 84 },
    { name: t.mpThrAggressive, approval: 85, recall: 47 },
  ]
  const [data, setData] = useState(FALLBACK)
  useEffect(() => {
    let cancelled = false
    fetchModelPerformance()
      .then((res) => {
        if (cancelled || !res?.conservative || !res?.aggressive) return
        const pct = (n) => Math.round(Number(n ?? 0) * 100)
        setData([
          { name: t.mpThrConservative, approval: pct(res.conservative.approval_rate), recall: pct(res.conservative.recall) },
          { name: t.mpThrAggressive,   approval: pct(res.aggressive.approval_rate),   recall: pct(res.aggressive.recall) },
        ])
      })
      .catch(() => { /* keep fallback */ })
    return () => { cancelled = true }
  }, [t.mpThrConservative, t.mpThrAggressive])
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      className="card space-y-4 p-5 sm:p-6"
    >
      <h4 className="break-words text-sm font-semibold text-white/80">{t.mpThresholdsTitle}</h4>
      <div className="pb-1">
        <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="name" stroke="rgba(255,255,255,0.6)" fontSize={12} />
            <YAxis stroke="rgba(255,255,255,0.5)" fontSize={11} unit="%" domain={[0, 100]} />
            <Tooltip contentStyle={{ background: '#0b1230', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Legend wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }} />
            <Bar dataKey="approval" name={t.mpApproval} fill="#3b82ff" radius={[6, 6, 0, 0]} animationDuration={1200} />
            <Bar dataKey="recall" name={t.mpRecall} fill="#34e89f" radius={[6, 6, 0, 0]} animationDuration={1200} />
          </BarChart>
        </ResponsiveContainer>
        </div>
      </div>
      <div className="break-words rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs leading-relaxed text-white/70">
        <span className="font-semibold text-white/90">{t.mpRecallLabel}: </span>
        {t.mpRecallExplain}
      </div>
    </motion.div>
  )
}

// ---------- Section 3c: Calibration -------------------------------------

function CalibrationLine({ t }) {
  // Source: src/calibration_check.py OOF reliability table from
  // models/calibration_buckets.json (served by /calibration). Bin-mean predicted
  // PD vs empirical default rate, in percent.
  const FALLBACK = [
    { bucket: '0–10%', predicted: 4.3, actual: 4.3 },
    { bucket: '10–20%', predicted: 14.0, actual: 14.2 },
    { bucket: '20–30%', predicted: 24.1, actual: 24.4 },
    { bucket: '30–40%', predicted: 34.1, actual: 32.5 },
    { bucket: '40–50%', predicted: 44.3, actual: 42.5 },
    { bucket: '50–60%', predicted: 54.0, actual: 58.9 },
    { bucket: '60%+', predicted: 64.6, actual: 71.4 },
  ]
  const [buckets, setBuckets] = useState(FALLBACK)
  useEffect(() => {
    let cancelled = false
    fetchCalibration()
      .then((res) => { if (!cancelled && res?.buckets?.length) setBuckets(res.buckets) })
      .catch(() => { /* keep fallback */ })
    return () => { cancelled = true }
  }, [])
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      className="card space-y-4 p-5 sm:p-6"
    >
      <h4 className="break-words text-sm font-semibold text-white/80">{t.mpCalibTitle}</h4>
      <div className="pb-1">
        <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={buckets} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="bucket" stroke="rgba(255,255,255,0.6)" fontSize={11} />
            <YAxis stroke="rgba(255,255,255,0.5)" fontSize={11} unit="%" domain={[0, 80]} />
            <Tooltip contentStyle={{ background: '#0b1230', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} formatter={(v) => `${v}%`} />
            <Legend wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }} />
            <Line type="monotone" dataKey="predicted" name={t.mpCalibPerfect} stroke="#7afcb1" strokeWidth={2} strokeDasharray="6 4" dot={false} animationDuration={1400} />
            <Line type="monotone" dataKey="actual" name={t.mpCalibModel} stroke="#3b82ff" strokeWidth={3} dot={{ r: 4, fill: '#3b82ff' }} animationDuration={1400} />
          </LineChart>
        </ResponsiveContainer>
        </div>
      </div>
      <p className="break-words text-xs text-white/60">{t.mpCalibHint}</p>
    </motion.div>
  )
}

// ---------- Section 4: Top decision drivers -----------------------------

function DriversBar({ t }) {
  // Source: src/feature_importance.py top features by SHAP mean |value| on a
  // 5,000-row stratified sample, served from /feature-importance.
  const FALLBACK = [
    { feat: t.mpDriverBureauAvg,    shap: 0.573, impact: 'good', desc: t.mpDriverBureauAvgDesc },
    { feat: t.mpDriverInstalLate,   shap: 0.121, impact: 'bad',  desc: t.mpDriverInstalLateDesc },
    { feat: t.mpDriverBureau1,      shap: 0.119, impact: 'good', desc: t.mpDriverBureauDesc },
    { feat: t.mpDriverHistoryLen,   shap: 0.118, impact: 'good', desc: t.mpDriverHistoryLenDesc },
    { feat: t.mpDriverEmp,          shap: 0.114, impact: 'good', desc: t.mpDriverEmpDesc },
    { feat: t.mpDriverAge,          shap: 0.099, impact: 'good', desc: t.mpDriverAgeDesc },
    { feat: t.mpDriverLoanAmt,      shap: 0.085, impact: 'bad',  desc: t.mpDriverLoanAmtDesc },
    { feat: t.mpDriverCardUtilMax,  shap: 0.085, impact: 'bad',  desc: t.mpDriverCardUtilMaxDesc },
    { feat: t.mpDriverInstall,      shap: 0.077, impact: 'bad',  desc: t.mpDriverInstallDesc },
    { feat: t.mpDriverCardActive,   shap: 0.075, impact: 'good', desc: t.mpDriverCardActiveDesc },
  ]
  const [drivers, setDrivers] = useState(FALLBACK)
  useEffect(() => {
    let cancelled = false
    setDrivers(FALLBACK)
    fetchFeatureImportance()
      .then((res) => {
        if (cancelled || !res?.drivers?.length) return
        const mapped = res.drivers
          .filter((d) => d.feature !== 'CODE_GENDER_M' && !String(d.feature ?? '').startsWith('CODE_GENDER'))
          .map((d) => ({
            feat: prettyFeature(d.feature, t),
            shap: Number(d.shap_mean_abs ?? 0),
            impact: ['good', 'bad', 'neutral'].includes(d.impact) ? d.impact : 'neutral',
            desc: (d.description_key && t[d.description_key]) || prettyFeature(d.feature, t),
          }))
        setDrivers(mapped)
      })
      .catch(() => { /* keep fallback */ })
    return () => { cancelled = true }
  }, [t])
  const data = [...drivers].reverse() // recharts horizontal bars: top of chart = last item
  const examples = [t.mpDriversExample1, t.mpDriversExample2, t.mpDriversExample3]
  const isArabic = t.mpDriversTitle === 'ما الذي ينظر إليه النموذج أكثر'
  const width = useWindowWidth()
  const isMobile = width < 768
  // On mobile, label width and font shrink so bars get the room they need.
  const yAxisWidth = isMobile ? (isArabic ? 110 : 96) : isArabic ? 280 : 170
  const tickFontSize = isMobile ? 10 : isArabic ? 12 : 11
  const chartMargin = isMobile
    ? { top: 4, right: 12, left: 4, bottom: 4 }
    : { top: 8, right: 24, left: 8, bottom: 8 }
  // Height grows with bar count; clamped so it never collapses or runs away.
  // Bumped per-bar height on mobile so bars never overlap on tight screens.
  const chartHeight = Math.min(720, Math.max(420, drivers.length * 44 + 80))
  const truncateLabel = (s) => {
    if (typeof s !== 'string') return s
    const limit = isMobile ? 18 : 60
    return s.length > limit ? `${s.slice(0, limit - 1)}…` : s
  }
  return (
    <div className="space-y-8">
      <SectionHeader eyebrow={t.mpDriversEyebrow} title={t.mpDriversTitle} />
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        className="card relative overflow-hidden p-5"
      >
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-electric-500 blur-3xl opacity-15" />
        <div className="relative space-y-3 break-words text-sm leading-relaxed text-white/75">
          <p className="text-white/90">{t.mpDriversIntro}</p>
          <ul className="grid gap-1.5 sm:grid-cols-3">
            {examples.map((ex, i) => (
              <li key={i} className="flex min-w-0 items-start gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-white/75">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-electric-400" />
                <span className="min-w-0 break-words">{ex}</span>
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        className="grid gap-6 lg:grid-cols-5"
      >
        <div className="card p-5 sm:p-6 lg:col-span-3">
          <div className="pb-1" dir="ltr" style={{ direction: 'ltr' }}>
          <div className="w-full" style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={chartMargin}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="rgba(255,255,255,0.5)"
                  fontSize={isMobile ? 10 : 11}
                  // The raw SHAP magnitude isn't meaningful to lay readers and
                  // the axis line eats horizontal space on phones — hide it.
                  tick={isMobile ? false : undefined}
                  axisLine={!isMobile}
                  tickLine={!isMobile}
                />
                <YAxis
                  type="category"
                  dataKey="feat"
                  stroke="rgba(255,255,255,0.7)"
                  fontSize={tickFontSize}
                  width={yAxisWidth}
                  interval={0}
                  orientation="left"
                  tick={(props) => {
                    const { x, y, payload } = props
                    return (
                      <text
                        x={x}
                        y={y}
                        textAnchor="end"
                        dominantBaseline="central"
                        fill="rgba(255,255,255,0.7)"
                        fontSize={tickFontSize}
                        dx={-6}
                        direction="ltr"
                      >
                        {truncateLabel(payload.value)}
                      </text>
                    )
                  }}
                />
                <Tooltip contentStyle={{ background: '#0b1230', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} formatter={(v) => v.toFixed(3)} />
                <Bar dataKey="shap" radius={[0, 6, 6, 0]} animationDuration={1400}>
                  {data.map((d, i) => (
                    <Cell key={i} fill={IMPACT_COLORS[d.impact] ?? IMPACT_COLORS.neutral} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-4 text-[11px]">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-growth-400" />{t.mpImpactGood}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400" />{t.mpImpactBad}</span>
          </div>
        </div>
        <ul className="space-y-2 lg:col-span-2">
          {drivers.map((d, i) => (
            <motion.li
              key={i}
              variants={fadeUp}
              className="card flex min-w-0 items-start gap-3 p-3"
            >
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${IMPACT_DOT_CLS[d.impact] ?? IMPACT_DOT_CLS.neutral}`} />
              <div className="min-w-0">
                <div className="break-words text-sm font-semibold text-white/90">{d.feat}</div>
                <p className="break-words text-xs leading-relaxed text-white/55">{d.desc}</p>
              </div>
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </div>
  )
}

// ---------- Section: Risk Strategy Comparison --------------------------

const RS_FALLBACK = {
  conservative: { precision: 0.141, recall: 0.844, approval_rate: 0.518, f1: 0.242 },
  aggressive:   { precision: 0.262, recall: 0.474, approval_rate: 0.854, f1: 0.337 },
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3 4 6v6c0 4.5 3.2 8.4 8 9 4.8-.6 8-4.5 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function GrowthArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 17 9 11l4 4 8-8" />
      <path d="M14 4h7v7" />
    </svg>
  )
}

function RiskStrategyBlock({ t }) {
  const [data, setData] = useState(RS_FALLBACK)
  useEffect(() => {
    let cancelled = false
    fetchModelPerformance()
      .then((res) => {
        if (cancelled || !res?.conservative || !res?.aggressive) return
        setData({
          conservative: { ...RS_FALLBACK.conservative, ...res.conservative },
          aggressive:   { ...RS_FALLBACK.aggressive,   ...res.aggressive   },
        })
      })
      .catch(() => { /* keep fallback */ })
    return () => { cancelled = true }
  }, [])

  const cards = [
    {
      key: 'conservative',
      icon: <ShieldIcon />,
      tone: 'safe',
      title: t.rsConsTitle,
      bullets: [t.rsConsBullet1, t.rsConsBullet2, t.rsConsBullet3],
      badge: t.rsConsBadge,
      values: data.conservative,
      metricNotes: {
        recall: t.rsConsRecall,
        precision: t.rsConsPrecision,
        approval_rate: t.rsConsApproval,
        f1: t.rsConsF1,
      },
    },
    {
      key: 'aggressive',
      icon: <GrowthArrowIcon />,
      tone: 'risk',
      title: t.rsAggTitle,
      bullets: [t.rsAggBullet1, t.rsAggBullet2, t.rsAggBullet3],
      badge: t.rsAggBadge,
      values: data.aggressive,
      metricNotes: {
        recall: t.rsAggRecall,
        precision: t.rsAggPrecision,
        approval_rate: t.rsAggApproval,
        f1: t.rsAggF1,
      },
    },
  ]

  return (
    <div className="space-y-8">
      <SectionHeader eyebrow={t.rsEyebrow} title={t.rsTitle} />
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        className="card relative overflow-hidden p-5 sm:p-6"
      >
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-electric-500 blur-3xl opacity-15" />
        <p className="relative break-words text-sm leading-relaxed text-white/80">
          {t.rsIntroA}{' '}
          {t.rsIntroB}{' '}
          <span className="font-semibold text-white">{t.rsIntroBHighlight}</span>{' '}
          {t.rsIntroC}
        </p>
      </motion.div>

      <motion.div
        variants={{ show: { transition: { staggerChildren: 0.1 } } }}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        className="grid gap-5 lg:grid-cols-2"
      >
        {cards.map((c) => (
          <StrategyCard key={c.key} t={t} {...c} />
        ))}
      </motion.div>

      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        className="card relative overflow-hidden border border-amber-400/30 p-5 sm:p-6"
      >
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-500 blur-3xl opacity-15" />
        <div className="relative space-y-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg border border-amber-400/40 bg-amber-500/10 text-amber-300">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5M12 16h.01" />
              </svg>
            </span>
            <h5 className="min-w-0 break-words text-sm font-semibold text-amber-200">{t.rsInsightTitle}</h5>
          </div>
          <ul className="space-y-1.5 break-words text-xs leading-relaxed text-white/75">
            <li className="flex min-w-0 items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
              <span className="min-w-0 break-words">{t.rsInsightBullet1}</span>
            </li>
            <li className="flex min-w-0 items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
              <span className="min-w-0 break-words">{t.rsInsightBullet2}</span>
            </li>
            <li className="flex min-w-0 items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
              <span className="min-w-0 break-words">{t.rsInsightBullet3}</span>
            </li>
          </ul>
        </div>
      </motion.div>
    </div>
  )
}

function StrategyCard({ t, icon, tone, title, bullets, badge, values, metricNotes }) {
  // tone 'safe' (blue/green) for conservative; 'risk' (orange/red) for aggressive.
  const styles = tone === 'risk'
    ? {
        ring: 'border-orange-400/35',
        blob: 'bg-orange-500',
        iconWrap: 'border-orange-400/45 bg-orange-500/15 text-orange-200',
        title: 'text-orange-200',
        badge: 'border-red-400/40 bg-red-500/12 text-red-200',
        metricValue: 'text-orange-200',
        metricBorder: 'border-orange-400/25',
        dot: 'bg-orange-300',
      }
    : {
        ring: 'border-electric-400/35',
        blob: 'bg-electric-500',
        iconWrap: 'border-growth-400/40 bg-growth-500/15 text-growth-200',
        title: 'text-electric-200',
        badge: 'border-growth-400/40 bg-growth-500/12 text-growth-200',
        metricValue: 'text-electric-200',
        metricBorder: 'border-electric-400/25',
        dot: 'bg-growth-300',
      }

  const pct = (n) => (n == null || Number.isNaN(Number(n))) ? '—' : `${(Number(n) * 100).toFixed(1)}%`

  const metrics = [
    { key: 'recall',        label: t.rsLabelRecall,    value: values?.recall,        note: metricNotes.recall        },
    { key: 'precision',     label: t.rsLabelPrecision, value: values?.precision,     note: metricNotes.precision     },
    { key: 'approval_rate', label: t.rsLabelApproval,  value: values?.approval_rate, note: metricNotes.approval_rate },
    { key: 'f1',            label: t.rsLabelF1,        value: values?.f1,            note: metricNotes.f1            },
  ]

  return (
    <motion.div
      variants={fadeUp}
      className={`card card-hover group relative overflow-hidden border ${styles.ring} p-5 sm:p-6`}
    >
      <div className={`absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl opacity-20 transition group-hover:opacity-35 ${styles.blob}`} />
      <div className="relative space-y-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${styles.iconWrap}`}>
              {icon}
            </span>
            <h5 className={`min-w-0 break-words text-base font-semibold ${styles.title}`}>{title}</h5>
          </div>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles.badge}`}>
            {badge}
          </span>
        </div>

        <ul className="space-y-1.5 text-xs leading-relaxed text-white/75">
          {bullets.map((b, i) => (
            <li key={i} className="flex min-w-0 items-start gap-2">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${styles.dot}`} />
              <span className="min-w-0 break-words">{b}</span>
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {metrics.map((m) => (
            <div key={m.key} className={`min-w-0 space-y-1 rounded-xl border ${styles.metricBorder} bg-white/[0.02] p-3`}>
              <div className={`break-words text-2xl font-extrabold tracking-tight ${styles.metricValue}`}>{pct(m.value)}</div>
              <p className="break-words text-xs font-semibold text-white/85">{m.label}</p>
              <p className="break-words text-[11px] leading-relaxed text-white/60">{m.note}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ---------- Section 6: Closing statement -------------------------------

function ClosingBlock({ t }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-electric-500/[0.08] via-transparent to-growth-500/[0.08] p-6 text-center sm:p-10"
    >
      <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-electric-500 blur-3xl opacity-15" />
      <div className="absolute -right-16 -bottom-16 h-48 w-48 rounded-full bg-growth-500 blur-3xl opacity-15" />
      <div className="relative space-y-2">
        <p className="break-words text-xl font-bold tracking-tight text-white sm:text-3xl">{t.mpClosingLine1}</p>
        <p className="break-words text-xl font-bold tracking-tight text-white sm:text-3xl">{t.mpClosingLine2}</p>
      </div>
    </motion.div>
  )
}

// ---------- Icons (inline SVG, currentColor) ----------------------------

function IconForm() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  )
}
function IconBureau() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-7h6v7" />
    </svg>
  )
}
function IconSignals() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h3l3-8 4 16 3-8h5" />
    </svg>
  )
}
function IconBrain() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0-2 5 3 3 0 0 0 2 5v1a3 3 0 0 0 6 0V4Z" />
      <path d="M15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 2 5 3 3 0 0 1-2 5v1a3 3 0 0 1-6 0V4Z" />
    </svg>
  )
}
function IconGavel() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4l6 6-3 3-6-6 3-3ZM10 8l-6 6 3 3 6-6M3 21h12" />
    </svg>
  )
}
// ---------- Page --------------------------------------------------------

export default function ModelPerformance({ t }) {
  return (
    <section
      id="model-performance"
      className="relative mx-auto max-w-7xl space-y-10 px-4 py-12 scroll-mt-20 sm:space-y-20 sm:px-6 sm:py-24"
    >
      <div className="pointer-events-none absolute left-1/2 top-0 z-0 h-[620px] w-screen -translate-x-1/2 overflow-hidden opacity-55">
        <AnimatedStockChart />
      </div>
      <div className="pointer-events-none absolute left-1/2 top-0 z-0 h-[620px] w-screen -translate-x-1/2 bg-gradient-to-b from-transparent via-navy-950/20 to-navy-950" />
      <HeroBlock t={t} />
      <CollapsibleSection eyebrow={t.mpSystemEyebrow} title={t.mpSystemTitle}>
        <SystemOverviewBlock t={t} />
      </CollapsibleSection>
      <CollapsibleSection eyebrow={t.mpRealisticEyebrow} title={t.mpRealisticTitle}>
        <RealisticBlock t={t} />
      </CollapsibleSection>
      <FlowBlock t={t} />
      <CollapsibleSection eyebrow={t.mpDecisionsEyebrow} title={t.mpDecisionsTitle}>
        <DecisionLogicBlock t={t} />
      </CollapsibleSection>

      <RiskStrategyBlock t={t} />

      <DriversBar t={t} />
    </section>
  )
}
