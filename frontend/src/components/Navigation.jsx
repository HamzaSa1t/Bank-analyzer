import { motion } from 'framer-motion'
import { Link, useLocation, useNavigate } from 'react-router-dom'

export default function Navigation({ t, lang, onLangChange }) {
  const items = [
    { key: 'navHome', kind: 'anchor', id: 'home' },
    { key: 'navHowItWorks', kind: 'anchor', id: 'how' },
    { key: 'navResults', kind: 'anchor', id: 'results' },
    { key: 'navModelPerformance', kind: 'route', to: '/model-performance' },
    { key: 'navContact', kind: 'anchor', id: 'contact' },
  ]

  return (
    <motion.header
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="sticky top-0 z-40 w-full backdrop-blur-md bg-navy-950/40 border-b border-white/5"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 text-white">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-electric-500 to-growth-500 shadow-glow">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M3 17l6-6 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 7h7v7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-sm font-semibold tracking-wide">{t.brand}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {items.map(it => (
            <NavItem key={it.key} item={it} label={t[it.key]} />
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onLangChange(lang === 'ar' ? 'en' : 'ar')}
            className="pill hover:bg-white/10"
            aria-label="toggle language"
          >
            {lang === 'ar' ? 'EN' : 'AR'}
          </button>
          <CtaButton label={t.getStarted} />
        </div>
      </div>
    </motion.header>
  )
}

function NavItem({ item, label }) {
  const location = useLocation()
  const navigate = useNavigate()
  const className = 'text-sm text-white/70 transition hover:text-white'

  if (item.kind === 'route') {
    return <Link to={item.to} className={className}>{label}</Link>
  }

  // Anchor: scroll on the home route, navigate then scroll otherwise.
  const handleClick = (e) => {
    e.preventDefault()
    if (location.pathname === '/') {
      document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })
    } else {
      navigate('/')
      // Wait one tick for the route to mount, then scroll.
      requestAnimationFrame(() => {
        setTimeout(() => {
          document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })
        }, 80)
      })
    }
  }

  return (
    <a href={`/#${item.id}`} onClick={handleClick} className={className}>
      {label}
    </a>
  )
}

function CtaButton({ label }) {
  const location = useLocation()
  const navigate = useNavigate()

  const handleClick = () => {
    if (location.pathname === '/') {
      document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })
    } else {
      navigate('/')
      requestAnimationFrame(() => {
        setTimeout(() => {
          document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })
        }, 80)
      })
    }
  }

  return (
    <button type="button" onClick={handleClick} className="btn-primary !py-2 !px-5 !text-sm">
      {label}
    </button>
  )
}
