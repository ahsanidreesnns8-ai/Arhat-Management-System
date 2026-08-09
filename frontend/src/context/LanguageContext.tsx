import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { translations, type Lang, type TranslationKey } from '../i18n/translations'

interface LanguageContextType {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: TranslationKey) => string
  isUrdu: boolean
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem('rehmani_lang')
    return stored === 'ur' ? 'ur' : 'en'
  })

  const setLang = (next: Lang) => {
    setLangState(next)
    localStorage.setItem('rehmani_lang', next)
  }

  useEffect(() => {
    const root = document.documentElement
    root.lang = lang === 'ur' ? 'ur' : 'en'
    root.dir = lang === 'ur' ? 'rtl' : 'ltr'
    root.classList.toggle('lang-ur', lang === 'ur')
  }, [lang])

  const t = (key: TranslationKey) => translations[lang][key] || translations.en[key]

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, isUrdu: lang === 'ur' }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
