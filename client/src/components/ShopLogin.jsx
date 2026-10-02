import React, { useState } from 'react';
import { Store, Lock, Phone, ArrowLeft, KeyRound } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';

export default function ShopLogin({ onLoginSuccess, onBackToCustomer }) {
  const { t } = useLanguage();
  const [phone, setPhone] = useState('9876543210');
  const [pin, setPin] = useState('1234');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/shop/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin })
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Invalid login details');
      }

      onLoginSuccess(data.shop);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbf9f5] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* Brand Icon */}
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#f57c00] to-[#e65100] text-white flex items-center justify-center shadow-lg mb-3">
          <Store className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-stone-900 tracking-tight">வாய்மொழி Shop</h1>
        <p className="text-xs text-stone-500 mb-4">{t('shop_portal')} — Vaaimozhi</p>
        <div className="mb-4"><LanguageSwitcher /></div>

        {/* Login Card */}
        <div className="w-full bg-white rounded-3xl p-6 border border-[#ede6dd] shadow-lg">
          <h2 className="text-base font-bold text-stone-800 mb-4 text-center">
            {t('sign_in_pin')}
          </h2>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="shopPhone" className="text-xs font-bold text-stone-700 block mb-1.5 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-[#e65100]" />
                <span>{t('shop_phone')}</span>
              </label>
              <div className="flex rounded-xl border border-stone-200 overflow-hidden focus-within:border-[#e65100] focus-within:ring-2 focus-within:ring-[#e65100]/20">
                <span className="bg-stone-50 px-3 py-2 text-stone-500 font-bold text-sm border-r border-stone-200 flex items-center">
                  +91
                </span>
                <input
                  id="shopPhone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full px-3 py-2 text-base font-bold text-stone-800 outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="shopPin" className="text-xs font-bold text-stone-700 block mb-1.5 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-[#e65100]" />
                <span>{t('pin')}</span>
              </label>
              <input
                id="shopPin"
                type="password"
                maxLength={4}
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full px-3 py-2.5 text-center text-xl tracking-widest font-black rounded-xl border border-stone-200 focus:border-[#e65100] focus:ring-2 focus:ring-[#e65100]/20 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-800 text-white font-bold text-base rounded-2xl shadow-md active:scale-95 transition-all mt-2 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>{t('sign_in')}</span>
              )}
            </button>
          </form>

          {/* Demo Hint */}
          <div className="mt-4 p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-[11px] text-amber-900 flex items-start gap-2">
            <KeyRound className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">{t('demo_store')}</strong>
              <span>Phone: <code>9876543210</code> | PIN: <code>1234</code></span>
            </div>
          </div>
        </div>

        <button
          onClick={onBackToCustomer}
          className="mt-4 text-xs font-semibold text-stone-500 hover:text-stone-800 flex items-center gap-1 py-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t('back_customer')}</span>
        </button>
      </div>
    </div>
  );
}
