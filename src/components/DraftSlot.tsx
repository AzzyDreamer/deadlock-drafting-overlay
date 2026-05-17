import React, { useEffect, useState } from 'react'
import type { DraftEntry, HeroStats } from '../types'
import { HeroStatPopover } from './HeroStatPopover'

interface Props {
  entry: DraftEntry
  isCurrent: boolean
  isPending: boolean
  pendingImg?: string
  teamColor?: string
  isQueued?: boolean
  cycleA?: string
  cycleB?: string
  cycleShowA?: boolean
  contentVisible?: boolean
  stats?: HeroStats
}

const GLOAT_DURATION_MS = 2800
// Popover total visible lifetime — must match the .hero-stat-popover animation
// duration in overlay.css (popover-life keyframes).
const POPOVER_LIFETIME_MS = 8000

export function DraftSlot({ entry, isCurrent, isPending, pendingImg, teamColor, isQueued, cycleA, cycleB, cycleShowA, contentVisible, stats }: Props) {
  const [showGloat, setShowGloat] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [prevConfirmed, setPrevConfirmed] = useState(entry.confirmed)

  useEffect(() => {
    if (!prevConfirmed && entry.confirmed && entry.action === 'pick' && entry.hero) {
      setShowGloat(true)
      setShowStats(true)
      const gloatTimer = setTimeout(() => setShowGloat(false), GLOAT_DURATION_MS)
      const statsTimer = setTimeout(() => setShowStats(false), POPOVER_LIFETIME_MS)
      return () => { clearTimeout(gloatTimer); clearTimeout(statsTimer) }
    }
    setPrevConfirmed(entry.confirmed)
  }, [entry.confirmed])

  const hero = entry.hero
  const action = entry.action

  let imgSrc: string | undefined
  let extraClass = ''

  if (!hero) {
    imgSrc = isPending ? pendingImg : undefined
    extraClass = isPending ? 'draft-slot--pending-select' : ''
  } else if (action === 'ban') {
    imgSrc = hero.critical
    extraClass = 'draft-slot--banned'
  } else if (showGloat) {
    imgSrc = hero.gloat
    extraClass = 'draft-slot--gloat'
  } else {
    imgSrc = hero.card
    extraClass = 'draft-slot--picked'
  }

  const style: React.CSSProperties = {}
  if (teamColor && hero && action !== 'ban') style.borderColor = teamColor
  if (teamColor && isQueued && !hero && action === 'pick') {
    ;(style as any)['--c-slot-accent'] = teamColor
    ;(style as any)['animationName'] = cycleShowA ? 'slot-queued-pulse-a' : 'slot-queued-pulse-b'
  }

  const showCycle = !hero && !isPending && cycleA && cycleB
  const showBanName = !!(hero && action === 'ban')

  return (
    <div className="draft-slot-wrap">
    {showStats && stats && entry.action === 'pick' && <HeroStatPopover stats={stats} />}
    <div
      className={[
        'draft-slot',
        `draft-slot--${action}`,
        isCurrent ? 'draft-slot--current' : '',
        isQueued && !hero ? 'draft-slot--queued' : '',
        hero ? 'draft-slot--filled' : 'draft-slot--empty',
        extraClass,
      ].join(' ')}
      style={style}
    >
      {showCycle && (
        <div className="draft-slot__cycle">
          <img src={cycleA} alt="" className="draft-slot__cycle-img" style={{ opacity: cycleShowA ? 1 : 0 }} />
          <img src={cycleB} alt="" className="draft-slot__cycle-img" style={{ opacity: cycleShowA ? 0 : 1 }} />
        </div>
      )}

      {imgSrc ? (
        <img
          key={`${hero?.id}-${showGloat ? 'gloat' : action === 'ban' ? 'critical' : 'card'}`}
          src={imgSrc}
          alt={hero?.name ?? ''}
          className="draft-slot__img"
          style={contentVisible !== undefined ? { opacity: contentVisible ? 1 : 0, transition: 'opacity 0.45s ease-in-out' } : undefined}
        />
      ) : (
        <div className="draft-slot__placeholder">
          {isCurrent && !showCycle && <span className="draft-slot__cursor" />}
        </div>
      )}

      {showGloat && hero && action === 'pick' && (
        <span
          className={`draft-slot__shine draft-slot__shine--${entry.team === 'B' ? 'b' : 'a'}`}
          aria-hidden="true"
        />
      )}

      {hero && action === 'ban' && <div className="draft-slot__ban-x" />}

      {hero && action !== 'ban' && (
        hero.nameImg
          ? <img
              src={hero.nameImg}
              alt={hero.name}
              className="draft-slot__name-img"
              style={contentVisible !== undefined ? { opacity: contentVisible ? 1 : 0, transition: 'opacity 0.45s ease-in-out' } : undefined}
            />
          : <span
              className="draft-slot__name"
              style={contentVisible !== undefined ? { opacity: contentVisible ? 1 : 0, transition: 'opacity 0.45s ease-in-out' } : undefined}
            >{hero.name}</span>
      )}
    </div>
    {showBanName && <span className="draft-slot__ban-name">{hero!.name}</span>}
    </div>
  )
}
