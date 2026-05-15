import React, { useEffect, useState } from 'react'
import type { Hero } from '../types'

interface Props {
  hero: Hero
  team: 'A' | 'B'
  teamName: string
  action: 'pick' | 'ban'
}

const REVEAL_DURATION_MS = {
  pick: 3500,
  ban:  4200,
}

export function PickReveal({ hero, team, teamName, action }: Props) {
  const [phase, setPhase] = useState<'in' | 'out'>('in')

  useEffect(() => {
    setPhase('in')
    const timer = setTimeout(() => setPhase('out'), REVEAL_DURATION_MS[action])
    return () => clearTimeout(timer)
  }, [hero, action])

  return (
    <div className={`pick-reveal pick-reveal--${phase} pick-reveal--${action}`}>
      {hero.render && (
        <img
          src={hero.render}
          alt={hero.name}
          className={`pick-reveal__render pick-reveal__render--${action}`}
        />
      )}
      <div className="pick-reveal__info">
        {hero.nameImg ? (
          <img
            src={hero.nameImg}
            alt={hero.name}
            className={`pick-reveal__name-img pick-reveal__name-img--${action}`}
          />
        ) : (
          <span className={`pick-reveal__name-text pick-reveal__name-text--${action}`}>
            {hero.name}
          </span>
        )}
        <span className="pick-reveal__team">{teamName}</span>
        {action === 'ban' && <span className="pick-reveal__banned-label">BANNED</span>}
      </div>
    </div>
  )
}
