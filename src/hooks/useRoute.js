import { useState, useEffect } from 'react'

export function useRoute() {
  const getHash = () => window.location.hash.replace('#', '') || '/'

  const [route, setRoute] = useState(getHash)

  useEffect(() => {
    const handleHashChange = () => setRoute(getHash())
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const navigate = (path) => {
    window.location.hash = path
  }

  return { route, navigate }
}
