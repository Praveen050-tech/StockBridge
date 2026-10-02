import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Mic, 
  MicOff, 
  ShoppingBag, 
  ShieldCheck, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Minus, 
  Trash2, 
  Store, 
  ArrowRight, 
  ArrowLeft,
  Phone,
  Sparkles
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';

export default function CustomerOrder({ onNavigateToShop }) {
  const { t, getSpeechLang } = useLanguage();

  // Application State
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);
  
  // Navigation / Workflow Step: 'speech' | 'review' | 'confirmed'
  const [step, setStep] = useState('speech');
  const [isLoading, setIsLoading] = useState(false);

  // Review & Order State
  const [parsedItems, setParsedItems] = useState([]);
  const [unmatched, setUnmatched] = useState([]);
  const [catalogOptions, setCatalogOptions] = useState([]);
  const [customerPhone, setCustomerPhone] = useState(() => localStorage.getItem('vaaimozhi_phone') || '');
  
  // Order Confirmation State
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  const recognitionRef = useRef(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const speechLang = getSpeechLang();
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = speechLang;

      recognition.onstart = () => {
        setIsRecording(true);
        setStatusMessage(t('listening'));
      };

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const piece = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += piece + ' ';
          } else {
            interim += piece;
          }
        }

        if (final) {
          setTranscript(prev => (prev ? prev + ' ' : '') + final.trim());
        }
        setInterimTranscript(interim);
      };

      recognition.onerror = (e) => {
        console.warn('Speech error:', e.error);
        setIsRecording(false);
        setStatusMessage('Microphone: ' + (e.error === 'not-allowed' ? 'Permission denied' : e.error));
      };

      recognition.onend = () => {
        setIsRecording(false);
        setStatusMessage(null);
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
    } else {
      setStatusMessage('Voice not supported on this browser. Type below.');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [getSpeechLang]);

  // Toggle Recording
  const toggleRecording = () => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.lang = getSpeechLang();
        recognitionRef.current.start();
      } catch (err) {
        console.warn('Start error:', err);
      }
    }
  };

  // Submit to /api/parse
  const handleParseOrder = async () => {
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const fullText = (transcript + ' ' + interimTranscript).trim();
    if (!fullText) {
      alert('Please speak or type your grocery items first.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: fullText, shop_id: 1 })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Parsing failed');

      setParsedItems(data.items || []);
      setUnmatched(data.unmatched || []);
      setCatalogOptions(data.catalog_options || []);
      setStep('review');
    } catch (err) {
      alert('Could not match order items: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Quantity updates
  const updateQty = (idx, delta) => {
    setParsedItems(prev => {
      const next = [...prev];
      const cur = next[idx].quantity;
      if (cur + delta >= 0.25) {
        next[idx].quantity = Math.round((cur + delta) * 100) / 100;
        next[idx].line_total = Math.round(next[idx].quantity * next[idx].unit_price * 100) / 100;
      }
      return next;
    });
  };

  const removeItem = (idx) => {
    setParsedItems(prev => prev.filter((_, i) => i !== idx));
  };

  // Did You Mean replacement
  const handleSelectAlternative = (idx, newCatalogId) => {
    const selected = catalogOptions.find(c => c.id === Number(newCatalogId));
    if (!selected) return;

    setParsedItems(prev => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        catalog_id: selected.id,
        name: selected.name,
        unit: selected.unit,
        unit_price: selected.price,
        line_total: Math.round(next[idx].quantity * selected.price * 100) / 100,
        confidence_score: 1.0,
        is_confident: true
      };
      return next;
    });
  };

  // Calculate order total
  const orderTotal = parsedItems.reduce((acc, it) => acc + (it.quantity * it.unit_price), 0);

  // Confirm order to /api/create_order
  const handleConfirmOrder = async () => {
    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      alert('Please enter your 10-digit mobile number for order delivery.');
      return;
    }
    if (!parsedItems.length) {
      alert('Please include at least one grocery item in your order.');
      return;
    }

    localStorage.setItem('vaaimozhi_phone', cleanPhone);
    setIsLoading(true);

    try {
      const res = await fetch('/api/create_order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          shop_id: 1,
          items: parsedItems,
          transcript_raw: transcript
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to place order');

      setConfirmedOrder(data);
      setStep('confirmed');
    } catch (err) {
      alert('Order failed: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // "Same as last time" Reorder
  const handleSameAsLastTime = async () => {
    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      alert('Please enter your 10-digit phone number to retrieve previous orders.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/orders/last?phone=${cleanPhone}&shop_id=1`);
      const data = await res.json();
      if (!data.success || !data.has_order) {
        alert('No past orders found for this phone number.');
        return;
      }

      setParsedItems(data.items || []);
      setTranscript(data.transcript_raw || 'Repeat previous order');
      setStep('review');
    } catch (err) {
      alert('Failed to load past order: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbf9f5] flex flex-col items-center">
      {/* Top Navbar */}
      <header className="w-full bg-gradient-to-r from-[#e65100] to-[#f57c00] text-white shadow-md py-3 px-4 sticky top-0 z-30">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight">வாய்மொழி</span>
              <span className="text-xs font-semibold uppercase tracking-wider ml-1.5 opacity-90">Vaaimozhi</span>
              <span className="ml-2 text-[10px] bg-white/25 text-white font-medium px-2 py-0.5 rounded-full">{t('voice_kirana')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher variant="dark" />
            <button 
              onClick={onNavigateToShop}
              className="flex items-center gap-1.5 text-xs font-bold bg-white/15 hover:bg-white/25 active:scale-95 text-white px-3 py-1.5 rounded-full border border-white/30 transition-all"
            >
              <Store className="w-3.5 h-3.5" />
              <span>{t('shop_login')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-xl p-4 flex-1 flex flex-col">
        {/* 3-Step How It Works Banner */}
        <div className="bg-white rounded-2xl p-3 border border-[#ede6dd] shadow-sm mb-4">
          <div className="grid grid-cols-3 text-center divide-x divide-stone-100">
            <div className="flex flex-col items-center px-1">
              <div className="w-9 h-9 rounded-full bg-amber-50 text-[#e65100] flex items-center justify-center font-bold text-sm mb-1">
                <Mic className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-stone-800">{t('step1')}</span>
            </div>
            <div className="flex flex-col items-center px-1">
              <div className="w-9 h-9 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm mb-1">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-stone-800">{t('step2')}</span>
            </div>
            <div className="flex flex-col items-center px-1">
              <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm mb-1">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-stone-800">{t('step3')}</span>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* STEP 1: VOICE RECORDING SCREEN                           */}
        {/* ======================================================== */}
        {step === 'speech' && (
          <div className="flex flex-col gap-4">
            {/* Large Thumb-Friendly Mic Button */}
            <div className="bg-white rounded-3xl p-6 border-2 border-[#ede6dd] shadow-sm flex flex-col items-center text-center">
              <span className="text-[11px] font-bold tracking-wider uppercase text-stone-400 mb-2">
                {t('voice_ordering')}
              </span>

              <div className="relative my-3">
                <button
                  type="button"
                  onClick={toggleRecording}
                  aria-label={isRecording ? 'Stop voice recording' : 'Start voice recording'}
                  className={`w-28 h-28 rounded-full flex items-center justify-center text-white transition-all duration-300 shadow-xl active:scale-95 cursor-pointer ${
                    isRecording 
                      ? 'bg-gradient-to-br from-red-500 to-red-700 animate-mic-pulse' 
                      : 'bg-gradient-to-br from-[#f57c00] to-[#e65100] hover:scale-105 hover:shadow-amber-500/30'
                  }`}
                >
                  {isRecording ? <MicOff className="w-12 h-12" /> : <Mic className="w-12 h-12" />}
                </button>
              </div>

              <div className="text-base font-bold text-[#e65100] mt-1 min-h-[1.5rem]">
                {statusMessage || t('tap_mic')}
              </div>

              {/* Trust Note */}
              <div className="flex items-center gap-1.5 text-xs text-stone-500 mt-3 bg-stone-50 px-3 py-1.5 rounded-full border border-stone-200">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>{t('voice_note_trust')}</span>
              </div>
            </div>

            {/* Live Editable Transcript */}
            <div className="bg-white rounded-2xl p-4 border border-[#ede6dd] shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-stone-800">
                  {t('your_order_text')}
                </span>
                {(transcript || interimTranscript) && (
                  <button 
                    onClick={() => { setTranscript(''); setInterimTranscript(''); }}
                    className="text-xs text-red-500 hover:text-red-700 font-semibold"
                  >
                    {t('clear')}
                  </button>
                )}
              </div>

              <textarea
                rows={4}
                value={transcript + (interimTranscript ? ' ' + interimTranscript : '')}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder={t('placeholder')}
                className="w-full text-base sm:text-lg leading-relaxed p-3 rounded-xl border border-stone-200 focus:border-[#e65100] focus:ring-2 focus:ring-[#e65100]/20 outline-none resize-none text-stone-800 placeholder:text-stone-300"
              />
              <p className="text-[11px] text-stone-400 mt-1">
                {t('edit_hint')}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleParseOrder}
                disabled={isLoading || (!transcript.trim() && !interimTranscript.trim())}
                className="w-full min-h-[58px] bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-800 hover:to-emerald-700 disabled:opacity-40 text-white font-bold text-lg rounded-2xl shadow-lg shadow-emerald-700/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{t('submit_order')}</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSameAsLastTime}
                className="w-full py-3 bg-white border-2 border-dashed border-[#e65100] text-[#e65100] hover:bg-amber-50 font-bold rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t('same_as_last')}</span>
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 2: REVIEW & EDIT SCREEN                             */}
        {/* ======================================================== */}
        {step === 'review' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-700" />
                <span>{t('review_order')}</span>
              </h2>
              <button
                onClick={() => setStep('speech')}
                className="flex items-center gap-1 text-xs font-bold text-stone-500 hover:text-stone-800 bg-white px-3 py-1.5 rounded-full border border-stone-200"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t('respeak')}</span>
              </button>
            </div>

            {/* Unmatched items warning */}
            {unmatched.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold">{t('unmatched')}</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {unmatched.map((w, i) => (
                      <span key={i} className="bg-white px-2 py-0.5 rounded border border-amber-200 font-medium">
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Items List */}
            {parsedItems.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-stone-200 text-center text-stone-400">
                <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="font-semibold text-stone-600">{t('no_items_matched')}</p>
                <p className="text-xs mt-1">{t('try_saying')}</p>
              </div>
            ) : (
              parsedItems.map((item, idx) => (
                <div key={idx} className="bg-white rounded-2xl p-3.5 border border-[#ede6dd] shadow-sm flex flex-col gap-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-stone-900 text-base">{item.name}</div>
                      <div className="text-xs text-stone-500 font-medium">₹{item.unit_price} / {item.unit}</div>
                    </div>
                    <div className="text-right">
                      {item.is_confident ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> {t('matched')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                          <AlertCircle className="w-3 h-3" /> {t('check_item')}
                        </span>
                      )}
                      <div className="text-base font-extrabold text-emerald-800 mt-1">
                        ₹{(item.quantity * item.unit_price).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* "Did you mean?" dropdown for items with low confidence */}
                  {!item.is_confident && catalogOptions.length > 0 && (
                    <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-2 text-xs">
                      <label htmlFor={`alternative-select-${idx}`} className="font-bold text-amber-900 block mb-1">
                        {t('did_you_mean')}
                      </label>
                      <select
                        id={`alternative-select-${idx}`}
                        value={item.catalog_id}
                        onChange={(e) => handleSelectAlternative(idx, e.target.value)}
                        className="w-full bg-white border border-amber-300 rounded-lg p-1.5 text-xs font-semibold text-stone-800 outline-none"
                      >
                        {catalogOptions.map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name} (₹{cat.price}/{cat.unit})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Quantity Stepper & Delete */}
                  <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                    <div className="flex items-center bg-stone-100 rounded-xl p-1">
                      <button
                        type="button"
                        onClick={() => updateQty(idx, -1)}
                        className="w-8 h-8 rounded-lg bg-white flex items-center justify-center font-bold text-stone-700 shadow-sm active:bg-stone-200"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="px-3 font-extrabold text-stone-900 text-sm">
                        {item.quantity} <span className="text-xs font-normal text-stone-500">{item.unit}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQty(idx, 1)}
                        className="w-8 h-8 rounded-lg bg-white flex items-center justify-center font-bold text-stone-700 shadow-sm active:bg-stone-200"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="text-stone-400 hover:text-red-600 p-2 rounded-lg transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}

            {/* Total Card */}
            <div className="bg-white rounded-2xl p-4 border border-[#ede6dd] shadow-sm flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-stone-500">{t('total_amount')}</span>
                <p className="text-[11px] text-stone-400">{t('final_price_confirmed')}</p>
              </div>
              <div className="text-2xl font-black text-emerald-700">
                ₹{orderTotal.toFixed(2)}
              </div>
            </div>

            {/* Mobile Number Input */}
            <div className="bg-white rounded-2xl p-4 border border-[#ede6dd] shadow-sm">
              <label htmlFor="customerPhone" className="text-xs font-bold text-stone-700 block mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-700" />
                <span>{t('mobile_delivery')}</span>
              </label>
              <div className="flex rounded-xl border border-stone-200 overflow-hidden focus-within:border-[#e65100] focus-within:ring-2 focus-within:ring-[#e65100]/20">
                <span className="bg-stone-50 px-3 py-2 text-stone-500 font-bold text-sm border-r border-stone-200 flex items-center">
                  +91
                </span>
                <input
                  id="customerPhone"
                  type="tel"
                  maxLength={10}
                  placeholder="9876543210"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 text-base font-bold text-stone-800 outline-none"
                />
              </div>
            </div>

            {/* Confirm Order Button */}
            <button
              type="button"
              onClick={handleConfirmOrder}
              disabled={isLoading || parsedItems.length === 0}
              className="w-full min-h-[58px] bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-800 hover:to-emerald-700 disabled:opacity-40 text-white font-bold text-lg rounded-2xl shadow-lg shadow-emerald-700/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer mt-1"
            >
              {isLoading ? (
                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{t('confirm_pay')}</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 3: ORDER CONFIRMED & UPI QR CODE                     */}
        {/* ======================================================== */}
        {step === 'confirmed' && confirmedOrder && (
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-3xl p-6 border-2 border-emerald-300 shadow-md text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <h2 className="text-xl font-black text-stone-900">{t('order_placed')}</h2>

              <span className="bg-emerald-50 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200 mb-4">
                Order #{confirmedOrder.order_id}
              </span>

              <span className="text-xs text-stone-400 uppercase font-semibold tracking-wider">{t('amount_to_pay')}</span>
              <div className="text-3xl font-black text-emerald-700 mb-4">
                ₹{Number(confirmedOrder.total_amount).toFixed(2)}
              </div>

              {/* UPI QR Code */}
              <div className="bg-white p-3 rounded-2xl border-2 border-stone-200 shadow-sm mb-3">
                <QRCodeSVG
                  value={confirmedOrder.upi_link}
                  size={200}
                  level="M"
                  includeMargin={true}
                  className="rounded-lg"
                />
              </div>

              <p className="text-xs text-stone-500 mb-4">
                {t('scan_with')}
              </p>

              {/* Pay with UPI App deep link */}
              <a
                href={confirmedOrder.upi_link}
                className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-base rounded-2xl shadow-md active:scale-95 transition-all block"
              >
                {t('pay_with_upi')}
              </a>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleSameAsLastTime}
                className="w-full py-3 bg-white border-2 border-dashed border-[#e65100] text-[#e65100] hover:bg-amber-50 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t('same_as_last')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTranscript('');
                  setParsedItems([]);
                  setConfirmedOrder(null);
                  setStep('speech');
                }}
                className="w-full py-2.5 text-stone-500 hover:text-stone-800 text-xs font-bold rounded-xl"
              >
                {t('place_another')}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
