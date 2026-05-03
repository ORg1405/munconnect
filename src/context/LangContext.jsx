import { createContext, useContext, useState } from 'react';
import { en } from '../content/landing.en';
import { ptBR } from '../content/landing.pt-BR';

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    if (typeof window === 'undefined') return 'en';
    const stored = window.localStorage.getItem('munconnect-lang');
    return stored === 'en' || stored === 'pt-BR' ? stored : 'en';
  });

  const setLanguage = (newLang) => {
    setLang(newLang);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('munconnect-lang', newLang);
    }
  };

  const content = lang === 'en' ? en : ptBR;
  return (
    <LangContext.Provider value={{ lang, setLang: setLanguage, content }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
