import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useLocation, useNavigate } from 'react-router-dom'

export default function Navigation({ t, lang, onLangChange }) {
  const items = [
    { key: 'navHome', kind: 'anchor', id: 'home' },
    { key: 'navApply', kind: 'anchor', id: 'apply' },
    { key: 'navHowItWorks', kind: 'route-anchor', to: '/model-performance', id: 'how-it-works' },
    { key: 'navModelPerformance', kind: 'route-anchor', to: '/model-performance', id: 'model-performance' },
    { key: 'navContact', kind: 'anchor', id: 'contact' },
  ]

  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const headerRef = useRef(null)

  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false) }
    const onClick = (e) => {
      if (headerRef.current && !headerRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [menuOpen])

  return (
    <motion.header
      ref={headerRef}
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
            {lang === 'ar' ? 'EN' : 'ع'}
          </button>
          <CtaButton label={t.getStarted} />
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="pill grid h-9 w-9 place-items-center md:hidden hover:bg-white/10"
            aria-label={menuOpen ? (t.menuClose || 'Close menu') : (t.menuOpen || 'Open menu')}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-panel"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {menuOpen ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <>
                  <path d="M4 7h16" />
                  <path d="M4 12h16" />
                  <path d="M4 17h16" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {menuOpen && (
          <motion.nav
            id="mobile-nav-panel"
            key="mobile-nav-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="md:hidden overflow-hidden border-t border-white/5 bg-navy-950/70 backdrop-blur-md"
          >
            <ul className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6">
              {items.map(it => (
                <li key={it.key}>
                  <NavItem
                    item={it}
                    label={t[it.key]}
                    onNavigate={() => setMenuOpen(false)}
                    mobile
                  />
                </li>
              ))}
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  )
}

function NavItem({ item, label, onNavigate, mobile }) {
  const location = useLocation()
  const navigate = useNavigate()
  const className = mobile
    ? 'block w-full rounded-lg px-3 py-2.5 text-base text-white/85 transition hover:bg-white/5 hover:text-white'
    : 'text-[15px] text-white/70 transition hover:text-white'

  const afterClick = () => { if (typeof onNavigate === 'function') onNavigate() }

  if (item.kind === 'route') {
    return (
      <Link to={item.to} className={className} onClick={afterClick}>{label}</Link>
    )
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
      afterClick()
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
      requestAnimationFrame(() => {
        setTimeout(() => {
          document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })
        }, 80)
      })
    }
    afterClick()
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
