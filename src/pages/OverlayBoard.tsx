import React, { useEffect, useRef, useState } from 'react'
import { useSocket } from '../hooks/useSocket'
import { useTransparentBg } from '../hooks/useTransparentBg'
import { useDraftAudio } from '../hooks/useDraftAudio'
import { useHeroSfx } from '../hooks/useHeroSfx'
import { DraftSlot } from '../components/DraftSlot'
import { PATRONS, LANES } from '../types'
import type { Hero, LaneColor, DraftEntry, DraftState } from '../types'
import { apiUrl } from '../hooks/useApi'

const CYCLE_FADE_MS = 800
const CYCLE_HOLD_MS = 2000

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function useSyncCycle(pool: Hero[], slotCount: number) {
  const poolRef = useRef(pool)
  poolRef.current = pool

  const deckRef = useRef<Hero[]>([])
  const posRef = useRef(0)
  const activeRef = useRef<0 | 1>(0)
  const framesRef = useRef<[Hero[], Hero[]]>([[], []])

  function drawN(n: number, exclude: Set<string>): Hero[] {
    const p = poolRef.current
    if (p.length === 0 || n === 0) return []
    const taken = new Set(exclude)
    const result: Hero[] = []
    const limit = Math.min(n, p.length)
    let attempts = 0
    while (result.length < limit && attempts < p.length * 3) {
      if (posRef.current >= deckRef.current.length) {
        deckRef.current = shuffleArr(p)
        posRef.current = 0
      }
      const hero = deckRef.current[posRef.current++]
      if (!taken.has(hero.id)) {
        result.push(hero)
        taken.add(hero.id)
      }
      attempts++
    }
    return result
  }

  const [frames, setFrames] = useState<[Hero[], Hero[]]>([[], []])
  const [showIdx, setShowIdx] = useState<0 | 1>(0)

  useEffect(() => {
    deckRef.current = shuffleArr(poolRef.current)
    posRef.current = 0
    activeRef.current = 0
    const f0 = drawN(slotCount, new Set())
    const f1 = drawN(slotCount, new Set(f0.map(h => h.id)))
    framesRef.current = [f0, f1]
    setFrames([f0, f1])
    setShowIdx(0)

    let t1: ReturnType<typeof setTimeout>
    let t2: ReturnType<typeof setTimeout>
    let dead = false

    function tick() {
      t1 = setTimeout(() => {
        if (dead) return
        const next = (1 - activeRef.current) as 0 | 1
        activeRef.current = next
        setShowIdx(next)

        t2 = setTimeout(() => {
          if (dead) return
          const invisible = (1 - activeRef.current) as 0 | 1
          const showing = activeRef.current
          const exclude = new Set(framesRef.current[showing].map((h: Hero) => h.id))
          const newFrame = drawN(slotCount, exclude)
          framesRef.current[invisible] = newFrame
          setFrames(prev => {
            const next = [...prev] as [Hero[], Hero[]]
            next[invisible] = newFrame
            return next
          })
          tick()
        }, CYCLE_FADE_MS)
      }, CYCLE_HOLD_MS)
    }

    tick()
    return () => { dead = true; clearTimeout(t1); clearTimeout(t2) }
  }, [slotCount])

  return { frames, showIdx }
}

