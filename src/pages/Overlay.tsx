import React, { useEffect, useRef, useState } from 'react'
import { useSocket } from '../hooks/useSocket'
import { DraftSlot } from '../components/DraftSlot'
import { PickReveal } from '../components/PickReveal'
import type { DraftEntry, Hero, Team } from '../types'

// Track the last confirmed pick to trigger reveal
function useLastPick(entries: DraftEntry[]) {
  const prevRef = useRef<DraftEntry[]>([])
  const [lastPick, setLastPick] = useState<{ hero: Hero; team: Team } | null>(null)

  useEffect(() => {
    const prev = prevRef.current
    for (let i = 0; i < entries.length; i++) {
      const cur = entries[i]
      const old = prev[i]
      if (cur.action === 'pick' && cur.confirmed && cur.hero && (!old || !old.confirmed)) {
        setLastPick({ hero: cur.hero, team: cur.team })
        break
      }
    }
    prevRef.current = entries
  }, [entries])

  return lastPick
}

export function Overlay() {
  const { state } = useSocket()
  const { status, config, entries, currentPhase, pendingHero, score } = state
  const lastPick = useLastPick(entries)

  if (status === 'idle' || !config) {
    return (
      <div className="overlay overlay--idle">
        <span className="overlay-idle-text">Waiting for draft…</span>
      </div>
    )
  }

  const bansA = entries.filter(e => e.team === 'A' && e.action === 'ban')
  const bansB = entries.filter(e => e.team === 'B' && e.action === 'ban')
  const picksA = entries.filter(e => e.team === 'A' && e.action === 'pick')
  const picksB = entries.filter(e => e.team === 'B' && e.action === 'pick')

  const formatLabel = config.format.toUpperCase()

  return (
    <div className="overlay">
      {/* ── Top bar ──────────────────────────────────────── */}
      <div className="overlay-topbar">
        <div className="overlay-team overlay-team--a">
          {config.teamA.logo && <img src={config.teamA.logo} className="overlay-team__logo" alt="" />}
          <span className="overlay-team__name">{config.teamA.name || 'Team A'}</span>
        </div>

        <div className="overlay-score">
          <span className="overlay-score__num overlay-score__num--a">{score.a}</span>
          <span className="overlay-score__format">{formatLabel}</span>
          <span className="overlay-score__num overlay-score__num--b">{score.b}</span>
        </div>

        <div className="overlay-team overlay-team--b">
          <span className="overlay-team__name">{config.teamB.name || 'Team B'}</span>
          {config.teamB.logo && <img src={config.teamB.logo} className="overlay-team__logo" alt="" />}
        </div>
      </div>

      {/* ── Bans row ─────────────────────────────────────── */}
      {(bansA.length > 0 || bansB.length > 0) && (
        <div className="overlay-bans">
          <div className="overlay-bans__side overlay-bans__side--a">
            {bansA.map((entry, i) => (
              <DraftSlot
                key={entry.phaseIdx}
                entry={entry}
                isCurrent={entry.phaseIdx === currentPhase}
                isPending={entry.phaseIdx === currentPhase && !!pendingHero}
                pendingImg={pendingHero?.critical}
              />
            ))}
          </div>
          <div className="overlay-bans__label">BANS</div>
          <div className="overlay-bans__side overlay-bans__side--b">
            {bansB.map((entry, i) => (
              <DraftSlot
                key={entry.phaseIdx}
                entry={entry}
                isCurrent={entry.phaseIdx === currentPhase}
                isPending={entry.phaseIdx === currentPhase && !!pendingHero}
                pendingImg={pendingHero?.critical}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Picks area ───────────────────────────────────── */}
      <div className="overlay-picks">
        <div className="overlay-picks__team overlay-picks__team--a">
          {picksA.map(entry => (
            <DraftSlot
              key={entry.phaseIdx}
              entry={entry}
              isCurrent={entry.phaseIdx === currentPhase}
              isPending={entry.phaseIdx === currentPhase && !!pendingHero}
              pendingImg={pendingHero?.card}
            />
          ))}
        </div>

        <div className="overlay-picks__team overlay-picks__team--b">
          {picksB.map(entry => (
            <DraftSlot
              key={entry.phaseIdx}
              entry={entry}
              isCurrent={entry.phaseIdx === currentPhase}
              isPending={entry.phaseIdx === currentPhase && !!pendingHero}
              pendingImg={pendingHero?.card}
            />
          ))}
        </div>
      </div>

      {/* ── Pick reveal (cinematic, slides from right) ───── */}
      {lastPick && (
        <PickReveal
          key={`${lastPick.hero.id}-${lastPick.team}`}
          hero={lastPick.hero}
          team={lastPick.team}
          teamName={
            lastPick.team === 'A'
              ? config.teamA.name || 'Team A'
              : config.teamB.name || 'Team B'
          }
        />
      )}
    </div>
  )
}
