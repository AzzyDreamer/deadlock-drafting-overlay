import React, { useEffect, useRef, useState } from 'react'
import { useSocket } from '../hooks/useSocket'
import { useTransparentBg } from '../hooks/useTransparentBg'
import { PickReveal } from '../components/PickReveal'
import type { DraftEntry, Hero, Team } from '../types'

function useLastAction(entries: DraftEntry[]) {
  const prevRef = useRef<DraftEntry[]>([])
  const [last, setLast] = useState<{ hero: Hero; team: Team; action: 'pick' | 'ban'; key: number } | null>(null)
  const keyRef = useRef(0)

  useEffect(() => {
    const prev = prevRef.current
    for (let i = 0; i < entries.length; i++) {
      const cur = entries[i]
      const old = prev[i]
      if (cur.confirmed && cur.hero && (!old || !old.confirmed)) {
        keyRef.current += 1
        setLast({ hero: cur.hero, team: cur.team, action: cur.action, key: keyRef.current })
        break
      }
    }
    prevRef.current = [...entries]
  }, [entries])

  return last
}

export function OverlayReveal() {
  useTransparentBg()
  const { state } = useSocket()
  const last = useLastAction(state.entries)

  const teamName = last
    ? last.team === 'A'
      ? state.config?.teamA.name || 'Team A'
      : state.config?.teamB.name || 'Team B'
    : ''

  return (
    <div className="obs-reveal-root">
      {last && (
        <PickReveal
          key={last.key}
          hero={last.hero}
          team={last.team}
          teamName={teamName}
          action={last.action}
        />
      )}
    </div>
  )
}
