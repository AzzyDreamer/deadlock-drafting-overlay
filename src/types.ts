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
