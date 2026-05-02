import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import {
  RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, Legend,
  LineChart, Line,
} from 'recharts'
import { fetchModelPerformance } from '../lib/api.js'

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
      className="max-w-3xl"
    >
      {eyebrow && <span className="label-muted">{eyebrow}</span>}
      <h3 className="mt-2 text-3xl font-bold sm:text-4xl">
        <span className="bg-gradient-to-r from-white to-electric-400 bg-clip-text text-transparent">
          {title}
        </span>
      </h3>
      {sub && <p className="mt-3 text-white/60">{sub}</p>}
    </motion.div>
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
  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={t.mpEyebrow}
        title={t.mpHeroTitle}
        sub={t.mpHeroSub}
      />
      <motion.div
        variants={{ show: { transition: { staggerChildren: 0.12 } } }}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        className="grid gap-5 md:grid-cols-3"
      >
        <Stat
          label={t.mpStatAuc}
          value={<Counter value={0.757} decimals={3} format={(n) => n.toFixed(3)} />}
          desc={t.mpStatAucDesc}
          accent="growth"
        />
        <Stat
          label={t.mpStatApplicants}
          value={<Counter value={61503} format={(n) => n.toLocaleString()} />}
          desc={t.mpStatApplicantsDesc}
          accent="electric"
        />
        <Stat
          label={t.mpStatEce}
          value={<Counter value={0.0012} decimals={4} format={(n) => n.toFixed(4)} />}
          desc={t.mpStatEceDesc}
          accent="growth"
        />
      </motion.div>
    </div>
  )
}

function Stat({ label, value, desc, accent }) {
  const text = accent === 'growth' ? 'text-growth-300' : 'text-electric-400'
  const blob = accent === 'growth' ? 'bg-growth-500' : 'bg-electric-500'
  return (
    <motion.div variants={fadeUp} className="card card-hover group relative overflow-hidden p-7">
      <div className={`absolute -right-12 -top-12 h-40 w-40 rounded-full blur-3xl opacity-25 transition group-hover:opacity-40 ${blob}`} />
      <div className="relative">
        <div className={`text-4xl font-extrabold tracking-tight ${text}`}>{value}</div>
        <p className="mt-3 text-sm text-white/70">{label}</p>
        {desc && <p className="mt-2 text-xs leading-relaxed text-white/55">{desc}</p>}
      </div>
    </motion.div>
  )
}

// ---------- Section 2: How a credit decision is made --------------------

function FlowBlock({ t }) {
  const steps = [
    { icon: <IconForm />, label: t.mpStep1 },
    { icon: <IconBureau />, label: t.mpStep2 },
    { icon: <IconSignals />, label: t.mpStep3 },
    { icon: <IconBrain />, label: t.mpStep4 },
    { icon: <IconGavel />, label: t.mpStep5 },
  ]
  return (
    <div className="space-y-8">
      <SectionHeader eyebrow={t.mpFlowEyebrow} title={t.mpFlowTitle} />
      <motion.ol
        variants={{ show: { transition: { staggerChildren: 0.1 } } }}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        className="grid gap-4 lg:grid-cols-5"
      >
        {steps.map((s, i) => (
          <motion.li key={i} variants={fadeUp} className="card p-5 relative">
            <div className="flex items-center gap-3 lg:flex-col lg:items-start">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-electric-500/30 to-growth-500/30 border border-white/10 text-white">
                {s.icon}
              </div>
              <div className="flex-1">
                <span className="label-muted">{`${t.mpStep} ${i + 1}`}</span>
                <p className="mt-1 text-sm leading-relaxed text-white/80">{s.label}</p>
              </div>
            </div>
          </motion.li>
        ))}
      </motion.ol>
    </div>
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
    },
    {
      key: 'aggressive',
      title: t.mpPolicyAggressive,
      tone: 'growth',
      values: data?.aggressive,
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
        <h4 className="text-sm font-semibold text-white/80">{t.mpPolicyTitle}</h4>
        <p className="text-xs leading-relaxed text-white/55">{t.mpPolicyHint}</p>
      </div>

      {error && (
        <div className="card p-5 text-sm text-red-300">{t.mpPolicyError}</div>
      )}

      {!error && (
        <div className="grid gap-5 md:grid-cols-2">
          {cards.map((c) => (
            <PolicyCard key={c.key} t={t} title={c.title} tone={c.tone} values={c.values} />
          ))}
        </div>
      )}
    </motion.div>
  )
}

