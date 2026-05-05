import { useMemo } from 'react'

const W = 1600
const H = 700

function makeSeamlessSeries(seed = 1, points = 200) {
  const out = []
  for (let i = 0; i < points; i++) {
    const t = (i / points) * Math.PI * 2
    let val = 50
    val += Math.sin(t * 1 + seed * 0.7) * 14
    val += Math.sin(t * 2 + seed * 1.3) * 7
    val += Math.cos(t * 3 + seed * 2.1) * 4
    val += Math.sin(t * 5 + seed * 0.5) * 2.6
    val += Math.cos(t * 7 + seed * 1.9) * 1.4
    out.push(Math.max(15, Math.min(85, val)))
  }
  return out
}

function pathFor(series, w, h) {
  const N = series.length
  const stepX = w / N
  const cmds = []
  for (let i = 0; i <= N; i++) {
    const x = i * stepX
    const v = series[i % N]
    const y = h - (v / 100) * h
    cmds.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`)
  }
  return cmds.join(' ')
}

function areaFor(series, w, h) {
  const line = pathFor(series, w, h)
  return `${line} L ${w} ${h} L 0 ${h} Z`
}

const LINE_CONFIGS = [
  { color: '#34e89f', width: 2.4, opacity: 0.92, seed: 1 },
  { color: '#3b82ff', width: 1.8, opacity: 0.7,  seed: 4 },
  { color: '#f59e0b', width: 1.2, opacity: 0.36, seed: 7 },
]

export default function AnimatedStockChart() {
  const lines = useMemo(() => {
    return LINE_CONFIGS.map((cfg) => {
      const series = makeSeamlessSeries(cfg.seed, 200)
      return {
        cfg,
        d: pathFor(series, W, H),
        area: areaFor(series, W, H),
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
            <linearGradient key={`area-${i}`} id={`areaGradient${i}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={c.color} stopOpacity={i === 0 ? '0.22' : '0.1'} />
              <stop offset="1" stopColor={c.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        <g className="stock-chart-scroll">
          {[0, 1].map((copy) => (
            <g key={copy} transform={`translate(${copy * W} 0)`}>
              {lines.map((l, i) => (
                <g key={i}>
                  {i < 2 && <path d={l.area} fill={`url(#areaGradient${i})`} />}
                  <path
                    d={l.d}
                    fill="none"
                    stroke={l.cfg.color}
                    strokeWidth={l.cfg.width}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={l.cfg.opacity}
                    style={{
                      filter: i < 2 ? `drop-shadow(0 0 8px ${l.cfg.color}80)` : 'none',
                    }}
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
