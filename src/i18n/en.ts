const en = {
  // Admin panel
  admin: {
    title: 'Deadlock Draft — Admin',
    tabs: {
      setup: 'Setup',
      draft: 'Draft',
    },
    setup: {
      teamA: 'Team A',
      teamB: 'Team B',
      teamName: 'Team name',
      uploadLogo: 'Upload logo',
      format: 'Match format',
      score: 'Score',
      phases: 'Draft phases',
      addBan: '+ Ban',
      addPick: '+ Pick',
      removePhase: 'Remove',
      startDraft: 'Start Draft',
      resetDraft: 'Reset',
      phasesHint: 'Define pick/ban order. Each row = one slot.',
    },
    draft: {
      heroPool: 'Hero Pool',
      search: 'Search heroes…',
      selected: 'Selected',
      confirm: 'Confirm',
      undo: 'Undo last',
      noPending: 'Click a hero to select',
      currentAction: (action: string, team: string) => `${team} — ${action}`,
      complete: 'Draft complete',
    },
  },
  // Overlay
  overlay: {
    bans: 'Bans',
    picks: 'Picks',
    vs: 'vs',
  },
  // Shared
  actions: {
    ban: 'Ban',
    pick: 'Pick',
  },
  formats: {
    bo1: 'Best of 1',
    bo3: 'Best of 3',
    bo5: 'Best of 5',
  },
}

export type Translations = typeof en
export default en
