import React from 'react'
import { useSocket } from '../hooks/useSocket'
import { useTransparentBg } from '../hooks/useTransparentBg'
import { PATRONS } from '../types'

export function OverlayScore() {
  useTransparentBg()
  const { state } = useSocket()
  const { config, score } = state

  if (!config) return <div className="obs-score-root" />

  const pA = PATRONS[config.teamA.patron]
  const pB = PATRONS[config.teamB.patron]

  return (
    <div className="obs-score-viewport">
      <div className="obs-score-root">
        {/* Team A / Archmother — logo left, patron icon right */}
        <div className="obs-team obs-team--a">
          {config.teamA.logo && <img src={config.teamA.logo} className="obs-team__logo" alt="" />}
          <div className="obs-team__names">
            <span className="obs-team__name">{config.teamA.name || pA.label}</span>
            <span className="obs-team__patron-label" style={{ color: pA.color }}>
              the<br />{pA.label.replace(/^The /, '').toLowerCase()}
            </span>
          </div>
        </div>

        <div className="obs-score">
          <span className="obs-score__num obs-score__num--a">{score.a}</span>
          <span className="obs-score__format">{config.format.toUpperCase()}</span>
          <span className="obs-score__num obs-score__num--b">{score.b}</span>
        </div>

        {/* Team B / Hidden King — patron icon left, team logo right */}
        <div className="obs-team obs-team--b">
          <div className="obs-team__names">
            <span className="obs-team__name">{config.teamB.name || pB.label}</span>
            <span className="obs-team__patron-label" style={{ color: pB.color }}>
              the<br />{pB.label.replace(/^The /, '').toLowerCase()}
            </span>
          </div>
          {config.teamB.logo && <img src={config.teamB.logo} className="obs-team__logo" alt="" />}
        </div>
      </div>
    </div>
  )
}
