import React, { useState } from 'react'
import type { DraftEntry, LaneColor } from '../types'
import { LANES } from '../types'
import { apiUrl } from '../hooks/useApi'

interface Props {
  picksA: DraftEntry[]
  picksB: DraftEntry[]
  onReveal: (assignA: Record<number, LaneColor>, assignB: Record<number, LaneColor>) => void
}

function isValid(assign: Record<number, LaneColor>, picks: DraftEntry[]) {
  if (Object.keys(assign).length !== picks.length) return false
  for (const lane of LANES) {
    const count = Object.values(assign).filter(l => l === lane.id).length
    if (count !== 2) return false
  }
  return true
}

function TeamLanes({
  picks,
  assign,
  onChange,
}: {
  picks: DraftEntry[]
  assign: Record<number, LaneColor>
  onChange: (next: Record<number, LaneColor>) => void
}) {
  function set(phaseIdx: number, lane: LaneColor) {
    onChange({ ...assign, [phaseIdx]: lane })
  }

  const counts = Object.fromEntries(LANES.map(l => [l.id, 0])) as Record<LaneColor, number>
  for (const l of Object.values(assign)) counts[l]++

  return (
    <div className="lane-team">
      <div className="lane-team__counts">
        {LANES.map(l => (
          <span key={l.id} className="lane-count" style={{ color: l.color }}>
            {l.label}: {counts[l.id]}/2
          </span>
        ))}
      </div>
      <div className="lane-team__picks">
        {picks.map(entry => {
          const hero = entry.hero!
          const cur = assign[entry.phaseIdx]
          return (
            <div key={entry.phaseIdx} className="lane-pick">
              <img src={apiUrl(hero.card)} className="lane-pick__img" alt={hero.name} />
              <span className="lane-pick__name">{hero.name}</span>
              <div className="lane-pick__btns">
                {LANES.map(l => (
                  <button
                    key={l.id}
                    className={`lane-btn ${cur === l.id ? 'lane-btn--active' : ''}`}
                    style={{ '--lane-color': l.color } as React.CSSProperties}
                    onClick={() => set(entry.phaseIdx, l.id)}
                  >
                    {l.label[0]}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function LaneAssign({ picksA, picksB, onReveal }: Props) {
  const [assignA, setAssignA] = useState<Record<number, LaneColor>>({})
  const [assignB, setAssignB] = useState<Record<number, LaneColor>>({})

  const valid = isValid(assignA, picksA) && isValid(assignB, picksB)

  return (
    <div className="lane-assign">
      <div className="lane-assign__teams">
        <TeamLanes picks={picksA} assign={assignA} onChange={setAssignA} />
        <div className="lane-assign__divider" />
        <TeamLanes picks={picksB} assign={assignB} onChange={setAssignB} />
      </div>
      <button
        className="btn btn--primary lane-assign__reveal"
        disabled={!valid}
        onClick={() => onReveal(assignA, assignB)}
      >
        Reveal Lanes
      </button>
    </div>
  )
}
