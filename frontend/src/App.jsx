import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { STRINGS } from './lib/strings.js'

import Navigation from './components/Navigation.jsx'
import Home from './pages/Home.jsx'

const ModelPerformancePage = lazy(() => import('./pages/ModelPerformancePage.jsx'))

export default function App() {
  const [lang, setLang] = useState('en')
  const t = STRINGS[lang]

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
  }, [lang])

  return (
    <BrowserRouter>
      <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-navy-950 text-white selection:bg-electric-500/30">
        <Navigation t={t} lang={lang} onLangChange={setLang} />

        <Routes>
          <Route path="/" element={<Home t={t} lang={lang} />} />
          <Route
            path="/model-performance"
            element={
              <Suspense fallback={<div className="min-h-[88vh]" />}>
                <ModelPerformancePage t={t} />
              </Suspense>
            }
          />
        </Routes>

        <footer id="contact" className="border-t border-white/5 py-14 scroll-mt-20">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
            <span className="text-sm text-white/45">© {new Date().getFullYear()} {t.brand}</span>
            <a
              href="https://github.com/HamzaSa1t"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-white/45 transition hover:text-white/75"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.71.5.09.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.32 9.32 0 0 1 12 6.96c.85 0 1.7.12 2.5.34 1.9-1.32 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.59.69.49A10.04 10.04 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z" />
              </svg>
              github.com/HamzaSa1t
            </a>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  )
}
