import express from 'express'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { readdir, stat } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = 3001
const CHARS_DIR = join(__dirname, 'chars')
const PATRONS_DIR = join(__dirname, 'patrons')

// ─── Hero discovery ────────────────────────────────────────────────────────────

async function listAudioClips(dir, name, action) {
  const sub = join(dir, 'audio', action)
  if (!existsSync(sub)) return []
  try {
    const files = await readdir(sub)
    return files
      .filter(f => f.toLowerCase().endsWith('.mp3'))
      .sort()
      .map(f => `/assets/chars/${encodeURIComponent(name)}/audio/${action}/${encodeURIComponent(f)}`)
  } catch {
    return []
  }
}

async function discoverHeroes() {
  const entries = await readdir(CHARS_DIR, { withFileTypes: true })
  const heroes = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const name = entry.name
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_')
    const dir = join(CHARS_DIR, name)

    const img = (suffix) => {
      const file = join(dir, `${name}_${suffix}.png`)
      return existsSync(file) ? `/assets/chars/${encodeURIComponent(name)}/${name}_${suffix}.png` : null
    }

    const [selectAudio, unselectAudio] = await Promise.all([
      listAudioClips(dir, name, 'select'),
      listAudioClips(dir, name, 'unselect'),
    ])

    heroes.push({
      id,
      name,
      card:     img('card')     ?? img('Render'),
      render:   img('Render'),
      gloat:    img('Gloat')    ?? img('card'),
      critical: img('Critical') ?? img('card'),
      nameImg:  img('name'),
      selectAudio,
      unselectAudio,
    })
  }

  return heroes.sort((a, b) => a.name.localeCompare(b.name))
}

// ─── Draft state ───────────────────────────────────────────────────────────────

const initialState = () => ({
  status: 'idle',       // idle | drafting | lane_assign | complete
  config: null,
  entries: [],          // { phaseIdx, team, action, hero, confirmed }
  currentPhase: 0,
  pendingHero: null,
  score: { a: 0, b: 0 },
  laneAssignA: null,
  laneAssignB: null,
  audioEnabled: true,
  audioVolume: 0.7,
  heroSfxEnabled: true,
  heroSfxVolume: 0.8,
  matchResult: null,       // MatchResult | null — populated by fetch_match
  matchFetchStatus: 'idle',// 'idle' | 'loading' | 'error'
  matchFetchError: null,   // string | null
})

let state = initialState()

