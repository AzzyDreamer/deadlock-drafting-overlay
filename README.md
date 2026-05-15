# Deadlock Draft Overlay

A real-time draft overlay system for Deadlock tournament broadcasts. Designed to be used with OBS Studio as browser sources.

## Features

- Hero ban/pick draft with configurable phase sequences (BO1/BO3/BO5)
- Live hero cycling animation in empty slots during drafting
- Per-team patron and team logo display
- Pick reveal overlay with animated hero art
- Lane assignment phase after drafting with animated reveal (Yellow / Blue / Green)
- Score overlay centered for full-screen browser sources
- WebSocket-based real-time sync between admin panel and all overlays

## Requirements

- Node.js 18 or later
- A modern browser (OBS built-in browser source is sufficient)

## Setup

Install dependencies:

```
npm install
```

Place hero assets in the `chars/` directory. Each hero should have a subfolder with the following images (filenames are detected automatically by suffix):

- `_card` - portrait card used in pick slots
- `_render` - full render used in the reveal overlay
- `_gloat` - alternate art shown briefly on pick confirmation
- `_critical` - greyscale-friendly art used in ban slots
- `_name` or `_nameImg` - hero name typography image (optional)

Patron assets are loaded from `public/assets/patrons/`.

## Running

Development mode (frontend hot reload + backend):

```
npm run dev
```

Production:

```
npm run build
npm start
```

In development mode, Vite runs the frontend on port 5173 and the Express backend runs on port 3001. In production (`npm start`), Express serves everything on port 3001.

## Pages

| Path | Description |
|------|-------------|
| `/admin` | Admin control panel — configure teams, build draft phases, run the draft, assign lanes, set score |
| `/overlay/board` | Draft board overlay — shows bans and picks in real time |
| `/overlay/score` | Score bar overlay — team names, logos, patron labels, current score |
| `/overlay/reveal` | Pick reveal overlay — full-screen animated reveal of each hero pick or ban |

Development links (Vite on port 5173):

- http://localhost:5173/admin
- http://localhost:5173/overlay/board
- http://localhost:5173/overlay/score
- http://localhost:5173/overlay/reveal

Production links (port 3001):

- http://localhost:3001/admin
- http://localhost:3001/overlay/board
- http://localhost:3001/overlay/score
- http://localhost:3001/overlay/reveal

## OBS Setup

Add each overlay page as a Browser Source in OBS. Set the browser source background to transparent (check "Allow transparency"). Recommended resolutions:

- Board overlay: sized to your draft layout
- Score overlay: full canvas width and height (the bar is centered within the viewport)
- Reveal overlay: 2080x1440 (matches the overlay canvas)

## Architecture

The backend (`server.js`) maintains a single shared draft state and broadcasts it over WebSocket to all connected clients on every change. The admin panel sends commands (start draft, select hero, confirm, undo, reveal lanes, set score, reset). All overlay pages are read-only — they receive state and render it.

Frontend is built with React, TypeScript, and Vite.

---

## Disclaimer

This project is an independent fan-made tool and is not affiliated with, endorsed by, or connected to Valve Corporation or Steam in any way. All game assets, hero artwork, character names, and related imagery are the property of their respective owners. This project is intended for personal and community use only.
