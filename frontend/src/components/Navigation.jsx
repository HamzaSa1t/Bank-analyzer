import { motion } from 'framer-motion'
import { Link, useLocation, useNavigate } from 'react-router-dom'

export default function Navigation({ t, lang, onLangChange }) {
  const items = [
    { key: 'navHome', kind: 'anchor', id: 'home' },
    { key: 'navApply', kind: 'anchor', id: 'apply' },
    { key: 'navHowItWorks', kind: 'route-anchor', to: '/model-performance', id: 'how-it-works' },
    { key: 'navModelPerformance', kind: 'route-anchor', to: '/model-performance', id: 'model-performance' },
    { key: 'navContact', kind: 'anchor', id: 'contact' },
  ]

  return (
    <motion.header
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="sticky top-0 z-40 w-full backdrop-blur-md bg-navy-950/40 border-b border-white/5"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
        <Link to="/" className="flex min-w-0 items-center gap-2 text-white">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-electric-500 to-growth-500 shadow-glow">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M3 17l6-6 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 7h7v7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="truncate text-sm font-semibold tracking-wide sm:text-base">{t.brand}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-9">
          {items.map(it => (
            <NavItem key={it.key} item={it} label={t[it.key]} />
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
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
  const className = 'text-[15px] text-white/70 transition hover:text-white'

  if (item.kind === 'route') {
    return <Link to={item.to} className={className}>{label}</Link>
  }

  // Cross-route anchor: navigate to a different route, then scroll to a section there.
  if (item.kind === 'route-anchor') {
    const handleClick = (e) => {
      e.preventDefault()
      const scroll = () => {
        document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })
      }
      if (location.pathname === item.to) {
        scroll()
      } else {
        navigate(item.to)
        requestAnimationFrame(() => { setTimeout(scroll, 80) })
      }
    }
    return (
      <a href={`${item.to}#${item.id}`} onClick={handleClick} className={className}>
        {label}
      </a>
    )
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
    <button type="button" onClick={handleClick} className="btn-primary hidden !py-2.5 !px-5 !text-sm sm:inline-flex lg:!px-6">
      {label}
    </button>
  )
}
