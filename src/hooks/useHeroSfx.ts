import { useCallback, useRef } from 'react'
import type { Hero } from '../types'
import { apiUrl } from './useApi'

const PLAY_DELAY_MS = 300

/**
 * Picks and plays a random clip from hero.selectAudio / hero.unselectAudio
 * after a short delay (so the voice lands a beat after the confirm).
 * One-shot HTMLAudioElement per call — overlapping plays are fine.
 */
export function useHeroSfx(enabled: boolean, volume: number) {
  const enabledRef = useRef(enabled); enabledRef.current = enabled
  const volumeRef = useRef(volume); volumeRef.current = volume

  const play = useCallback((hero: Hero, kind: 'select' | 'unselect') => {
    if (!enabledRef.current) return
    const list = kind === 'select' ? hero.selectAudio : hero.unselectAudio
    if (!list || list.length === 0) return
    const url = list[Math.floor(Math.random() * list.length)]
    setTimeout(() => {
      if (!enabledRef.current) return
      const a = new Audio(apiUrl(url))
      a.volume = Math.max(0, Math.min(1, volumeRef.current))
      a.play().catch(e => console.warn('Hero SFX failed:', e))
    }, PLAY_DELAY_MS)
  }, [])

  return { play }
}
