import React, { useEffect, useRef, useState } from 'react'
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
  const audioEnabled = state.audioEnabled ?? true
  const audioVolume = state.audioVolume ?? 0.7
  const sfxEnabled = state.heroSfxEnabled ?? true
  const sfxVolume = state.heroSfxVolume ?? 0.8
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement | null>(null)

  // Local mirrors so the sliders stay responsive during drag.
  // The server state will echo back the same value via WS — we just reflect it.
  const [volumeDraft, setVolumeDraft] = useState(audioVolume)
  useEffect(() => { setVolumeDraft(audioVolume) }, [audioVolume])
  const [sfxVolumeDraft, setSfxVolumeDraft] = useState(sfxVolume)
  useEffect(() => { setSfxVolumeDraft(sfxVolume) }, [sfxVolume])

  // Setup form state
  const [teamA, setTeamA] = useState<TeamConfig>(() => defaultTeam('hidden_king'))
  const [teamB, setTeamB] = useState<TeamConfig>(() => defaultTeam('archmother'))
  const [format, setFormat] = useState<DraftConfig['format']>('bo3')
  const [phases, setPhases] = useState<DraftPhase[]>(defaultPhases)

  // Close the settings modal on Escape
  useEffect(() => {
    if (!settingsOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSettingsOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [settingsOpen])

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

  function revealLanes(assignA: Record<number, LaneColor>, assignB: Record<number, LaneColor>) {
    send({ type: 'reveal_lanes', assignA, assignB })
  }

  function resetDraft() {
    send({ type: 'reset' })
    setTab('setup')
  }

  const currentEntry = state.entries[state.currentPhase]
  const currentTeamName = currentEntry
    ? (currentEntry.team === 'A' ? state.config?.teamA.name : state.config?.teamB.name) || `Team ${currentEntry.team}`
    : null

  return (
    <div className="admin">
      <header className="admin-header">
        <span className="admin-header__title">Deadlock Draft — Admin</span>
        <div className="admin-header__right">
          <span className={`admin-header__status ${connected ? 'admin-header__status--ok' : 'admin-header__status--off'}`}>
            {connected ? 'Connected' : 'Reconnecting…'}
          </span>
          <button
            className={`admin-settings__btn ${settingsOpen ? 'admin-settings__btn--open' : ''}`}
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            title="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
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
                <button className="btn btn--danger" onClick={resetDraft}>Reset</button>
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
                  onReveal={revealLanes}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {settingsOpen && (
        <div className="settings-modal" role="dialog" aria-modal="true" aria-label="Settings">
          <div className="settings-modal__backdrop" onClick={() => setSettingsOpen(false)} />
          <div className="settings-modal__window" ref={settingsRef}>
            <div className="settings-modal__head">
              <span className="settings-modal__title">Settings</span>
              <button
                className="settings-modal__close"
                onClick={() => setSettingsOpen(false)}
                aria-label="Close"
              >×</button>
            </div>
            <div className="settings-modal__body">
              <div className="settings-modal__section">
                <div className="settings-modal__section-title">Audio</div>

                <div className="settings-row">
                  <span className="settings-row__label">Draft soundtrack</span>
                  <span
                    className={`admin-settings__switch ${audioEnabled ? 'admin-settings__switch--on' : ''}`}
                    onClick={() => send({ type: 'set_audio_enabled', enabled: !audioEnabled })}
                    role="switch"
                    aria-checked={audioEnabled}
                  >
                    <span className="admin-settings__switch-knob" />
                  </span>
                </div>

                <div className="settings-row settings-row--stack">
                  <div className="settings-row__head">
                    <span className="settings-row__label">Volume</span>
                    <span className="settings-row__value">{Math.round(volumeDraft * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    className="settings-slider"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volumeDraft}
                    disabled={!audioEnabled}
                    onChange={e => {
                      const v = Number(e.target.value)
                      setVolumeDraft(v)
                      send({ type: 'set_audio_volume', volume: v })
                    }}
                  />
                </div>

                <div className="settings-row">
                  <span className="settings-row__label">Hero pick / ban voices</span>
                  <span
                    className={`admin-settings__switch ${sfxEnabled ? 'admin-settings__switch--on' : ''}`}
                    onClick={() => send({ type: 'set_hero_sfx_enabled', enabled: !sfxEnabled })}
                    role="switch"
                    aria-checked={sfxEnabled}
                  >
                    <span className="admin-settings__switch-knob" />
                  </span>
                </div>

                <div className="settings-row settings-row--stack">
                  <div className="settings-row__head">
                    <span className="settings-row__label">Voice volume</span>
                    <span className="settings-row__value">{Math.round(sfxVolumeDraft * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    className="settings-slider"
                    min={0}
                    max={1}
                    step={0.01}
                    value={sfxVolumeDraft}
                    disabled={!sfxEnabled}
                    onChange={e => {
                      const v = Number(e.target.value)
                      setSfxVolumeDraft(v)
                      send({ type: 'set_hero_sfx_volume', volume: v })
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
