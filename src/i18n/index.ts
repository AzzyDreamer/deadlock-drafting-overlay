import en from './en'

export type Locale = 'en'

const locales = { en } as const

let current: Locale = 'en'

export function t() {
  return locales[current]
}

export function setLocale(locale: Locale) {
  current = locale
}