function PolicyCard({ t, title, tone, values }) {
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
      className={`card card-hover group relative overflow-hidden border ${styles.ring} p-6`}
    >
      <div className={`absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl opacity-20 transition group-hover:opacity-35 ${styles.blob}`} />
      <div className="relative space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h5 className={`text-base font-semibold ${styles.text}`}>{title}</h5>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {metrics.map((m) => (
            <div key={m.key} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-1">
              <div className={`text-2xl font-extrabold tracking-tight ${styles.text}`}>
                {m.value == null
                  ? <span className="text-white/30">—</span>
                  : `${(m.value * 100).toFixed(1)}%`}
              </div>
              <p className="text-xs font-semibold text-white/85">{m.label}</p>
              <p className="text-[11px] leading-relaxed text-white/55">{m.desc}</p>
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
  const auc = 0.757
  const data = [{ name: 'auc', value: auc * 100, fill: '#34e89f' }]
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      className="card p-6 space-y-4"
    >
      <h4 className="text-sm font-semibold text-white/80">{t.mpAucTitle}</h4>
      <div className="relative h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="78%" outerRadius="100%" data={data} startAngle={210} endAngle={-30}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar background={{ fill: 'rgba(255,255,255,0.06)' }} dataKey="value" cornerRadius={20} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="label-muted">AUC-ROC</span>
          <span className="mt-1 text-4xl font-extrabold tracking-tight text-growth-300">{auc.toFixed(3)}</span>
          <span className="text-[10px] text-white/40">/ 1.000</span>
        </div>
      </div>
      <p className="text-center text-sm font-semibold text-growth-300">{t.mpAucLabel}</p>
      <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
        <Scale label={t.mpAucScaleRandom} value="0.50" tone="muted" />
        <Scale label={t.mpAucScaleGood} value="0.70" tone="electric" />
        <Scale label={t.mpAucScaleExcellent} value="0.90" tone="growth" />
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
    <div className={`rounded-lg border bg-white/[0.02] py-2 ${cls}`}>
      <div className="font-mono font-semibold">{value}</div>
      <div className="mt-1 text-[9px] uppercase tracking-wider text-white/50">{label}</div>
    </div>
  )
}

// ---------- Section 3b: Approval / Recall by threshold ------------------

function ThresholdsBar({ t }) {
  const data = [
    { name: t.mpThrConservative, approval: 48, recall: 83 },
    { name: t.mpThrAggressive, approval: 86, recall: 43 },
  ]
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      className="card p-6 space-y-4"
    >
      <h4 className="text-sm font-semibold text-white/80">{t.mpThresholdsTitle}</h4>
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
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs leading-relaxed text-white/70">
        <span className="font-semibold text-white/90">{t.mpRecallLabel}: </span>
        {t.mpRecallExplain}
      </div>
    </motion.div>
  )
}

// ---------- Section 3c: Calibration -------------------------------------

function CalibrationLine({ t }) {
  // Source: src/calibration_check.py output on the held-out test split (n=61,503).
  // Values are bin-mean predicted PD vs empirical default rate, in percent.
  const buckets = [
    { bucket: '0–10%', predicted: 4.3, actual: 4.3 },
    { bucket: '10–20%', predicted: 14.0, actual: 14.2 },
    { bucket: '20–30%', predicted: 24.1, actual: 24.4 },
    { bucket: '30–40%', predicted: 34.1, actual: 32.5 },
    { bucket: '40–50%', predicted: 44.3, actual: 42.5 },
    { bucket: '50–60%', predicted: 54.0, actual: 58.9 },
    { bucket: '60%+', predicted: 64.6, actual: 71.4 },
  ]
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      className="card p-6 space-y-4"
    >
      <h4 className="text-sm font-semibold text-white/80">{t.mpCalibTitle}</h4>
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
      <p className="text-xs text-white/60">{t.mpCalibHint}</p>
    </motion.div>
  )
}

// ---------- Section 4: Top decision drivers -----------------------------

