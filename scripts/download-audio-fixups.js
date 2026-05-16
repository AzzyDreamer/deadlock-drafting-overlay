// One-off targeted downloads after the main script run:
//   * Mina via the corrected `vampirebat` slug
//   * Celeste has an 11th select clip (unselect_08 truly doesn't exist)
//   * Graves's first two select/unselect clips live under `_alt_*` URLs
//
//   node scripts/download-audio-fixups.js

import { mkdir, writeFile, access } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CHARS_DIR = join(__dirname, '..', 'chars')
const BASE_URL  = 'https://deadlock.vlviewer.com/Games/Deadlock/DeadlockJan2026/Audio'
const DELAY_MS  = 250

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fileExists(p) {
  try { await access(p); return true } catch { return false }
}

async function pull(remoteName, hero, action, localName) {
  const dir  = join(CHARS_DIR, hero, 'audio', action)
  const dest = join(dir, localName)
  if (await fileExists(dest)) {
    console.log(`  ⏭  ${hero}/${action}/${localName}  (already on disk)`)
    return
  }
  try {
    const res = await fetch(`${BASE_URL}/${remoteName}`)
    if (res.status === 404) { console.log(`  ·  ${remoteName}  (404)`); await sleep(DELAY_MS); return }
    if (!res.ok)            { console.log(`  !  ${remoteName}  (${res.status})`); await sleep(DELAY_MS); return }
    const buf = Buffer.from(await res.arrayBuffer())
    await mkdir(dir, { recursive: true })
    await writeFile(dest, buf)
    console.log(`  ✔  ${hero}/${action}/${localName}  (${buf.length} B)`)
  } catch (e) {
    console.log(`  !  ${remoteName}  ${e.message}`)
  }
  await sleep(DELAY_MS)
}

async function main() {
  console.log('\n── Mina via vampirebat ──')
  for (const action of ['select', 'unselect']) {
    for (let n = 1; n <= 10; n++) {
      const nn = String(n).padStart(2, '0')
      await pull(`vampirebat_${action}_${nn}.mp3`, 'Mina', action, `Mina_${action}_${nn}.mp3`)
    }
  }

  console.log('\n── Celeste extras ──')
  await pull('unicorn_select_11.mp3', 'Celeste', 'select', 'Celeste_select_11.mp3')

  console.log('\n── Graves alt-mapped to 01/02 ──')
  await pull('necro_select_01_alt_01.mp3',   'Graves', 'select',   'Graves_select_01.mp3')
  await pull('necro_select_02_alt_05.mp3',   'Graves', 'select',   'Graves_select_02.mp3')
  await pull('necro_unselect_01_alt_02.mp3', 'Graves', 'unselect', 'Graves_unselect_01.mp3')
  await pull('necro_unselect_02_alt_02.mp3', 'Graves', 'unselect', 'Graves_unselect_02.mp3')

  console.log('\nDone.')
}

main().catch(e => { console.error(e); process.exit(1) })