function applyAction(msg) {
  switch (msg.type) {
    case 'start_draft': {
      const prevAudioEnabled = state.audioEnabled
      const prevAudioVolume = state.audioVolume
      const prevSfxEnabled = state.heroSfxEnabled
      const prevSfxVolume = state.heroSfxVolume
      state = initialState()
      state.audioEnabled = prevAudioEnabled
      state.audioVolume = prevAudioVolume
      state.heroSfxEnabled = prevSfxEnabled
      state.heroSfxVolume = prevSfxVolume
      state.status = 'drafting'
      state.config = msg.config
      state.entries = msg.config.phases.map((p, i) => ({
        phaseIdx: i,
        team: p.team,
        action: p.action,
        hero: null,
        confirmed: false,
      }))
      state.currentPhase = 0
      state.pendingHero = null
      break
    }

    case 'select_hero': {
      if (state.status !== 'drafting') break
      state.pendingHero = msg.hero
      break
    }

    case 'confirm': {
      if (!state.pendingHero || state.status !== 'drafting') break
      const entry = state.entries[state.currentPhase]
      if (!entry) break
      entry.hero = state.pendingHero
      entry.confirmed = true
      state.pendingHero = null
      const next = state.entries.findIndex((e, i) => i > state.currentPhase && !e.confirmed)
      if (next === -1) {
        state.status = 'lane_assign'
        state.currentPhase = -1
      } else {
        state.currentPhase = next
      }
      break
    }

    case 'undo': {
      const lastDone = [...state.entries].reverse().find(e => e.confirmed)
      if (!lastDone) break
      lastDone.hero = null
      lastDone.confirmed = false
      state.currentPhase = lastDone.phaseIdx
      state.pendingHero = null
      break
    }

    case 'set_score': {
      state.score = msg.score
      break
    }

    case 'reveal_lanes': {
      if (state.status !== 'lane_assign') break
      state.laneAssignA = msg.assignA
      state.laneAssignB = msg.assignB
      state.status = 'complete'
      break
    }

    case 'reset': {
      const prevAudioEnabled = state.audioEnabled
      const prevAudioVolume = state.audioVolume
      const prevSfxEnabled = state.heroSfxEnabled
      const prevSfxVolume = state.heroSfxVolume
      state = initialState()
      state.audioEnabled = prevAudioEnabled
      state.audioVolume = prevAudioVolume
      state.heroSfxEnabled = prevSfxEnabled
      state.heroSfxVolume = prevSfxVolume
      break
    }

    case 'set_audio_enabled': {
      state.audioEnabled = !!msg.enabled
      break
    }

    case 'set_audio_volume': {
      const v = Number(msg.volume)
      if (Number.isFinite(v)) state.audioVolume = Math.max(0, Math.min(1, v))
      break
    }

    case 'set_hero_sfx_enabled': {
      state.heroSfxEnabled = !!msg.enabled
      break
    }

    case 'set_hero_sfx_volume': {
      const v = Number(msg.volume)
      if (Number.isFinite(v)) state.heroSfxVolume = Math.max(0, Math.min(1, v))
      break
    }

    case 'clear_match_result': {
      state.matchResult = null
      state.matchFetchStatus = 'idle'
      state.matchFetchError = null
      break
    }
  }
}

// ─── Hero stats (Deadlock API proxy + cache) ───────────────────────────────────
// Pulls hero-stats + hero-ban-stats + asset name→id mapping once per hour and
// exposes them keyed by our local hero id (same normalization as discoverHeroes).
// Endpoints + schema: https://api.deadlock-api.com (analytics-hero-stats / hero-ban-stats)

const STATS_REFRESH_MS = 60 * 60 * 1000
const PLAYERS_PER_MATCH = 12

let heroStatsMap = {}
// API numeric hero_id → local hero id (same normalization as discoverHeroes).
// Populated alongside hero stats; consumed by the match-metadata transform so
// that match player rows can carry a `localHeroId` that links back to the
// drafted Hero (and thus to its art assets like gloat/card).
let heroIdToLocal = new Map()

function localIdFromName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_')
}

