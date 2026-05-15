import { useEffect } from 'react'

export function useTransparentBg() {
  useEffect(() => {
    const root = document.getElementById('root')
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
    if (root) root.style.background = 'transparent'
    return () => {
      document.documentElement.style.background = ''
      document.body.style.background = ''
      if (root) root.style.background = ''
    }
  }, [])
}
