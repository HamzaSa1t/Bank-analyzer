import { motion } from 'framer-motion'
import { humanizeFeatureText } from '../lib/featureLabels.js'

export default function LLMReport({
  decision,
  riskSummary,
  keyStrengths,
  keyConcerns,
  decisionExplanation,
  suggestedActions,
  hardRuleRejection,
  t,
}) {
  const approved = decision === 'APPROVED'
  const banner = approved
    ? 'bg-gradient-to-r from-growth-600/30 via-growth-500/20 to-transparent border-growth-500/40 text-growth-300'
    : 'bg-gradient-to-r from-red-700/30 via-red-500/20 to-transparent border-red-500/40 text-red-300'
  const dot = approved ? 'bg-growth-400' : 'bg-red-400'
  const label = approved ? t.decisionApproved : t.decisionRejected

  const fallbackSummary = approved
    ? 'The application cleared the required risk and profitability gates.'
    : 'The application did not clear the required risk and profitability gates.'
  const fallbackExplanation = approved
    ? 'The backend decision is APPROVED and no failed decision gates were reported.'
    : 'The backend decision is REJECTED. Review the failed gates in the decision logic section.'

  // Treat "-" and whitespace-only strings as missing so we never surface a
  // dash placeholder in the narrative card.
  const cleanText = (s) => {
    if (typeof s !== 'string') return null
    const trimmed = s.trim()
    return trimmed === '' || trimmed === '-' ? null : s
  }
  const cleanList = (xs) =>
    (Array.isArray(xs) ? xs : []).filter((x) => cleanText(typeof x === 'string' ? x : String(x)))

  // Use the backend's risk_summary / decision_explanation as-is — overriding
  // them with hardRuleRejection causes the same rule sentence to appear in
  // both fields (and again as key_concerns[0]). hardRuleRejection is only a
  // fallback when the backend omits a sentence.
  const summary = cleanText(riskSummary) || hardRuleRejection || fallbackSummary
  const explanation = cleanText(decisionExplanation) || hardRuleRejection || fallbackExplanation
  const strengths = cleanList(keyStrengths)
  const concerns = cleanList(keyConcerns)
  const actions = cleanList(suggestedActions)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="card overflow-hidden"
    >
      <div className={`flex min-w-0 items-center gap-3 border-b px-5 py-5 sm:px-6 ${banner}`}>
        <span className={`h-2.5 w-2.5 rounded-full ${dot} animate-pulse`} />
        <span className="min-w-0 break-words text-lg font-bold tracking-wide">{label}</span>
      </div>

      <div className="space-y-6 p-5 sm:p-6">
        <Paragraph title={t.riskSummary} body={humanizeFeatureText(summary, t)} />
        <BulletList title={t.keyStrengths} items={strengths} t={t} tone="good" />
        <BulletList title={t.keyConcerns} items={concerns} t={t} tone="bad" />
        <Paragraph title={t.decisionExplanation} body={humanizeFeatureText(explanation, t)} />
        <BulletList title={t.suggestedActions} items={actions} t={t} tone="neutral" />
      </div>
    </motion.div>
  )
}

function Paragraph({ title, body }) {
  return (
    <div className="space-y-2">
      <h4 className="label-muted">{title}</h4>
      <p className="whitespace-pre-line break-words text-sm leading-relaxed text-white/80">{body}</p>
    </div>
  )
}

function BulletList({ title, items, t, tone }) {
  if (!items || items.length === 0) return null
  const dotColor =
    tone === 'good' ? 'bg-growth-400' : tone === 'bad' ? 'bg-red-400' : 'bg-electric-400'
  return (
    <div className="space-y-2">
      <h4 className="label-muted">{title}</h4>
      <ul className="space-y-2">
        {items.map((item, idx) => (
          <li key={idx} className="flex min-w-0 items-start gap-3 text-sm leading-relaxed text-white/80">
            <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${dotColor}`} />
            <span className="min-w-0 break-words">{humanizeFeatureText(String(item), t)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
