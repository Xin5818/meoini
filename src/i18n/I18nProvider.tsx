import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  getInitialInterfaceLanguage,
  INTERFACE_LANGUAGE_KEY,
  saveInterfaceLanguage,
  translateMessage,
  translatePlural,
  type InterfaceLanguage,
} from "./messages";

interface I18nContextValue {
  language: InterfaceLanguage;
  setLanguage: (language: InterfaceLanguage) => void;
  t: (message: string, values?: Record<string, string | number>) => string;
  tp: (singular: string, plural: string, count: number, values?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readInitialLanguage(): InterfaceLanguage {
  try {
    return getInitialInterfaceLanguage(
      window.localStorage.getItem(INTERFACE_LANGUAGE_KEY),
      window.navigator.language,
    );
  } catch {
    return getInitialInterfaceLanguage(null, typeof navigator === "undefined" ? undefined : navigator.language);
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<InterfaceLanguage>(readInitialLanguage);
  const setLanguage = (next: InterfaceLanguage) => {
    try {
      saveInterfaceLanguage(window.localStorage, next);
    } catch {
      // The in-memory selection still works when browser storage is unavailable.
    }
    setLanguageState(next);
  };
  const value = useMemo<I18nContextValue>(() => ({
    language,
    setLanguage,
    t: (message, values) => translateMessage(language, message, values),
    tp: (singular, plural, count, values) => translatePlural(language, singular, plural, count, values),
  }), [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used within I18nProvider");
  return context;
}