export function OverlayBoard() {
  useTransparentBg()
  const { state } = useSocket()
  const { status, config, entries, currentPhase, pendingHero } = state
  const [allHeroes, setAllHeroes] = useState<Hero[]>([])

  useEffect(() => {
    fetch(apiUrl('/api/heroes')).then(r => r.json()).then(setAllHeroes).catch(() => {})
  }, [])

  // Draft soundtrack — plays from start_draft through lane_assign, fades on reveal_lanes.
  const audio = useDraftAudio(state.audioEnabled ?? true, state.audioVolume ?? 0.7)
  const prevStatusRef = useRef<DraftState['status']>('idle')
  useEffect(() => {
    const prev = prevStatusRef.current
    const curr = status
    const wasPlaying = prev === 'drafting' || prev === 'lane_assign'
    const shouldPlay = curr === 'drafting' || curr === 'lane_assign'

    if (!wasPlaying && shouldPlay) audio.start()
    else if (wasPlaying && curr === 'complete') { audio.fadeOut(); audio.playFlourish() }
    else if (wasPlaying && curr === 'idle') audio.stop()

    prevStatusRef.current = curr
  }, [status, audio])

  // Per-hero SFX — fires a random select/unselect clip when an entry gets confirmed.
  // First observation of an entry never plays (avoids retroactive blast when the board
  // opens mid-draft). Only the false→true transition after that fires the clip.
  const heroSfx = useHeroSfx(state.heroSfxEnabled ?? true, state.heroSfxVolume ?? 0.8)
  const observedConfirmRef = useRef<Map<number, boolean>>(new Map())
  useEffect(() => {
    const seen = new Set<number>()
    for (const entry of entries) {
      seen.add(entry.phaseIdx)
      const had = observedConfirmRef.current.has(entry.phaseIdx)
      const prev = observedConfirmRef.current.get(entry.phaseIdx) ?? false
      if (had && !prev && entry.confirmed && entry.hero) {
        heroSfx.play(entry.hero, entry.action === 'pick' ? 'select' : 'unselect')
      }
      observedConfirmRef.current.set(entry.phaseIdx, entry.confirmed)
    }
    for (const idx of [...observedConfirmRef.current.keys()]) {
      if (!seen.has(idx)) observedConfirmRef.current.delete(idx)
    }
  }, [entries, heroSfx])

  // All hooks must run before any early return
  const usedIds = new Set(entries.filter(e => e.hero).map(e => e.hero!.id))
  const availableHeroes = allHeroes.filter(h => !usedIds.has(h.id))

  const emptyIdxMap = new Map<number, number>()
  let emptyCount = 0
  for (const e of entries) {
    if (!e.hero) emptyIdxMap.set(e.phaseIdx, emptyCount++)
  }

  const cycle = useSyncCycle(availableHeroes, emptyCount)
  const cycleShowA = cycle.showIdx === 0

  // Lane reveal fade transition
  const prevLaneRef = useRef<typeof state.laneAssignA>(null)
  const [fadingOut, setFadingOut] = useState(false)
  const [revealedLanes, setRevealedLanes] = useState<Set<LaneColor> | null>(null)
  const [lanesVisible, setLanesVisible] = useState(false)

  const LANE_STEP_MS = 600

  useEffect(() => {
    if (state.laneAssignA && !prevLaneRef.current) {
      setFadingOut(true)
      setTimeout(() => {
        setFadingOut(false)
        setLanesVisible(true)
        setRevealedLanes(new Set())
        setTimeout(() => {
          setRevealedLanes(new Set(['yellow']))
          setTimeout(() => {
            setRevealedLanes(new Set(['yellow', 'blue']))
            setTimeout(() => {
              setRevealedLanes(new Set(['yellow', 'blue', 'green']))
              setTimeout(() => setRevealedLanes(null), 600)
            }, LANE_STEP_MS)
          }, LANE_STEP_MS)
        }, 50)
      }, 500)
    }
    prevLaneRef.current = state.laneAssignA
  }, [state.laneAssignA])

  function slotContentVisible(entry: DraftEntry, assign: Record<number, LaneColor> | null): boolean | undefined {
    if (fadingOut) return false
    if (revealedLanes === null) return undefined
    if (!assign || !entry.hero) return false
    const lane = assign[entry.phaseIdx]
    return lane ? revealedLanes.has(lane) : false
  }

  if (status === 'idle' || !config) return <div className="obs-board-root" />

  const pA = PATRONS[config.teamA.patron]
  const pB = PATRONS[config.teamB.patron]
  const colorA = pA.color
  const colorB = pB.color

  const bansA  = entries.filter(e => e.team === 'A' && e.action === 'ban')
  const bansB  = entries.filter(e => e.team === 'B' && e.action === 'ban')

  const laneOrder = (laneAssign: Record<number, LaneColor> | null) =>
    (e: typeof entries[0]) => laneAssign ? LANES.findIndex(l => l.id === laneAssign[e.phaseIdx]) : -1

  const rawPicksA = entries.filter(e => e.team === 'A' && e.action === 'pick')
  const rawPicksB = entries.filter(e => e.team === 'B' && e.action === 'pick')

  const picksA = lanesVisible && state.laneAssignA
    ? [...rawPicksA].sort((a, b) => laneOrder(state.laneAssignA)(a) - laneOrder(state.laneAssignA)(b))
    : rawPicksA
  // Team B uses row-reverse, so sort descending to keep yellow→blue→green visually L→R
  const picksB = lanesVisible && state.laneAssignB
    ? [...rawPicksB].sort((a, b) => laneOrder(state.laneAssignB)(b) - laneOrder(state.laneAssignB)(a))
    : rawPicksB

  function laneColorFor(phaseIdx: number, assign: Record<number, LaneColor> | null) {
    if (!lanesVisible || !assign || !assign[phaseIdx]) return undefined
    return LANES.find(l => l.id === assign[phaseIdx])?.color
  }

  const currentEntry = entries[currentPhase]

  // Collect the consecutive block of same team+action starting from currentPhase
  const queuePhaseIdxs = new Set<number>()
  if (currentEntry) {
    for (let i = currentPhase; i < entries.length; i++) {
      const e = entries[i]
      if (e.confirmed) continue
      if (e.team !== currentEntry.team || e.action !== currentEntry.action) break
      queuePhaseIdxs.add(e.phaseIdx)
    }
  }

  function cycleProps(entry: typeof entries[0]) {
    const idx = emptyIdxMap.get(entry.phaseIdx)
    const queued = !entry.hero && queuePhaseIdxs.has(entry.phaseIdx)
    if (!queued || idx === undefined) return {}
    return {
      isQueued: true,
      cycleA: cycle.frames[0][idx]?.card,
      cycleB: cycle.frames[1][idx]?.card,
      cycleShowA,
    }
  }

  return (
    <div className="obs-board-root">
      {/* Bans */}
      {(bansA.length > 0 || bansB.length > 0) && (
        <div className="obs-bans">
          <div className="obs-bans__team obs-bans__team--a">
            <img src={pA.icon} className="obs-bans__icon" alt={pA.label} />
            {pA.nameImg
              ? <img src={pA.nameImg} className="obs-bans__name-img" alt={pA.label} />
              : <span className="obs-bans__team-name" style={{ color: colorA }}>{config.teamA.name || pA.label}</span>
            }
          </div>
          <div className="obs-bans__side obs-bans__side--a">
            {bansA.map(entry => (
              <DraftSlot
                key={entry.phaseIdx}
                entry={entry}
                isCurrent={entry.phaseIdx === currentPhase}
                isPending={entry.phaseIdx === currentPhase && !!pendingHero}
                pendingImg={pendingHero?.critical}
                teamColor={colorA}
                {...cycleProps(entry)}
              />
            ))}
          </div>
          <div className="obs-bans__label">BANS</div>
          <div className="obs-bans__side obs-bans__side--b">
            {bansB.map(entry => (
              <DraftSlot
                key={entry.phaseIdx}
                entry={entry}
                isCurrent={entry.phaseIdx === currentPhase}
                isPending={entry.phaseIdx === currentPhase && !!pendingHero}
                pendingImg={pendingHero?.critical}
                teamColor={colorB}
                {...cycleProps(entry)}
              />
            ))}
          </div>
          <div className="obs-bans__team obs-bans__team--b">
            {pB.nameImg
              ? <img src={pB.nameImg} className="obs-bans__name-img" alt={pB.label} />
              : <span className="obs-bans__team-name" style={{ color: colorB }}>{config.teamB.name || pB.label}</span>
            }
            <img src={pB.icon} className="obs-bans__icon" alt={pB.label} />
          </div>
        </div>
      )}

      {/* Picks */}
      <div className="obs-picks">
        <div className="obs-picks__team obs-picks__team--a">
          {picksA.map(entry => (
            <DraftSlot
              key={entry.phaseIdx}
              entry={entry}
              isCurrent={entry.phaseIdx === currentPhase}
              isPending={entry.phaseIdx === currentPhase && !!pendingHero}
              pendingImg={pendingHero?.card}
              teamColor={laneColorFor(entry.phaseIdx, state.laneAssignA) ?? colorA}
              contentVisible={slotContentVisible(entry, state.laneAssignA)}
              {...cycleProps(entry)}
            />
          ))}
        </div>
        <div className="obs-picks__team obs-picks__team--b">
          {picksB.map(entry => (
            <DraftSlot
              key={entry.phaseIdx}
              entry={entry}
              isCurrent={entry.phaseIdx === currentPhase}
              isPending={entry.phaseIdx === currentPhase && !!pendingHero}
              pendingImg={pendingHero?.card}
              teamColor={laneColorFor(entry.phaseIdx, state.laneAssignB) ?? colorB}
              contentVisible={slotContentVisible(entry, state.laneAssignB)}
              {...cycleProps(entry)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
