import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from '../constants/translations';

const STORAGE_KEY = '@malaw_language';

const LanguageContext = createContext({
  lang: 'fr',
  t: translations.fr,
  setLang: () => {},
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('fr');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(value => {
      if (value === 'fr' || value === 'en') setLangState(value);
    });
  }, []);

  const setLang = (newLang) => {
    setLangState(newLang);
    AsyncStorage.setItem(STORAGE_KEY, newLang);
  };

  return (
    <LanguageContext.Provider value={{ lang, t: translations[lang], setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
