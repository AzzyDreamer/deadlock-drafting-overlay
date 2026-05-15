import React, { useState, useMemo } from 'react'
import type { Hero, DraftEntry } from '../types'
import { apiUrl } from '../hooks/useApi'

interface Props {
  heroes: Hero[]
  entries: DraftEntry[]
  pendingHero: Hero | null
  onSelect: (hero: Hero) => void
}

export function HeroGrid({ heroes, entries, pendingHero, onSelect }: Props) {
  const [search, setSearch] = useState('')

  const usedIds = useMemo(
    () => new Set(entries.filter(e => e.confirmed && e.hero).map(e => e.hero!.id)),
    [entries]
  )

  const filtered = useMemo(
    () => heroes.filter(h => h.name.toLowerCase().includes(search.toLowerCase())),
    [heroes, search]
  )

  return (
    <div className="hgrid-wrapper">
      <input
        className="hgrid-search"
        placeholder="Search heroes…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {heroes.length === 0 && (
        <div className="hgrid-empty">Loading heroes…</div>
      )}

      <div className="hgrid">
        {filtered.map(hero => {
          const used    = usedIds.has(hero.id)
          const pending = pendingHero?.id === hero.id
          return (
            <button
              key={hero.id}
              className={[
                'hgrid-card',
                used    ? 'hgrid-card--used'    : '',
                pending ? 'hgrid-card--pending' : '',
              ].join(' ')}
              onClick={() => onSelect(hero)}
              disabled={used}
              title={hero.name}
            >
              <img
                src={apiUrl(hero.card)}
                alt={hero.name}
                className="hgrid-card__img"
              />
              <span className="hgrid-card__name">{hero.name}</span>
              {pending && <span className="hgrid-card__check">✓</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
