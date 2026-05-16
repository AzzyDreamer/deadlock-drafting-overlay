import React, { useEffect, useState } from 'react'
import { TeamSetup } from '../components/TeamSetup'
import { PhaseBuilder } from '../components/PhaseBuilder'
import { HeroGrid } from '../components/HeroGrid'
import { LaneAssign } from '../components/LaneAssign'
import { useSocket } from '../hooks/useSocket'
import { apiUrl } from '../hooks/useApi'
import type { Hero, DraftConfig, DraftPhase, TeamConfig, Patron, LaneColor } from '../types'
import { PATRONS } from '../types'

const defaultTeam = (patron: Patron): TeamConfig => ({ name: '', logo: '', patron })

const defaultPhases = (): DraftPhase[] => [
  { team: 'A', action: 'ban' },  { team: 'B', action: 'ban' },
  { team: 'A', action: 'ban' },  { team: 'B', action: 'ban' },
  { team: 'A', action: 'pick' }, { team: 'B', action: 'pick' },
  { team: 'B', action: 'pick' }, { team: 'A', action: 'pick' },
  { team: 'A', action: 'pick' }, { team: 'B', action: 'pick' },
  { team: 'B', action: 'pick' }, { team: 'A', action: 'pick' },
  { team: 'A', action: 'pick' }, { team: 'B', action: 'pick' },
  { team: 'B', action: 'pick' }, { team: 'A', action: 'pick' },
]

type Tab = 'setup' | 'draft'

