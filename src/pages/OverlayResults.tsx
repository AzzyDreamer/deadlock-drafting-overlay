import React from 'react'
import { useSocket } from '../hooks/useSocket'
import { useTransparentBg } from '../hooks/useTransparentBg'
import { PATRONS, LANES, computeMatchAlignment } from '../types'
import type { DraftEntry, LaneColor, MatchPlayer, MatchAlignment } from '../types'

// Stats stacked under each pick card when match data is loaded.
type StatKey = 'netWorth' | 'kills' | 'deaths' | 'assists' | 'playerDamage' | 'objectiveDamage'
interface StatRowDef {
  key:    StatKey
  label:  string
  fmt:    (v: number) => string
  better: 'higher' | 'lower'
}
const fmtThousands = (v: number) =>
  v >= 10000 ? `${Math.round(v / 1000)}k` :
  v >= 1000  ? `${(v / 1000).toFixed(1)}k` :
  String(v)
const STAT_ROWS: StatRowDef[] = [
  { key: 'netWorth',        label: 'Souls',   fmt: fmtThousands, better: 'higher' },
  { key: 'kills',           label: 'Kills',   fmt: String,       better: 'higher' },
  { key: 'deaths',          label: 'Deaths',  fmt: String,       better: 'lower'  },
  { key: 'assists',         label: 'Assists', fmt: String,       better: 'higher' },
  { key: 'playerDamage',    label: 'Dmg',     fmt: fmtThousands, better: 'higher' },
  { key: 'objectiveDamage', label: 'Obj',     fmt: fmtThousands, better: 'higher' },
]

// "Best in team" set per stat, keyed by localHeroId (since picks ↔ matchPlayers
// align on that id). Lowest deaths counts as best.
type LeaderMap = Map<StatKey, Set<string>>
function computeLeaders(players: MatchPlayer[]): LeaderMap {
  const out: LeaderMap = new Map()
  if (players.length === 0) return out
  for (const def of STAT_ROWS) {
    const values = players.map(p => p[def.key] as number)
    const target = def.better === 'higher' ? Math.max(...values) : Math.min(...values)
    // Suppress highlight if the entire row is zero (no signal).
    if (target === 0 && def.better === 'higher') continue
    const set = new Set<string>()
    players.forEach((p, i) => { if (values[i] === target && p.localHeroId) set.add(p.localHeroId) })
    out.set(def.key, set)
  }
  return out
}

function laneOrder(assign: Record<number, LaneColor> | null) {
  return (e: DraftEntry) => assign ? LANES.findIndex(l => l.id === assign[e.phaseIdx]) : -1
}

function laneColorFor(phaseIdx: number, assign: Record<number, LaneColor> | null) {
  if (!assign || !assign[phaseIdx]) return undefined
  return LANES.find(l => l.id === assign[phaseIdx])?.color
}

