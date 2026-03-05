import React, { createContext, useContext, useMemo } from "react"
import en from "./en"
import de from "./de"
import es from "./es"
import fr from "./fr"
import ja from "./ja"
import pt from "./pt"
import ro from "./ro"

// All translation keys derive from the English file
export type TranslationKey = keyof typeof en
type Translations = Record<TranslationKey, string>

const translationMap: Record<string, Translations> = { en, de, es, fr, ja, pt, ro }

interface I18nContextType {
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
  language: string
}

const I18nContext = createContext<I18nContextType>({
  t: (key, vars?) => {
    let str = en[key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(`{${k}}`, String(v))
      }
    }
    return str
  },
  language: "en",
})

export const useI18n = () => useContext(I18nContext)

interface I18nProviderProps {
  children: React.ReactNode
  language: string
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children, language }) => {
  const value = useMemo<I18nContextType>(() => {
    const dict = translationMap[language] || translationMap.en

    const t = (key: TranslationKey, vars?: Record<string, string | number>): string => {
      let str = dict[key] ?? translationMap.en[key] ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(`{${k}}`, String(v))
        }
      }
      return str
    }

    return { t, language }
  }, [language])

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  )
}