export function Admin() {
  const { state, connected, send } = useSocket()
  const [heroes, setHeroes] = useState<Hero[]>([])
  const [tab, setTab] = useState<Tab>('setup')

  // Setup form state
  const [teamA, setTeamA] = useState<TeamConfig>(() => defaultTeam('hidden_king'))
  const [teamB, setTeamB] = useState<TeamConfig>(() => defaultTeam('archmother'))
  const [format, setFormat] = useState<DraftConfig['format']>('bo3')
  const [phases, setPhases] = useState<DraftPhase[]>(defaultPhases)

  useEffect(() => {
    fetch(apiUrl('/api/heroes'))
      .then(r => r.json())
      .then(setHeroes)
      .catch(e => console.error('Failed to load heroes:', e))
  }, [])

  // Switch to draft tab automatically when draft starts or lane assign begins
  useEffect(() => {
    if (state.status === 'drafting' || state.status === 'lane_assign') setTab('draft')
  }, [state.status])

  function startDraft() {
    const config: DraftConfig = {
      teamA,
      teamB,
      format,
      phases,
    }
    send({ type: 'start_draft', config })
    setTab('draft')
  }

  const currentEntry = state.entries[state.currentPhase]
  const currentTeamName = currentEntry
    ? (currentEntry.team === 'A' ? state.config?.teamA.name : state.config?.teamB.name) || `Team ${currentEntry.team}`
    : null

  return (
    <div className="admin">
      <header className="admin-header">
        <span className="admin-header__title">Deadlock Draft — Admin</span>
        <span className={`admin-header__status ${connected ? 'admin-header__status--ok' : 'admin-header__status--off'}`}>
          {connected ? 'Connected' : 'Reconnecting…'}
        </span>
      </header>

      <nav className="admin-tabs">
        <button
          className={`admin-tab ${tab === 'setup' ? 'admin-tab--active' : ''}`}
          onClick={() => setTab('setup')}
        >
          Setup
        </button>
        <button
          className={`admin-tab ${tab === 'draft' ? 'admin-tab--active' : ''}`}
          onClick={() => setTab('draft')}
        >
          Draft {state.status === 'drafting' && <span className="admin-tab__dot" />}
        </button>
      </nav>

      <div className="admin-body">
        {tab === 'setup' && (
          <div className="admin-setup">
            <div className="admin-setup__teams">
              <TeamSetup patron="hidden_king" value={teamA} onChange={setTeamA} />
              <div className="admin-setup__vs">VS</div>
              <TeamSetup patron="archmother" value={teamB} onChange={setTeamB} />
            </div>

            <div className="admin-setup__section">
              <label className="field-label">Match format</label>
              <div className="format-buttons">
                {(['bo1', 'bo3', 'bo5'] as const).map(f => (
                  <button
                    key={f}
                    className={`format-btn ${format === f ? 'format-btn--active' : ''}`}
                    onClick={() => setFormat(f)}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <PhaseBuilder phases={phases} onChange={setPhases} />

            <div className="admin-setup__footer">
              <button
                className="btn btn--primary"
                disabled={!connected || phases.length === 0}
                onClick={startDraft}
              >
                Start Draft
              </button>
            </div>
          </div>
        )}

        {tab === 'draft' && (
          <div className="admin-draft">
            {/* ── Left column ── */}
            <div className="admin-draft__left">
              {/* Score */}
              {state.config && (
                <div className="score-bar">
                  <span className="score-bar__team">{state.config.teamA.name || 'Archmother'}</span>
                  <div className="score-bar__score">
                    <button className="score-btn" onClick={() => send({ type: 'set_score', score: { ...state.score, a: Math.max(0, state.score.a - 1) } })}>−</button>
                    <span className="score-bar__num" style={{ color: 'var(--c-team-a)' }}>{state.score.a}</span>
                    <span className="score-bar__sep">:</span>
                    <span className="score-bar__num" style={{ color: 'var(--c-team-b)' }}>{state.score.b}</span>
                    <button className="score-btn" onClick={() => send({ type: 'set_score', score: { ...state.score, b: Math.max(0, state.score.b - 1) } })}>−</button>
                  </div>
                  <span className="score-bar__team" style={{ textAlign: 'right' }}>{state.config.teamB.name || 'Hidden King'}</span>
                  <button className="score-btn score-btn--a" onClick={() => send({ type: 'set_score', score: { ...state.score, a: state.score.a + 1 } })}>+A</button>
                  <button className="score-btn score-btn--b" onClick={() => send({ type: 'set_score', score: { ...state.score, b: state.score.b + 1 } })}>+B</button>
                </div>
              )}

              {/* Current action */}
              {state.status === 'drafting' && currentEntry && (
                <div className={`current-action current-action--${currentEntry.action} current-action--team${currentEntry.team}`}>
                  <span className="current-action__team">{currentTeamName}</span>
                  <span className="current-action__divider">—</span>
                  <span className="current-action__label">{currentEntry.action === 'ban' ? 'Ban' : 'Pick'}</span>
                  <span className="current-action__phase">({state.currentPhase + 1}/{state.entries.length})</span>
                </div>
              )}
              {state.status === 'complete' && <div className="current-action current-action--complete">Draft complete</div>}
              {state.status === 'idle'     && <div className="current-action current-action--idle">No active draft</div>}

              {/* Phase summary */}
              <div className="draft-summary">
                {state.entries.map((entry, i) => (
                  <div key={i} className={['summary-row', `summary-row--${entry.action}`, i === state.currentPhase ? 'summary-row--current' : '', entry.confirmed ? 'summary-row--done' : ''].join(' ')}>
                    <span className="summary-row__num">{i + 1}</span>
                    <span className="summary-row__team">{entry.team === 'A' ? state.config?.teamA.name || 'A' : state.config?.teamB.name || 'B'}</span>
                    <span className="summary-row__action">{entry.action}</span>
                    {entry.hero
                      ? <><img src={apiUrl(entry.hero.card)} className="summary-row__img" alt="" /><span>{entry.hero.name}</span></>
                      : <span className="summary-row__empty">—</span>
                    }
                  </div>
                ))}
              </div>

              {/* Controls */}
              <div className="draft-controls">
                <button className="btn btn--secondary" onClick={() => send({ type: 'undo' })} disabled={state.status !== 'drafting'}>Undo last</button>
                <button className="btn btn--danger" onClick={() => { send({ type: 'reset' }); setTab('setup') }}>Reset</button>
              </div>
            </div>

            {/* ── Right column ── */}
            <div className="admin-draft__right">
              {/* Pending confirm */}
              {state.pendingHero ? (
                <div className="pending-bar">
                  <img src={apiUrl(state.pendingHero.card)} className="pending-bar__img" alt="" />
                  <span className="pending-bar__name">{state.pendingHero.name}</span>
                  <button className="btn btn--confirm" onClick={() => send({ type: 'confirm' })}>
                    Confirm {currentEntry?.action === 'ban' ? 'Ban' : 'Pick'}
                  </button>
                </div>
              ) : (
                <div className="pending-bar__empty">
                  {state.status === 'drafting' ? 'Select a hero below' : ''}
                </div>
              )}

              {/* Hero grid */}
              {state.status === 'drafting' && (
                <HeroGrid
                  heroes={heroes}
                  entries={state.entries}
                  pendingHero={state.pendingHero}
                  onSelect={hero => send({ type: 'select_hero', hero })}
                />
              )}

              {/* Lane assignment */}
              {state.status === 'lane_assign' && (
                <LaneAssign
                  picksA={state.entries.filter(e => e.team === 'A' && e.action === 'pick' && e.hero)}
                  picksB={state.entries.filter(e => e.team === 'B' && e.action === 'pick' && e.hero)}
                  onReveal={(assignA, assignB) => send({ type: 'reveal_lanes', assignA, assignB })}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
