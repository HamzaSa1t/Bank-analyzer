import { useMemo } from 'react'

function makeSeries(seed = 1, points = 64) {
  const out = []
  let val = 44 + seed * 4
  for (let i = 0; i < points; i++) {
    const cycle = Math.sin(i * 0.36 + seed) * 3.4
    const chop = Math.sin(i * 1.9 + seed * 0.7) * 1.2
    const shock = i % 13 === 0 ? (seed % 2 === 0 ? -4.5 : 4.2) : 0
    const drift = seed % 3 === 0 ? -0.04 : 0.09
    val = Math.min(92, Math.max(10, val + cycle * 0.16 + chop + shock + drift))
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

function areaFor(series, w, h, padX = 0) {
  const line = pathFor(series, w, h, padX)
  return `${line} L ${w - padX} ${h} L ${padX} ${h} Z`
}

const LINE_CONFIGS = [
  { color: '#34e89f', width: 2.2, opacity: 0.9, seed: 1 },
  { color: '#3b82ff', width: 1.8, opacity: 0.74, seed: 4 },
  { color: '#f59e0b', width: 1.25, opacity: 0.38, seed: 7 },
  { color: '#ef4444', width: 1.15, opacity: 0.32, seed: 10 },
  { color: '#7afcb1', width: 0.9, opacity: 0.26, seed: 13 },
]

export default function AnimatedStockChart() {
  const W = 1600
  const H = 700

  const lines = useMemo(() => {
    return LINE_CONFIGS.map((cfg, i) => {
      const base = makeSeries(cfg.seed, 96)
      return {
        cfg,
        d: pathFor(base, W, H, 28),
        area: areaFor(base, W, H, 28),
        lastY: H - (base[base.length - 1] / 100) * H,
        lastX: W - 28,
        bars: base.filter((_, idx) => idx % 4 === 0).map((v, idx) => {
          const x = 28 + idx * 4 * ((W - 56) / (base.length - 1))
          const y = H - (v / 100) * H
          const high = Math.max(16, y - 18 - ((idx + i) % 5) * 3)
          const low = Math.min(H - 16, y + 16 + ((idx + i) % 4) * 4)
          return { x, y, high, low, up: (idx + i) % 3 !== 0 }
        }),
      }
    })
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-grid-fade" />

      <svg
        className="absolute inset-0 h-full w-full opacity-[0.09]"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={`h-${i}`} x1="0" x2={W} y1={(H / 10) * (i + 1)} y2={(H / 10) * (i + 1)} stroke="white" strokeWidth="1" />
        ))}
        {Array.from({ length: 18 }).map((_, i) => (
          <line key={`v-${i}`} x1={(W / 18) * (i + 1)} x2={(W / 18) * (i + 1)} y1="0" y2={H} stroke="white" strokeWidth="1" />
        ))}
      </svg>

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          {LINE_CONFIGS.map((c, i) => (
            <linearGradient key={i} id={`lineGradient${i}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor={c.color} stopOpacity="0" />
              <stop offset="0.55" stopColor={c.color} stopOpacity="0.75" />
              <stop offset="1" stopColor={c.color} stopOpacity="1" />
            </linearGradient>
          ))}
          {LINE_CONFIGS.map((c, i) => (
            <linearGradient key={`area-${i}`} id={`areaGradient${i}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={c.color} stopOpacity={i === 0 ? '0.18' : '0.08'} />
              <stop offset="1" stopColor={c.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        <g className="stock-chart-scroll">
          {[0, 1].map(copy => (
            <g key={copy} transform={`translate(${copy * W} 0)`}>
              {lines.map((l, i) => (
                <g key={i}>
                  {i < 2 && <path d={l.area} fill={`url(#areaGradient${i})`} opacity="0.9" />}
                  {i < 3 && l.bars.map((b, idx) => (
                    <g key={idx} opacity={i === 0 ? 0.32 : 0.16}>
                      <line x1={b.x} x2={b.x} y1={b.high} y2={b.low} stroke={l.cfg.color} strokeWidth="1" />
                      <rect
                        x={b.x - 3}
                        y={Math.min(b.y, b.y + (b.up ? -11 : 11))}
                        width="6"
                        height="11"
                        rx="1"
                        fill={b.up ? '#34e89f' : '#ef4444'}
                      />
                    </g>
                  ))}
                  <path
                    d={l.d}
                    fill="none"
                    stroke={`url(#lineGradient${i})`}
                    strokeWidth={l.cfg.width}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={l.cfg.opacity}
                    style={{
                      filter: i < 2 ? `drop-shadow(0 0 8px ${l.cfg.color}80)` : 'none',
                    }}
                  />
                  <circle
                    cx={l.lastX}
                    cy={l.lastY}
                    r={i < 2 ? 4.5 : 2.5}
                    fill={l.cfg.color}
                    opacity={l.cfg.opacity}
                    style={{ filter: `drop-shadow(0 0 10px ${l.cfg.color})` }}
                  />
                </g>
              ))}
            </g>
          ))}
        </g>
      </svg>

      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-navy-950 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-navy-950/80 to-transparent" />
    </div>
  )
}
