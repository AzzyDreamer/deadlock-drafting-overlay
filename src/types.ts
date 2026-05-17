export interface Hero {
  id: string
  name: string
  card: string
  render: string | null
  gloat: string
  critical: string
  nameImg: string | null
  selectAudio: string[]
  unselectAudio: string[]
}

export interface HeroStats {
  winrate:  number | null
  pickrate: number | null
  banrate:  number | null
  presence: number | null
  matches:  number
}

export type HeroStatsMap = Record<string, HeroStats>

export type Team = 'A' | 'B'
export type DraftAction = 'ban' | 'pick'

export interface DraftPhase {
  team: Team
  action: DraftAction
}

export type Patron = 'archmother' | 'hidden_king'

export const PATRONS = {
  archmother: {
    label:   'The Archmother',
    color:   '#3874ae',
    icon:    '/assets/patrons/The Archmother/Archmother.png',
    nameImg: '/assets/patrons/The Archmother/Archmother_name.png',
    art:     '/assets/patrons/The Archmother/Archmother_art.png',
  },
  hidden_king: {
    label:   'The Hidden King',
    color:   '#ffac11',
    icon:    '/assets/patrons/The Hidden King/Hidden_King.png',
    nameImg: '/assets/patrons/The Hidden King/Hidden_King_name.png',
    art:     '/assets/patrons/The Hidden King/Hidden_king_art.png',
  },
} as const

export interface TeamConfig {
  name: string
  logo: string    // base64 data URL or ''
  patron: Patron  // A = hidden_king, B = archmother (fixed)
}

export interface DraftConfig {
  teamA: TeamConfig
  teamB: TeamConfig
  format: 'bo1' | 'bo3' | 'bo5'
  phases: DraftPhase[]
}

export interface DraftEntry {
  phaseIdx: number
  team: Team
  action: DraftAction
  hero: Hero | null
  confirmed: boolean
}

export type LaneColor = 'yellow' | 'blue' | 'green'
export const LANES: { id: LaneColor; color: string; label: string }[] = [
  { id: 'yellow', color: '#fada3f', label: 'Yellow' },
  { id: 'blue',   color: '#2fc8e6', label: 'Blue'   },
  { id: 'green',  color: '#6bb248', label: 'Green'  },
]

export interface MatchPlayer {
  playerSlot:      number | null
  accountId:       number | null
  team:            number | null   // 0 = Amber, 1 = Sapphire
  heroId:          number | null
  localHeroId:     string | null   // matches Hero.id, null if mapping unknown
  kills:           number
  deaths:          number
  assists:         number
  netWorth:        number
  lastHits:        number
  denies:          number
  playerDamage:    number
  objectiveDamage: number
  healing:         number
  level:           number
  assignedLane:    number | null
  mvpRank:         number | null   // 1 | 2 | 3 | null
}

export interface MatchResult {
  matchId:         string
  durationS:       number
  winningTeam:     number | null   // 0 | 1 | null
  matchOutcome:    number | null
  startTime:       number | null
  averageBadgeT0:  number | null
  averageBadgeT1:  number | null
  matchMode:       number | null
  gameMode:        number | null
  players:         MatchPlayer[]
}

export type MatchFetchStatus = 'idle' | 'loading' | 'error'

// Result of comparing a fetched match against the current draft. Lets us catch
// "wrong match id pasted" mistakes and detect when team 0/1 are inverted
// relative to the drafted side mapping.
export interface MatchAlignment {
  matched:  number          // # of players whose played hero matches the draft pick on their corresponding side
  expected: number          // total # of drafted picks (max ~12)
  aligned:  boolean         // matched === expected && expected > 0
  swapped:  boolean         // best alignment requires mapping team 0 → draft B (and vice versa)
  scorable: boolean         // there's enough draft data to even attempt a check
}

export function computeMatchAlignment(
  match:   MatchResult | null,
  entries: DraftEntry[],
): MatchAlignment | null {
  if (!match) return null
  const picksA = new Set(
    entries.filter(e => e.team === 'A' && e.action === 'pick' && e.hero).map(e => e.hero!.id),
  )
  const picksB = new Set(
    entries.filter(e => e.team === 'B' && e.action === 'pick' && e.hero).map(e => e.hero!.id),
  )
  const expected = picksA.size + picksB.size
  if (expected === 0) {
    return { matched: 0, expected: 0, aligned: false, swapped: false, scorable: false }
  }
  const team0 = match.players.filter(p => p.team === 0).map(p => p.localHeroId).filter(Boolean) as string[]
  const team1 = match.players.filter(p => p.team === 1).map(p => p.localHeroId).filter(Boolean) as string[]
  const direct  = team0.filter(id => picksA.has(id)).length + team1.filter(id => picksB.has(id)).length
  const swapped = team0.filter(id => picksB.has(id)).length + team1.filter(id => picksA.has(id)).length
  const isSwap = swapped > direct
  const matched = Math.max(direct, swapped)
  return {
    matched,
    expected,
    aligned: matched === expected,
    swapped: isSwap,
    scorable: true,
  }
}

export interface DraftState {
  status: 'idle' | 'drafting' | 'lane_assign' | 'complete'
  config: DraftConfig | null
  entries: DraftEntry[]
  currentPhase: number
  pendingHero: Hero | null
  score: { a: number; b: number }
  laneAssignA: Record<number, LaneColor> | null
  laneAssignB: Record<number, LaneColor> | null
  audioEnabled: boolean
  audioVolume: number
  heroSfxEnabled: boolean
  heroSfxVolume: number
  matchResult: MatchResult | null
  matchFetchStatus: MatchFetchStatus
  matchFetchError: string | null
}

// WebSocket messages server → client
export interface StateMessage {
  type: 'state'
  state: DraftState
}

// WebSocket messages client → server
export type ClientMessage =
  | { type: 'start_draft'; config: DraftConfig }
  | { type: 'select_hero'; hero: Hero }
  | { type: 'confirm' }
  | { type: 'undo' }
  | { type: 'set_score'; score: { a: number; b: number } }
  | { type: 'reveal_lanes'; assignA: Record<number, LaneColor>; assignB: Record<number, LaneColor> }
  | { type: 'reset' }
  | { type: 'set_audio_enabled'; enabled: boolean }
  | { type: 'set_audio_volume'; volume: number }
  | { type: 'set_hero_sfx_enabled'; enabled: boolean }
  | { type: 'set_hero_sfx_volume'; volume: number }
  | { type: 'fetch_match'; matchId: string }
  | { type: 'clear_match_result' }
