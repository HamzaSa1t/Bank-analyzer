import { motion } from 'framer-motion'
import { humanizeFeatureText } from '../lib/featureLabels.js'

export default function LLMReport({ decision, reason, recommendation, t, hardRuleRejection }) {
  const approved = decision === 'APPROVED'
  const banner = approved
    ? 'bg-gradient-to-r from-growth-600/30 via-growth-500/20 to-transparent border-growth-500/40 text-growth-300'
    : 'bg-gradient-to-r from-red-700/30 via-red-500/20 to-transparent border-red-500/40 text-red-300'
  const dot = approved ? 'bg-growth-400' : 'bg-red-400'
  const label = approved ? t.decisionApproved : t.decisionRejected

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="card overflow-hidden"
    >
      <div className={`flex items-center gap-3 border-b px-6 py-5 ${banner}`}>
        <span className={`h-2.5 w-2.5 rounded-full ${dot} animate-pulse`} />
        <span className="text-lg font-bold tracking-wide">{label}</span>
      </div>

      <div className="grid gap-6 p-6 md:grid-cols-2">
        <Section title={t.reason} body={humanizeFeatureText(hardRuleRejection || reason || '-', t)} />
        <Section title={t.recommendation} body={humanizeFeatureText(recommendation || '-', t)} />
      </div>
    </motion.div>
  )
}

function Section({ title, body }) {
  return (
    <div className="space-y-2">
      <h4 className="label-muted">{title}</h4>
      <p className="text-sm leading-relaxed text-white/80 whitespace-pre-line">{body}</p>
    </div>
  )
}
