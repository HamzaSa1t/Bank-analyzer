import { useEffect } from 'react'
import ModelPerformance from '../components/ModelPerformance.jsx'

export default function ModelPerformancePage({ t }) {
  // Land at the top when arriving via in-app navigation.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in window.scrollTo ? 'instant' : 'auto' })
  }, [])
  return <ModelPerformance t={t} />
}
