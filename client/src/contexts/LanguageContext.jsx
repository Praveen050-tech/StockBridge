import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [langCode, setLangCode] = useState(() => {
    return localStorage.getItem('vaaimozhi_lang') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('vaaimozhi_lang', langCode);
  }, [langCode]);

  const t = (key) => {
    return translations[langCode]?.[key] || translations['en'][key] || key;
  };

  const getSpeechLang = () => {
    const map = {
      en: 'en-IN',
      ta: 'ta-IN',
      hi: 'hi-IN',
      te: 'te-IN',
      ml: 'ml-IN',
      kn: 'kn-IN',
      mr: 'mr-IN',
      bn: 'bn-IN',
      gu: 'gu-IN'
    };
    return map[langCode] || 'en-IN';
  };

  return (
    <LanguageContext.Provider value={{ langCode, setLangCode, t, getSpeechLang }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
