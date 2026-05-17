import { useEffect, useState } from 'react'
import { apiUrl } from './useApi'
import type { HeroStatsMap } from '../types'

export function useHeroStats(): HeroStatsMap {
  const [stats, setStats] = useState<HeroStatsMap>({})
  useEffect(() => {
    let cancelled = false
    fetch(apiUrl('/api/hero-stats'))
      .then(r => r.ok ? r.json() as Promise<HeroStatsMap> : {} as HeroStatsMap)
      .then(d => { if (!cancelled && d && typeof d === 'object') setStats(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  return stats
}