function DriversBar({ t }) {
  // Source: src/feature_importance.py — top 10 by SHAP mean |value| on the held-out
  // test split (n=5,000 sample). Numbers are mean absolute SHAP contributions.
  const drivers = [
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
  const data = [...drivers].reverse() // recharts horizontal bars: top of chart = last item
  return (
    <div className="space-y-8">
      <SectionHeader eyebrow={t.mpDriversEyebrow} title={t.mpDriversTitle} />
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        className="grid gap-6 lg:grid-cols-5"
      >
        <div className="card p-6 lg:col-span-3">
          <div className="h-[420px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 5, right: 18, left: 18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal={false} />
                <XAxis type="number" stroke="rgba(255,255,255,0.5)" fontSize={11} />
                <YAxis type="category" dataKey="feat" stroke="rgba(255,255,255,0.7)" fontSize={11} width={170} />
                <Tooltip contentStyle={{ background: '#0b1230', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} formatter={(v) => v.toFixed(3)} />
                <Bar dataKey="shap" radius={[0, 6, 6, 0]} animationDuration={1400}>
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.impact === 'good' ? '#34e89f' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center justify-end gap-4 text-[11px]">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-growth-400" />{t.mpImpactGood}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400" />{t.mpImpactBad}</span>
          </div>
        </div>
        <ul className="lg:col-span-2 space-y-2">
          {drivers.map((d, i) => (
            <motion.li
              key={i}
              variants={fadeUp}
              className="card p-3 flex items-start gap-3"
            >
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${d.impact === 'good' ? 'bg-growth-400' : 'bg-red-400'}`} />
              <div>
                <div className="text-sm font-semibold text-white/90">{d.feat}</div>
                <p className="text-xs text-white/55 leading-relaxed">{d.desc}</p>
              </div>
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </div>
  )
}

// ---------- Section 5: Fairness & limitations ---------------------------

function FairnessBlock({ t }) {
  const cards = [
    { tone: 'warn', icon: <IconWarn />, title: t.mpFairAgeTitle, body: t.mpFairAgeBody },
    { tone: 'info', icon: <IconInfo />, title: t.mpFairBureauTitle, body: t.mpFairBureauBody },
    { tone: 'flask', icon: <IconFlask />, title: t.mpFairDisclaimerTitle, body: t.mpFairDisclaimerBody },
  ]
  return (
    <div className="space-y-8">
      <SectionHeader eyebrow={t.mpFairnessEyebrow} title={t.mpFairnessTitle} />
      <motion.div
        variants={{ show: { transition: { staggerChildren: 0.1 } } }}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        className="grid gap-5 md:grid-cols-3"
      >
        {cards.map((c, i) => (
          <motion.div key={i} variants={fadeUp} className="card card-hover p-6 space-y-3">
            <div className={`grid h-10 w-10 place-items-center rounded-xl border ${
              c.tone === 'warn' ? 'border-amber-400/30 bg-amber-500/10 text-amber-300'
              : c.tone === 'info' ? 'border-electric-400/30 bg-electric-500/10 text-electric-400'
              : 'border-growth-500/30 bg-growth-500/10 text-growth-300'
            }`}>
              {c.icon}
            </div>
            <h4 className="text-base font-semibold text-white/90">{c.title}</h4>
            <p className="text-sm leading-relaxed text-white/60">{c.body}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
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
function IconWarn() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l10 18H2L12 3zM12 10v5M12 18.5h.01" />
    </svg>
  )
}
function IconInfo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v.01M11 12h1v5h1" />
    </svg>
  )
}
function IconFlask() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6M10 3v6L4 19a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-10V3M7 14h10" />
    </svg>
  )
}

// ---------- Page --------------------------------------------------------

export default function ModelPerformance({ t }) {
  return (
    <section
      id="model-performance"
      className="relative mx-auto max-w-7xl space-y-20 px-6 py-24 scroll-mt-20"
    >
      <HeroBlock t={t} />
      <FlowBlock t={t} />

      <div className="space-y-8">
        <SectionHeader eyebrow={t.mpChartsEyebrow} title={t.mpChartsTitle} />
        <PolicyMetricsBlock t={t} />
        <div className="grid gap-6 lg:grid-cols-2">
          <AucGauge t={t} />
          <ThresholdsBar t={t} />
        </div>
        <CalibrationLine t={t} />
      </div>

      <DriversBar t={t} />
      <FairnessBlock t={t} />
    </section>
  )
}
