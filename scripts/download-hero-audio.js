// Downloads <hero>_select_<NN>.mp3 and <hero>_unselect_<NN>.mp3 from the
// public Deadlock viewer, placing each file inside the matching chars/<Hero>/
// folder. 404s are tracked and listed at the end.
//
//   node scripts/download-hero-audio.js
//
// Safe to re-run — existing files are skipped.

import { mkdir, writeFile, access, readdir, rename } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CHARS_DIR = join(__dirname, '..', 'chars')
const BASE_URL  = 'https://deadlock.vlviewer.com/Games/Deadlock/DeadlockJan2026/Audio'
const DELAY_MS  = 250          // pause between HTTP requests
const MAX_NUM   = 10           // 01 .. 10

// chars/<FolderName> → URL slug. Anything not listed falls back to the
// folder name, lowercased + non-alphanumerics stripped (e.g. "Lash" → "lash").
const URL_SLUG_OVERRIDES = {
  'abrams':       'atlas',
  'apollo':       'fencer',
  'billy':        'punkgoat',
  'celeste':      'unicorn',
  'calico':       'nano',
  'graves':       'necro',
  'grey talon':   'orion',
  'holliday':     'astro',
  'infernus':     'inferno',
  'ivy':          'tengu',
  'lady geist':   'ghost',
  'mcginnis':     'forge',
  'mina':         'vampirebat',
  'mo & krill':   'krill',
  'paige':        'bookworm',
  'paradox':      'chrono',
  'pocket':       'synth',
  'rem':          'familiar',
  'seven':        'gigawatt',
  'silver':       'werewolf',
  'sinclair':     'magician_hs',
  'venator':      'priest',
  'victor':       'frank',
  'vindicta':     'hornet',
  'vyper':        'viper',
}

function slugFor(heroFolder) {
  const key = heroFolder.toLowerCase()
  if (URL_SLUG_OVERRIDES[key]) return URL_SLUG_OVERRIDES[key]
  return key.replace(/[^a-z0-9]/g, '')
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fileExists(p) {
  try { await access(p); return true } catch { return false }
}

async function fetchOne(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' })
    if (res.status === 404) return { kind: 'missing' }
    if (!res.ok) return { kind: 'error', status: res.status }
    const buf = Buffer.from(await res.arrayBuffer())
    return { kind: 'ok', bytes: buf, size: buf.length }
  } catch (e) {
    return { kind: 'error', error: String(e?.message ?? e) }
  }
}

async function migrateLegacyFlat(heroDir, hero) {
  // Move any pre-existing flat-layout files into chars/<hero>/audio/<action>/.
  let moved = 0
  for (const action of ['select', 'unselect']) {
    for (let n = 1; n <= MAX_NUM; n++) {
      const nn = String(n).padStart(2, '0')
      const fname = `${hero}_${action}_${nn}.mp3`
      const oldPath = join(heroDir, fname)
      const newDir  = join(heroDir, 'audio', action)
      const newPath = join(newDir, fname)
      if (!(await fileExists(oldPath))) continue
      if (await fileExists(newPath)) continue
      await mkdir(newDir, { recursive: true })
      await rename(oldPath, newPath)
      moved++
    }
  }
  return moved
}

async function main() {
  await mkdir(CHARS_DIR, { recursive: true })
  const entries = await readdir(CHARS_DIR, { withFileTypes: true })
  const heroes = entries.filter(e => e.isDirectory()).map(e => e.name).sort()

  const stats = { downloaded: 0, skipped: 0, missing: 0, errors: 0, migrated: 0 }
  const missingList = []
  const errorList = []

  for (const hero of heroes) {
    const heroDir = join(CHARS_DIR, hero)
    const urlSlug = slugFor(hero)

    const moved = await migrateLegacyFlat(heroDir, hero)
    stats.migrated += moved

    console.log(`\n── ${hero}  →  ${urlSlug} ──${moved ? `  (migrated ${moved})` : ''}`)

    for (const action of ['select', 'unselect']) {
      const actionDir = join(heroDir, 'audio', action)

      for (let n = 1; n <= MAX_NUM; n++) {
        const nn = String(n).padStart(2, '0')
        const remoteName = `${urlSlug}_${action}_${nn}.mp3`
        const localName  = `${hero}_${action}_${nn}.mp3`
        const url  = `${BASE_URL}/${remoteName}`
        const dest = join(actionDir, localName)

        if (await fileExists(dest)) {
          console.log(`  ⏭  ${action}/${localName}  (already on disk)`)
          stats.skipped++
          continue
        }

        const result = await fetchOne(url)

        if (result.kind === 'ok') {
          await mkdir(actionDir, { recursive: true })
          await writeFile(dest, result.bytes)
          console.log(`  ✔  ${action}/${localName}  (${result.size} B)`)
          stats.downloaded++
        } else if (result.kind === 'missing') {
          console.log(`  ·  ${remoteName}  (404)`)
          stats.missing++
          missingList.push(remoteName)
        } else {
          console.log(`  !  ${remoteName}  (${result.status ?? '-'} ${result.error ?? ''})`)
          stats.errors++
          errorList.push(`${remoteName}  ${result.status ?? ''} ${result.error ?? ''}`.trim())
        }

        await sleep(DELAY_MS)
      }
    }
  }

  console.log('\n──────────── Summary ────────────')
  console.log(`Downloaded : ${stats.downloaded}`)
  console.log(`Already had: ${stats.skipped}`)
  console.log(`Migrated   : ${stats.migrated}`)
  console.log(`Missing 404: ${stats.missing}`)
  console.log(`Errors     : ${stats.errors}`)

  if (missingList.length) {
    console.log('\n── 404s ──')
    for (const m of missingList) console.log(`  ${m}`)
  }
  if (errorList.length) {
    console.log('\n── Errors ──')
    for (const e of errorList) console.log(`  ${e}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
