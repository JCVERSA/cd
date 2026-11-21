import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { en } from './en'
import { fr } from './fr'

export type Language = 'en' | 'fr'
export type DictKey = keyof typeof en
export type Dict = Record<DictKey, string>

const dictionaries: Record<Language, Dict> = { en, fr }
const STORAGE_KEY = 'droidslate.language'

export type TFunction = (key: DictKey, vars?: Record<string, string | number>) => string

function interpolate(raw: string, vars?: Record<string, string | number>): string {
  if (!vars) return raw
  return raw.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match))
}

function detectLanguage(): Language {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'fr') return saved
    if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('fr')) {
      return 'fr'
    }
  } catch {
    // localStorage can be unavailable (private mode) — fall back to English.
  }
  return 'en'
}

interface I18nValue {
  lang: Language
  setLang: (lang: Language) => void
  t: TFunction
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(detectLanguage)

  const value = useMemo<I18nValue>(() => {
    const setLang = (next: Language) => {
      setLangState(next)
      try {
        window.localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // Ignore quota/private-mode failures — the in-memory switch still applies.
      }
    }
    const dict = dictionaries[lang]
    const t: TFunction = (key, vars) => interpolate(dict[key], vars)
    return { lang, setLang, t }
  }, [lang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}

export function useT(): TFunction {
  return useI18n().t
}