async function fetchHeroStats() {
  try {
    const [heroesRes, statsRes, bansRes] = await Promise.all([
      fetch('https://assets.deadlock-api.com/v2/heroes'),
      fetch('https://api.deadlock-api.com/v1/analytics/hero-stats'),
      fetch('https://api.deadlock-api.com/v1/analytics/hero-ban-stats'),
    ])
    if (!heroesRes.ok || !statsRes.ok || !bansRes.ok) {
      throw new Error(`upstream non-200: heroes=${heroesRes.status} stats=${statsRes.status} bans=${bansRes.status}`)
    }
    const [heroes, stats, bans] = await Promise.all([
      heroesRes.json(), statsRes.json(), bansRes.json(),
    ])

    const idToLocal = new Map()
    for (const h of heroes) {
      if (h && typeof h.id === 'number' && typeof h.name === 'string') {
        idToLocal.set(h.id, localIdFromName(h.name))
      }
    }
    heroIdToLocal = idToLocal

    // Derive total game count from sum of per-hero pick counts.
    // Each match contributes PLAYERS_PER_MATCH rows across the stats array.
    const totalPickRows = stats.reduce((acc, s) => acc + (s.matches ?? 0), 0)
    const totalGames = totalPickRows / PLAYERS_PER_MATCH

    // Build a sidecar map of bans first so we can compute presence per hero
    // in a single pass below.
    const bansByLocal = new Map()
    for (const b of bans) {
      const localId = idToLocal.get(b.hero_id)
      if (!localId) continue
      bansByLocal.set(localId, b.bans ?? 0)
    }

    const map = {}
    for (const s of stats) {
      const localId = idToLocal.get(s.hero_id)
      if (!localId) continue
      const m = s.matches ?? 0
      const bansForHero = bansByLocal.get(localId) ?? 0
      map[localId] = {
        winrate:  m > 0 ? s.wins / m : null,
        pickrate: totalGames > 0 ? m / totalGames : null,
        banrate:  totalGames > 0 ? bansForHero / totalGames : null,
        // presence = % of matches the hero either got picked OR banned.
        // Standard draft-meta metric; banrate alone is ~0% for most heroes
        // because absolute ban counts are tiny relative to total games.
        presence: totalGames > 0 ? (m + bansForHero) / totalGames : null,
        matches:  m,
      }
    }
    // Heroes that only show up in bans (rarely picked) — keep them with a
    // pickrate-less presence so the popover still has something to show.
    for (const [localId, bansForHero] of bansByLocal) {
      if (map[localId]) continue
      map[localId] = {
        winrate:  null,
        pickrate: null,
        banrate:  totalGames > 0 ? bansForHero / totalGames : null,
        presence: totalGames > 0 ? bansForHero / totalGames : null,
        matches:  0,
      }
    }

    heroStatsMap = map
    console.log(`Hero stats refreshed: ${Object.keys(map).length} heroes (${totalGames.toFixed(0)} games sampled)`)
  } catch (e) {
    console.error('Hero stats fetch failed:', e.message)
  }
}

fetchHeroStats()
setInterval(fetchHeroStats, STATS_REFRESH_MS)

// ─── Match metadata (Deadlock API proxy + cache + transform) ───────────────────
// Pulls /v1/matches/{id}/metadata and reduces the heavyweight protobuf-shaped
// JSON down to a flat scoreboard-friendly MatchResult that the overlay needs.
// We aggressively trim — full response is ~1MB; the trimmed payload is < 5KB.

const MATCH_CACHE_LIMIT = 32
const matchCache = new Map()  // id (string) → transformed MatchResult

function cachePut(key, value) {
  matchCache.set(key, value)
  if (matchCache.size > MATCH_CACHE_LIMIT) {
    // FIFO eviction — oldest insertion order key
    const oldest = matchCache.keys().next().value
    if (oldest !== undefined) matchCache.delete(oldest)
  }
}

function transformMatch(raw) {
  const mi = raw && raw.match_info
  if (!mi) return null
  const players = (mi.players || []).map(p => {
    const stats = Array.isArray(p.stats) ? p.stats : []
    const last  = stats.length ? stats[stats.length - 1] : {}
    return {
      playerSlot:      p.player_slot ?? null,
      accountId:       p.account_id ?? null,
      team:            p.team ?? null,
      heroId:          p.hero_id ?? null,
      localHeroId:     heroIdToLocal.get(p.hero_id) ?? null,
      kills:           p.kills    ?? 0,
      deaths:          p.deaths   ?? 0,
      assists:         p.assists  ?? 0,
      netWorth:        p.net_worth ?? 0,
      lastHits:        p.last_hits ?? 0,
      denies:          p.denies   ?? 0,
      playerDamage:    last.player_damage  ?? 0,
      objectiveDamage: last.boss_damage    ?? 0,   // Deadlock "boss damage" = all NPC objectives
      healing:         last.player_healing ?? 0,
      level:           p.level ?? last.level ?? 0,
      assignedLane:    p.assigned_lane ?? null,
      mvpRank:         p.mvp_rank ?? null,         // 1 | 2 | 3 | null
    }
  })
  return {
    matchId:         String(mi.match_id ?? ''),
    durationS:       mi.duration_s ?? 0,
    winningTeam:     mi.winning_team ?? null,
    matchOutcome:    mi.match_outcome ?? null,
    startTime:       mi.start_time ?? null,
    averageBadgeT0:  mi.average_badge_team0 ?? null,
    averageBadgeT1:  mi.average_badge_team1 ?? null,
    matchMode:       mi.match_mode ?? null,
    gameMode:        mi.game_mode ?? null,
    players,
  }
}

