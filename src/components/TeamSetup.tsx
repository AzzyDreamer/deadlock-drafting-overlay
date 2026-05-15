import React, { useRef } from 'react'
import type { TeamConfig, Patron } from '../types'
import { PATRONS } from '../types'

interface Props {
  patron: Patron
  value: TeamConfig
  onChange: (v: TeamConfig) => void
}

export function TeamSetup({ patron, value, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const p = PATRONS[patron]

  function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onChange({ ...value, logo: reader.result as string })
    reader.readAsDataURL(file)
  }

  return (
    <div className="team-setup" style={{ '--patron-color': p.color } as React.CSSProperties}>
      {/* Patron header */}
      <div className="team-setup__patron">
        <img src={p.icon} className="team-setup__patron-icon" alt={p.label} />
        <span className="team-setup__patron-name" style={{ color: p.color }}>{p.label}</span>
      </div>

      <label className="field-label">Team name</label>
      <input
        className="field-input"
        value={value.name}
        onChange={e => onChange({ ...value, name: e.target.value })}
        placeholder="e.g. Team Spirit"
      />

      <label className="field-label">Team logo</label>
      <div className="logo-row">
        {value.logo
          ? <img src={value.logo} className="logo-preview" alt="logo" />
          : <div className="logo-placeholder">No logo</div>
        }
        <button className="btn btn--secondary" onClick={() => fileRef.current?.click()}>
          Upload
        </button>
        {value.logo && (
          <button className="btn btn--ghost" onClick={() => onChange({ ...value, logo: '' })}>
            Remove
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogo} />
      </div>
    </div>
  )
}