export function OverlayResults() {
  useTransparentBg()
  const { state } = useSocket()
  const { status, config, entries, score, laneAssignA, laneAssignB } = state

  if (status !== 'complete' || !config) return <div className="obs-results-root" />

  const pA = PATRONS[config.teamA.patron]
  const pB = PATRONS[config.teamB.patron]

  const bansA  = entries.filter(e => e.team === 'A' && e.action === 'ban'  && e.hero)
  const bansB  = entries.filter(e => e.team === 'B' && e.action === 'ban'  && e.hero)
  const picksARaw = entries.filter(e => e.team === 'A' && e.action === 'pick' && e.hero)
  const picksBRaw = entries.filter(e => e.team === 'B' && e.action === 'pick' && e.hero)

  const picksA = laneAssignA
    ? [...picksARaw].sort((a, b) => laneOrder(laneAssignA)(a) - laneOrder(laneAssignA)(b))
    : picksARaw
  const picksB = laneAssignB
    ? [...picksBRaw].sort((a, b) => laneOrder(laneAssignB)(a) - laneOrder(laneAssignB)(b))
    : picksBRaw

  const winner: 'A' | 'B' | null =
    score.a > score.b ? 'A' :
    score.b > score.a ? 'B' :
    null

  // ── Match data wiring ─────────────────────────────────────────────────────
  // Only attach stats / gloat-art swap if the loaded match actually aligns
  // with the draft. A `matched === 0` (hard mismatch) banner is shown and
  // the stats are not applied to the picks.
  const matchResult = state.matchResult
  const alignment: MatchAlignment | null = matchResult
    ? computeMatchAlignment(matchResult, entries)
    : null
  const hardMismatch = alignment?.scorable === true && alignment.matched === 0
  const partialMismatch =
    alignment?.scorable === true && !alignment.aligned && alignment.matched > 0

  // Look up MatchPlayer by drafted hero id. Bans aren't played, so they
  // never have entries here.
  const playerByHeroId = new Map<string, MatchPlayer>()
  if (matchResult && !hardMismatch) {
    for (const p of matchResult.players) {
      if (p.localHeroId) playerByHeroId.set(p.localHeroId, p)
    }
  }
  const playersA = picksA.map(e => e.hero ? playerByHeroId.get(e.hero.id) ?? null : null)
  const playersB = picksB.map(e => e.hero ? playerByHeroId.get(e.hero.id) ?? null : null)
  const leadersA = computeLeaders(playersA.filter(Boolean) as MatchPlayer[])
  const leadersB = computeLeaders(playersB.filter(Boolean) as MatchPlayer[])

  return (
    <div className="obs-results-viewport">
      <div className="obs-results-root">
        <div className="obs-results-header">
          <span className="obs-results-header__label">Match Results</span>
          <span className="obs-results-header__format">{config.format.toUpperCase()}</span>
        </div>

        {/* Bans strip — moved up to free space below picks for stats. */}
        {(bansA.length > 0 || bansB.length > 0) && (
          <div className="obs-results-bans">
            <div className="obs-results-bans__side obs-results-bans__side--a">
              {bansA.map(e => e.hero && (
                <div key={e.phaseIdx} className="obs-results-card obs-results-card--ban">
                  <img src={e.hero.critical} alt={e.hero.name} className="obs-results-card__img" />
                  <div className="obs-results-card__ban-x" />
                </div>
              ))}
            </div>
            <div className="obs-results-bans__label">Bans</div>
            <div className="obs-results-bans__side obs-results-bans__side--b">
              {bansB.map(e => e.hero && (
                <div key={e.phaseIdx} className="obs-results-card obs-results-card--ban">
                  <img src={e.hero.critical} alt={e.hero.name} className="obs-results-card__img" />
                  <div className="obs-results-card__ban-x" />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="obs-results-score">
          <div className={`obs-results-team obs-results-team--a${winner === 'A' ? ' obs-results-team--winner' : ''}`}>
            {config.teamA.logo && <img src={config.teamA.logo} className="obs-results-team__logo" alt="" />}
            <div className="obs-results-team__meta">
              <span className="obs-results-team__name">{config.teamA.name || pA.label}</span>
              <span className="obs-results-team__patron" style={{ color: pA.color }}>
                the {pA.label.replace(/^The /, '').toLowerCase()}
              </span>
              {winner === 'A' && <span className="obs-results-team__winner-label">Winner</span>}
            </div>
          </div>

          <div className="obs-results-score__center">
            <span className="obs-results-score__num obs-results-score__num--a" style={{ color: pA.color }}>{score.a}</span>
            <span className="obs-results-score__dash">—</span>
            <span className="obs-results-score__num obs-results-score__num--b" style={{ color: pB.color }}>{score.b}</span>
          </div>

          <div className={`obs-results-team obs-results-team--b${winner === 'B' ? ' obs-results-team--winner' : ''}`}>
            <div className="obs-results-team__meta">
              <span className="obs-results-team__name">{config.teamB.name || pB.label}</span>
              <span className="obs-results-team__patron" style={{ color: pB.color }}>
                the {pB.label.replace(/^The /, '').toLowerCase()}
              </span>
              {winner === 'B' && <span className="obs-results-team__winner-label">Winner</span>}
            </div>
            {config.teamB.logo && <img src={config.teamB.logo} className="obs-results-team__logo" alt="" />}
          </div>
        </div>

        {hardMismatch && matchResult && (
          <div className="obs-results-match-mismatch">
            Match #{matchResult.matchId} doesn't match the drafted heroes — ignoring stats.
          </div>
        )}
        {partialMismatch && alignment && (
          <div className="obs-results-match__warn">
            Partial match: {alignment.matched}/{alignment.expected} drafted heroes appear in this match
          </div>
        )}

        <div className="obs-results-picks">
          <div className="obs-results-picks__side obs-results-picks__side--a">
            {picksA.map((e, i) => (
              <PickStack
                key={e.phaseIdx}
                entry={e}
                player={playersA[i]}
                leaders={leadersA}
                laneColor={laneColorFor(e.phaseIdx, laneAssignA)}
              />
            ))}
          </div>
          <div className="obs-results-picks__label">Picks</div>
          <div className="obs-results-picks__side obs-results-picks__side--b">
            {picksB.map((e, i) => (
              <PickStack
                key={e.phaseIdx}
                entry={e}
                player={playersB[i]}
                leaders={leadersB}
                laneColor={laneColorFor(e.phaseIdx, laneAssignB)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── PickStack: hero card + (optional) per-player stats column ────────────────

interface PickStackProps {
  entry:      DraftEntry
  player:     MatchPlayer | null
  leaders:    LeaderMap
  laneColor?: string
}

function PickStack({ entry, player, leaders, laneColor }: PickStackProps) {
  const hero = entry.hero
  if (!hero) return null
  const mvp = player?.mvpRank ?? null

  // MVP rank 1 swaps the card art to the hero's gloat pose.
  const imgSrc = mvp === 1 ? hero.gloat : hero.card

  return (
    <div className="obs-results-pickstack">
      <div className={`obs-results-card obs-results-card--pick${mvp ? ` obs-results-card--mvp${mvp}` : ''}`}>
        <img src={imgSrc} alt={hero.name} className="obs-results-card__img" />
        {hero.nameImg
          ? <img src={hero.nameImg} alt={hero.name} className="obs-results-card__name-img" />
          : <span className="obs-results-card__name">{hero.name}</span>
        }
        {laneColor && <span className="obs-results-card__lane-bar" style={{ background: laneColor }} />}
        {mvp && (
          <span className={`obs-results-card__mvp-badge obs-results-card__mvp-badge--rank${mvp}`}>
            {mvp === 1 ? 'MVP' : `#${mvp}`}
          </span>
        )}
      </div>

      {player && (
        <div className="obs-results-statgrid">
          {STAT_ROWS.map(def => {
            const v = player[def.key] as number
            const isLeader = !!(player.localHeroId && leaders.get(def.key)?.has(player.localHeroId))
            return (
              <div
                key={def.key}
                className={`obs-results-statgrid__row${isLeader ? ' obs-results-statgrid__row--leader' : ''}`}
              >
                <span className="obs-results-statgrid__label">{def.label}</span>
                <span className="obs-results-statgrid__value">{def.fmt(v)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
