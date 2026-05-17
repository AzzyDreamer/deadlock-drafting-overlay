import React from 'react'
import type { HeroStats } from '../types'

interface Props {
  stats: HeroStats
}

export function HeroStatPopover({ stats }: Props) {
  // Client-side fallback for `presence` so an older server build (which only
  // exposes winrate/pickrate/banrate) still renders the pill.
  const presence = stats.presence ?? (
    stats.pickrate != null && stats.banrate != null
      ? stats.pickrate + stats.banrate
      : stats.pickrate ?? null
  )

  const showWr  = stats.winrate != null
  const showPres = presence != null
  if (!showWr && !showPres) return null

  return (
    <div className="hero-stat-popover">
      {showWr && (
        <span className="hero-stat-popover__pill hero-stat-popover__pill--wr">
          <span className="hero-stat-popover__label">WR</span>
          <span className="hero-stat-popover__value">{Math.round(stats.winrate! * 100)}%</span>
        </span>
      )}
      {showPres && (
        <span className="hero-stat-popover__pill hero-stat-popover__pill--pres">
          <span className="hero-stat-popover__label">PRES</span>
          <span className="hero-stat-popover__value">{Math.round(presence! * 100)}%</span>
        </span>
      )}
    </div>
  )
}
