import { useCallback, useEffect, useRef } from 'react'

const AUDIO_SRC = '/audio/character-select.mp3'
const FLOURISH_SRC = '/audio/reveal-flourish.mp3'
const DEFAULT_FADE_OUT_MS = 1500
const FADE_IN_MS = 1800

function clampGain(v: number): number {
  return Math.max(0.0001, Math.min(1, v))
}

/**
 * Plays the draft soundtrack with a gapless loop via the Web Audio API.
 * AudioBufferSourceNode.loop produces a seamless loop (no MP3 header padding gap).
 *
 * `enabled` toggles playback; turning it off immediately stops.
 * `volume` is reactive; updates the gain smoothly while playing.
 * `start()` fades in from 0 → `volume`; `fadeOut()` ramps to silence and stops.
 */
export function useDraftAudio(enabled: boolean, volume: number) {
  const ctxRef = useRef<AudioContext | null>(null)
  const bufferRef = useRef<AudioBuffer | null>(null)
  const flourishBufferRef = useRef<AudioBuffer | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const enabledRef = useRef(enabled)
  const volumeRef = useRef(volume)
  enabledRef.current = enabled
  volumeRef.current = volume

  useEffect(() => {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctor) return
    const ctx: AudioContext = new Ctor()
    ctxRef.current = ctx

    fetch(AUDIO_SRC)
      .then(r => r.arrayBuffer())
      .then(ab => ctx.decodeAudioData(ab))
      .then(buf => { bufferRef.current = buf })
      .catch(e => console.warn('Audio load failed:', e))

    fetch(FLOURISH_SRC)
      .then(r => r.arrayBuffer())
      .then(ab => ctx.decodeAudioData(ab))
      .then(buf => { flourishBufferRef.current = buf })
      .catch(e => console.warn('Flourish load failed:', e))

    // Resume the context on first user interaction (browser autoplay policy).
    const prime = () => { if (ctx.state === 'suspended') ctx.resume().catch(() => {}) }
    window.addEventListener('pointerdown', prime, { once: true })
    window.addEventListener('keydown', prime, { once: true })

    return () => {
      window.removeEventListener('pointerdown', prime)
      window.removeEventListener('keydown', prime)
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
      try { sourceRef.current?.stop() } catch {}
      sourceRef.current = null
      gainRef.current = null
      ctx.close().catch(() => {})
      ctxRef.current = null
    }
  }, [])

  const stopImmediate = useCallback(() => {
    if (stopTimerRef.current) { clearTimeout(stopTimerRef.current); stopTimerRef.current = null }
    const src = sourceRef.current
    if (src) {
      try { src.stop() } catch {}
      try { src.disconnect() } catch {}
      sourceRef.current = null
    }
    if (gainRef.current) {
      try { gainRef.current.disconnect() } catch {}
      gainRef.current = null
    }
  }, [])

  const start = useCallback(() => {
    if (!enabledRef.current) return
    const ctx = ctxRef.current
    const buf = bufferRef.current
    if (!ctx || !buf) return
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})

    stopImmediate()

    const source = ctx.createBufferSource()
    source.buffer = buf
    source.loop = true

    const gain = ctx.createGain()
    const target = clampGain(volumeRef.current)
    const now = ctx.currentTime
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(target, now + FADE_IN_MS / 1000)
    source.connect(gain).connect(ctx.destination)
    source.start(0)

    sourceRef.current = source
    gainRef.current = gain
  }, [stopImmediate])

  const playFlourish = useCallback(() => {
    if (!enabledRef.current) return
    const ctx = ctxRef.current
    const buf = flourishBufferRef.current
    if (!ctx || !buf) return
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    const source = ctx.createBufferSource()
    source.buffer = buf
    const gain = ctx.createGain()
    gain.gain.value = clampGain(volumeRef.current)
    source.connect(gain).connect(ctx.destination)
    source.start(0)
  }, [])

  const fadeOut = useCallback((durationMs: number = DEFAULT_FADE_OUT_MS) => {
    const ctx = ctxRef.current
    const src = sourceRef.current
    const gain = gainRef.current
    if (!ctx || !src || !gain) return

    const now = ctx.currentTime
    const seconds = Math.max(0.05, durationMs / 1000)
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(gain.gain.value, now)
    gain.gain.linearRampToValueAtTime(0.0001, now + seconds)

    if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
    stopTimerRef.current = setTimeout(() => {
      stopImmediate()
    }, durationMs + 80)
  }, [stopImmediate])

  // React to enabled toggle: stop on off
  useEffect(() => {
    if (!enabled) stopImmediate()
  }, [enabled, stopImmediate])

  // React to volume changes while playing: smooth ramp to new level.
  // cancelAndHoldAtTime holds the *currently rendered* value (important during
  // the fade-in, where gain.gain.value otherwise reads the last setValueAtTime).
  useEffect(() => {
    const ctx = ctxRef.current
    const gain = gainRef.current
    if (!ctx || !gain) return
    const now = ctx.currentTime
    const target = clampGain(volume)
    const param = gain.gain as AudioParam & { cancelAndHoldAtTime?: (t: number) => void }
    if (typeof param.cancelAndHoldAtTime === 'function') {
      param.cancelAndHoldAtTime(now)
    } else {
      param.cancelScheduledValues(now)
      param.setValueAtTime(param.value, now)
    }
    param.linearRampToValueAtTime(target, now + 0.12)
  }, [volume])

  return { start, fadeOut, stop: stopImmediate, playFlourish }
}