async function fetchMatchMetadata(id) {
  if (matchCache.has(id)) return matchCache.get(id)
  const res = await fetch(`https://api.deadlock-api.com/v1/matches/${id}/metadata`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Upstream ${res.status}: ${body.slice(0, 200)}`)
  }
  const raw = await res.json()
  const transformed = transformMatch(raw)
  if (!transformed) throw new Error('Empty or malformed match metadata')
  cachePut(id, transformed)
  return transformed
}

// Track the most recent fetch token so a slow/old request doesn't overwrite a
// newer one's result if the admin re-typed the id quickly.
let matchFetchToken = 0

async function handleFetchMatch(msg) {
  const id = String(msg.matchId ?? '').replace(/[^0-9]/g, '')
  if (!id) {
    state.matchFetchStatus = 'error'
    state.matchFetchError = 'Invalid match id'
    state.matchResult = null
    broadcast({ type: 'state', state })
    return
  }
  const myToken = ++matchFetchToken
  state.matchFetchStatus = 'loading'
  state.matchFetchError = null
  broadcast({ type: 'state', state })
  try {
    const data = await fetchMatchMetadata(id)
    if (myToken !== matchFetchToken) return  // a newer fetch superseded us
    state.matchResult = data
    state.matchFetchStatus = 'idle'
    state.matchFetchError = null
  } catch (e) {
    if (myToken !== matchFetchToken) return
    state.matchResult = null
    state.matchFetchStatus = 'error'
    state.matchFetchError = String(e.message || e)
  }
  broadcast({ type: 'state', state })
}

// ─── Express + WS ──────────────────────────────────────────────────────────────

const app = express()
app.use((_, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  next()
})
app.use(express.json({ limit: '5mb' }))

// API routes — must be before static catch-all
app.get('/api/heroes', async (_, res) => {
  try {
    res.json(await discoverHeroes())
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.get('/api/state', (_, res) => res.json(state))

app.get('/api/hero-stats', (_, res) => res.json(heroStatsMap))

// Direct REST proxy (mostly for debugging / scripting — UI uses WS fetch_match).
app.get('/api/match/:id', async (req, res) => {
  const id = String(req.params.id || '').replace(/[^0-9]/g, '')
  if (!id) return res.status(400).json({ error: 'Invalid match id' })
  try {
    const data = await fetchMatchMetadata(id)
    res.json(data)
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) })
  }
})

// Static assets
app.use('/assets/chars', express.static(CHARS_DIR))
app.use('/assets/patrons', express.static(PATRONS_DIR))

// Vite build — catch-all last
const distDir = join(__dirname, 'dist')
if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.use((_, res) => res.sendFile(join(distDir, 'index.html')))
}

const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

function broadcast(data) {
  const json = JSON.stringify(data)
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(json)
  }
}

wss.on('connection', (ws) => {
  // Send current state on connect
  ws.send(JSON.stringify({ type: 'state', state }))

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString())
      // fetch_match is async (network call) — its handler owns its own
      // broadcasts (loading → result|error). All other messages go through
      // the synchronous applyAction path.
      if (msg.type === 'fetch_match') {
        handleFetchMatch(msg).catch(e => console.error('fetch_match failed:', e))
        return
      }
      applyAction(msg)
      broadcast({ type: 'state', state })
    } catch (e) {
      console.error('WS message error:', e)
    }
  })
})

server.listen(PORT, () => {
  console.log(`Draft server running at http://localhost:${PORT}`)
  console.log(`  Admin:   http://localhost:${PORT}/admin  (prod) | http://localhost:5173/admin  (dev)`)
  console.log(`  Overlay: http://localhost:${PORT}/overlay (prod) | http://localhost:5173/overlay (dev)`)
})
