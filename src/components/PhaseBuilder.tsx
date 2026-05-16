import React from 'react'
import type { DraftPhase, Team, DraftAction } from '../types'

interface Props {
  phases: DraftPhase[]
  onChange: (phases: DraftPhase[]) => void
  /** Total slots cannot exceed the hero pool. 0 = unknown (no cap applied). */
  maxPhases?: number
}

const TEAM_LABELS: Record<Team, string> = { A: 'Team A', B: 'Team B' }
const MAX_PICKS_PER_TEAM = 6

export function PhaseBuilder({ phases, onChange, maxPhases = 0 }: Props) {
  const picksA = phases.filter(p => p.action === 'pick' && p.team === 'A').length
  const picksB = phases.filter(p => p.action === 'pick' && p.team === 'B').length
  const picksFull = picksA >= MAX_PICKS_PER_TEAM && picksB >= MAX_PICKS_PER_TEAM
  const totalFull = maxPhases > 0 && phases.length >= maxPhases

  function add(action: DraftAction) {
    if (totalFull) return
    if (action === 'pick') {
      if (picksFull) return
      const team: Team = picksA <= picksB ? 'A' : 'B'
      onChange([...phases, { team, action }])
      return
    }
    onChange([...phases, { team: 'A', action }])
  }

  function remove(i: number) {
    onChange(phases.filter((_, idx) => idx !== i))
  }

  function update(i: number, patch: Partial<DraftPhase>) {
    const target = phases[i]
    const nextTeam = patch.team ?? target.team
    const nextAction = patch.action ?? target.action
    if (nextAction === 'pick') {
      const otherPicksOnTeam = phases.filter((p, idx) => idx !== i && p.action === 'pick' && p.team === nextTeam).length
      if (otherPicksOnTeam >= MAX_PICKS_PER_TEAM) return
    }
    onChange(phases.map((p, idx) => idx === i ? { ...p, ...patch } : p))
  }

  function move(i: number, dir: -1 | 1) {
    const next = [...phases]
    ;[next[i], next[i + dir]] = [next[i + dir], next[i]]
    onChange(next)
  }

  const banCount = phases.filter(p => p.action === 'ban').length
  const pickCount = phases.filter(p => p.action === 'pick').length

  return (
    <div className="phase-builder">
      <div className="phase-builder__header">
        <span className="phase-builder__title">Draft phases</span>
        <span className="phase-builder__counts">
          {banCount} ban{banCount !== 1 ? 's' : ''} · {pickCount} pick{pickCount !== 1 ? 's' : ''}
          {maxPhases > 0 && ` · ${phases.length}/${maxPhases} slots`}
        </span>
      </div>

      <div className="phase-builder__hint">
        Define pick/ban order. Each row = one slot.
      </div>

      <div className="phase-list">
        {phases.map((p, i) => (
          <div key={i} className={`phase-row phase-row--${p.action}`}>
            <span className="phase-row__num">{i + 1}</span>

            <select
              className="phase-row__team"
              value={p.team}
              onChange={e => update(i, { team: e.target.value as Team })}
            >
              <option value="A">Team A</option>
              <option value="B">Team B</option>
            </select>

            <select
              className="phase-row__action"
              value={p.action}
              onChange={e => update(i, { action: e.target.value as DraftAction })}
            >
              <option value="ban">Ban</option>
              <option value="pick">Pick</option>
            </select>

            <div className="phase-row__controls">
              <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} title="Move up">↑</button>
              <button className="icon-btn" disabled={i === phases.length - 1} onClick={() => move(i, 1)} title="Move down">↓</button>
              <button className="icon-btn icon-btn--danger" onClick={() => remove(i)} title="Remove">×</button>
            </div>
          </div>
        ))}

        {phases.length === 0 && (
          <div className="phase-list__empty">No phases yet. Add bans and picks below.</div>
        )}
      </div>

      <div className="phase-builder__actions">
        <button
          className="btn btn--ban"
          onClick={() => add('ban')}
          disabled={totalFull}
          title={totalFull ? `Total slots can't exceed hero pool (${maxPhases})` : undefined}
        >+ Ban</button>
        <button
          className="btn btn--pick"
          onClick={() => add('pick')}
          disabled={picksFull || totalFull}
          title={
            totalFull ? `Total slots can't exceed hero pool (${maxPhases})` :
            picksFull  ? `Max ${MAX_PICKS_PER_TEAM} picks per team` :
            undefined
          }
        >+ Pick</button>
        <button className="btn btn--secondary" onClick={() => {
          // Preset: 2 bans each, then picks 6-6 (Deadlock style)
          const preset: DraftPhase[] = [
            { team: 'A', action: 'ban' }, { team: 'B', action: 'ban' },
            { team: 'A', action: 'ban' }, { team: 'B', action: 'ban' },
            { team: 'A', action: 'pick' }, { team: 'B', action: 'pick' },
            { team: 'B', action: 'pick' }, { team: 'A', action: 'pick' },
            { team: 'A', action: 'pick' }, { team: 'B', action: 'pick' },
            { team: 'B', action: 'pick' }, { team: 'A', action: 'pick' },
            { team: 'A', action: 'pick' }, { team: 'B', action: 'pick' },
            { team: 'B', action: 'pick' }, { team: 'A', action: 'pick' },
          ]
          onChange(preset)
        }}>Preset 6v6</button>
      </div>
    </div>
  )
}
