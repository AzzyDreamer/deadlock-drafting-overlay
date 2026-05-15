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

    heroes.push({
      id,
      name,
      card:     img('card')     ?? img('Render'),
      render:   img('Render'),
      gloat:    img('Gloat')    ?? img('card'),
      critical: img('Critical') ?? img('card'),
      nameImg:  img('name'),
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
})

let state = initialState()

function applyAction(msg) {
  switch (msg.type) {
    case 'start_draft': {
      state = initialState()
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
      state = initialState()
      break
    }
  }
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
