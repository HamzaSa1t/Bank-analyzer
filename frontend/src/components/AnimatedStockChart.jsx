import { useMemo } from 'react'

const W = 1600
const H = 700

function mulberry32(seed) {
  return function rand() {
    let t = seed += 0x6d2b79f5
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeMarketSeries({ seed, points, volatility, trendBias, spike }) {
  const rand = mulberry32(seed)
  const returns = []
  let drift = (rand() - 0.5) * trendBias
  let regime = 0

  for (let i = 0; i < points; i++) {
    if (regime <= 0) {
      regime = 10 + Math.floor(rand() * 24)
      drift = (rand() - 0.5) * trendBias
    }
    regime -= 1

    const consolidation = rand() < 0.2 ? 0.35 : 1
    let move = ((rand() - 0.5) * volatility + drift) * consolidation
    if (rand() < 0.045) move += (rand() > 0.5 ? 1 : -1) * spike * (0.45 + rand())
    returns.push(move)
  }

  const total = returns.reduce((sum, n) => sum + n, 0)
  const bridged = returns.map((n) => n - total / points)
  const values = [50]
  for (let i = 0; i < points; i++) values.push(values[i] + bridged[i])

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  return values.slice(0, points).map((v) => 18 + ((v - min) / span) * 64)
}

function pointAt(series, index) {
  const n = series.length
  const x = (index / n) * W
  const y = H - (series[((index % n) + n) % n] / 100) * H
  return { x, y }
}

function pathFor(series) {
  const n = series.length
  const first = pointAt(series, 0)
  const cmds = [`M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`]

  for (let i = 0; i < n; i++) {
    const p0 = pointAt(series, i - 1)
    const p1 = pointAt(series, i)
    const p2 = pointAt(series, i + 1)
    const p3 = pointAt(series, i + 2)
    if (i === n - 1) p2.x = W
    if (i === n - 1) p3.x = W + (W / n)

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    cmds.push(`C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`)
  }

  return cmds.join(' ')
}

const LINE_CONFIGS = [
  { color: '#34e89f', width: 2.2, opacity: 0.86, seed: 11, volatility: 5.8, trendBias: 1.8, spike: 9, duration: 24 },
  { color: '#3b82ff', width: 1.7, opacity: 0.58, seed: 23, volatility: 4.2, trendBias: 1.4, spike: 7, duration: 32 },
  { color: '#7afcb1', width: 1.2, opacity: 0.34, seed: 37, volatility: 3.4, trendBias: 1.0, spike: 5, duration: 42 },
  { color: '#f59e0b', width: 1.1, opacity: 0.22, seed: 51, volatility: 6.8, trendBias: 2.2, spike: 11, duration: 29 },
]

export default function AnimatedStockChart() {
  const lines = useMemo(() => {
    return LINE_CONFIGS.map((cfg) => ({
      cfg,
      d: pathFor(makeMarketSeries({ ...cfg, points: 96 })),
    }))
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        {lines.map((l, i) => (
          <g
            key={i}
            className="stock-chart-scroll"
            style={{ animationDuration: `${l.cfg.duration}s` }}
          >
            {[0, 1].map((copy) => (
              <g key={copy} transform={`translate(${copy * W} 0)`}>
                <path
                  d={l.d}
                  fill="none"
                  stroke={l.cfg.color}
                  strokeWidth={l.cfg.width + 5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={l.cfg.opacity * 0.16}
                />
                <path
                  d={l.d}
                  fill="none"
                  stroke={l.cfg.color}
                  strokeWidth={l.cfg.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={l.cfg.opacity}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ))}
          </g>
        ))}
      </svg>

      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-navy-950 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-navy-950/80 to-transparent" />
    </div>
  )
}
