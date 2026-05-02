import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts'

function colorFor(score) {
  if (score >= 650) return '#34e89f'
  if (score >= 480) return '#f5b942'
  return '#ef4444'
}

export default function CreditScoreGauge({ score, label }) {
  const safe = Math.max(300, Math.min(900, Number(score) || 300))
  const data = [{ name: 'score', value: safe, fill: colorFor(safe) }]
  return (
    <div className="relative h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="78%"
          outerRadius="100%"
          data={data}
          startAngle={210}
          endAngle={-30}
        >
          <PolarAngleAxis type="number" domain={[300, 900]} tick={false} />
          <RadialBar
            background={{ fill: 'rgba(255,255,255,0.06)' }}
            dataKey="value"
            cornerRadius={20}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">{label}</span>
        <span className="mt-1 text-4xl font-extrabold tracking-tight" style={{ color: colorFor(safe) }}>
          {safe}
        </span>
        <span className="text-[10px] text-white/40">/ 900</span>
      </div>
    </div>
  )
}
