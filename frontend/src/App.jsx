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

        <footer id="contact" className="border-t border-white/5 py-10">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 md:flex-row">
            <span className="text-xs text-white/40">© {new Date().getFullYear()} {t.brand}</span>
            <span className="text-xs text-white/40">SAMA · SIMAH · Powered by XGBoost & SHAP</span>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  )
}
