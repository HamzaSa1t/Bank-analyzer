import { useEffect, useMemo, useRef, useState } from 'react'

// Background SVG of bullish stock lines drifting upward, with periodically populating
// data points to give a 'live' feel. Pure SVG, no chart library needed for this layer.

function makeSeries(seed = 1, points = 40) {
  const out = []
  let val = 30 + seed * 7
  for (let i = 0; i < points; i++) {
    const drift = 0.6 + seed * 0.1
    const noise = (Math.sin(i * 0.7 + seed) + Math.cos(i * 0.31 + seed * 2)) * 2.5
    val = Math.min(95, Math.max(5, val + drift + noise))
    out.push(val)
  }
  return out
}

function pathFor(series, w, h, padX = 0) {
  const n = series.length
  const stepX = (w - padX * 2) / (n - 1)
  return series
    .map((v, i) => {
      const x = padX + i * stepX
      const y = h - (v / 100) * h
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

const LINE_CONFIGS = [
  { color: '#34e89f', width: 1.5, opacity: 0.85, seed: 1, dash: '0' },
  { color: '#3b82ff', width: 1.5, opacity: 0.75, seed: 3, dash: '0' },
  { color: '#7afcb1', width: 1, opacity: 0.45, seed: 5, dash: '4 6' },
  { color: '#5ea0ff', width: 1, opacity: 0.4, seed: 7, dash: '4 6' },
  { color: '#34e89f', width: 0.8, opacity: 0.25, seed: 9, dash: '2 8' },
]

export default function AnimatedStockChart() {
  const W = 1600
  const H = 700
  const [tick, setTick] = useState(0)
  const seriesRef = useRef(LINE_CONFIGS.map(c => makeSeries(c.seed)))

  useEffect(() => {
    const id = setInterval(() => {
      seriesRef.current = seriesRef.current.map((s, idx) => {
        const cfg = LINE_CONFIGS[idx]
        const last = s[s.length - 1]
        const drift = 0.5 + cfg.seed * 0.08
        const noise = (Math.random() - 0.45) * 4
        const next = Math.min(95, Math.max(5, last + drift + noise))
        return [...s.slice(1), next]
      })
      setTick(t => t + 1)
    }, 1500)
    return () => clearInterval(id)
  }, [])

  const lines = useMemo(() => {
    return seriesRef.current.map((s, i) => ({
      cfg: LINE_CONFIGS[i],
      d: pathFor(s, W, H, 20),
      lastY: H - (s[s.length - 1] / 100) * H,
      lastX: W - 20,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* radial gradient glow */}
      <div className="absolute inset-0 bg-grid-fade" />

      {/* faint horizontal grid */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.08]"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <line
            key={i}
            x1="0"
            x2={W}
            y1={(H / 8) * (i + 1)}
            y2={(H / 8) * (i + 1)}
            stroke="white"
            strokeWidth="1"
          />
        ))}
      </svg>

      {/* animated lines */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          {LINE_CONFIGS.map((c, i) => (
            <linearGradient key={i} id={`g${i}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor={c.color} stopOpacity="0" />
              <stop offset="0.6" stopColor={c.color} stopOpacity="0.9" />
              <stop offset="1" stopColor={c.color} stopOpacity="1" />
            </linearGradient>
          ))}
        </defs>

        {lines.map((l, i) => (
          <g key={i} style={{ transition: 'opacity 600ms' }}>
            <path
              d={l.d}
              fill="none"
              stroke={`url(#g${i})`}
              strokeWidth={l.cfg.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={l.cfg.dash}
              opacity={l.cfg.opacity}
              style={{
                filter:
                  i < 2
                    ? `drop-shadow(0 0 6px ${l.cfg.color}80)`
                    : 'none',
                transition: 'd 1200ms ease-out',
              }}
            />
            {/* Pulsing data point at the leading edge */}
            <circle
              cx={l.lastX}
              cy={l.lastY}
              r={i < 2 ? 4 : 2.5}
              fill={l.cfg.color}
              opacity={l.cfg.opacity}
              style={{ filter: `drop-shadow(0 0 8px ${l.cfg.color})` }}
            >
              <animate
                attributeName="r"
                values={`${i < 2 ? 4 : 2.5};${i < 2 ? 7 : 5};${i < 2 ? 4 : 2.5}`}
                dur="2.6s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
        ))}
      </svg>

      {/* bottom fade */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-navy-950 to-transparent" />
      {/* top fade */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-navy-950/80 to-transparent" />
    </div>
  )
}
