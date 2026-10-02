import React, { useState, useRef, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext.jsx';

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
];

export default function LanguageSwitcher({ variant = 'light' }) {
  const { langCode, setLangCode } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = LANGUAGES.find(l => l.code === langCode) || LANGUAGES[0];

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isDark = variant === 'dark';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Change language"
        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border transition-all active:scale-95 cursor-pointer ${
          isDark
            ? 'bg-white/15 hover:bg-white/25 border-white/30 text-white'
            : 'bg-white hover:bg-amber-50 border-stone-200 text-stone-700'
        }`}
      >
        <Globe className="w-3.5 h-3.5" />
        <span>{current.native}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden min-w-[180px]">
          <div className="p-2 flex flex-col gap-0.5">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => { setLangCode(lang.code); setOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm flex items-center justify-between font-semibold transition-all cursor-pointer ${
                  lang.code === langCode
                    ? 'bg-amber-50 text-[#e65100]'
                    : 'text-stone-700 hover:bg-stone-50'
                }`}
              >
                <span>{lang.native}</span>
                <span className="text-[11px] text-stone-400 font-normal">{lang.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
