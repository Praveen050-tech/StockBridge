import React, { useState, useEffect, useRef } from 'react';
import { 
  Store, 
  Clock, 
  Phone, 
  CheckCircle2, 
  XCircle, 
  Edit3, 
  Volume2, 
  VolumeX, 
  LogOut, 
  Plus, 
  Trash2, 
  Package, 
  RefreshCw,
  MessageSquare
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';

export default function ShopDashboard({ shop, onLogout }) {
  const { t } = useLanguage();
  // Tabs: 'orders' | 'catalog'
  const [activeTab, setActiveTab] = useState('orders');
  
  // Orders State & 5-Second Polling
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('all');
  const [pendingCount, setPendingCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState('');

  // Editing order modal state
  const [editingOrder, setEditingOrder] = useState(null);
  const [editItems, setEditItems] = useState([]);

  // Catalog State
  const [catalog, setCatalog] = useState([]);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogForm, setCatalogForm] = useState({ id: null, name: '', aliases: '', unit: 'kg', price: '' });

  const knownPendingIdsRef = useRef(new Set());
  const isFirstLoadRef = useRef(true);

  // Play synthetic chime notification sound via Web Audio API
  const playChime = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const playTone = (freq, start, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };

      playTone(880, 0, 0.35);       // A5
      playTone(1174.66, 0.15, 0.5);  // D6
    } catch (e) {
      console.warn('Audio chime error:', e);
    }
  };

  // Fetch orders from API
  const fetchOrders = async () => {
    try {
      const res = await fetch(`/api/orders?shop_id=${shop.id || 1}&t=${Date.now()}`);
      const data = await res.json();
      if (!data.success) return;

      const newOrders = data.orders || [];
      setOrders(newOrders);
      setPendingCount(data.pending_count || 0);
      setLastRefreshed(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      // Check for new pending orders to trigger chime
      const currentPending = new Set();
      let hasNewPending = false;

      newOrders.forEach(o => {
        if (o.status === 'pending') {
          currentPending.add(o.id);
          if (!isFirstLoadRef.current && !knownPendingIdsRef.current.has(o.id)) {
            hasNewPending = true;
          }
        }
      });

      if (hasNewPending) {
        playChime();
      }

      knownPendingIdsRef.current = currentPending;
      isFirstLoadRef.current = false;
    } catch (err) {
      console.error('Fetch orders error:', err);
    }
  };

  // 5-Second polling setup
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [shop.id]);

  // Fetch catalog
  const fetchCatalog = async () => {
    try {
      const res = await fetch(`/api/catalog?shop_id=${shop.id || 1}`);
      const data = await res.json();
      if (data.success) {
        setCatalog(data.catalog || []);
      }
    } catch (err) {
      console.error('Catalog fetch error:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'catalog') {
      fetchCatalog();
    }
  }, [activeTab]);

  // Status update
  const handleUpdateStatus = async (orderId, newStatus, updatedItems = null) => {
    try {
      const payload = { status: newStatus };
      if (updatedItems) payload.items = updatedItems;

      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        fetchOrders();
      } else {
        alert('Update error: ' + data.error);
      }
    } catch (err) {
      alert('Failed to update status');
    }
  };

  // Open Edit Modal
  const openEditModal = (order) => {
    setEditingOrder(order);
    setEditItems(JSON.parse(JSON.stringify(order.items)));
  };

  const handleSaveEditedOrder = async () => {
    if (!editingOrder) return;
    await handleUpdateStatus(editingOrder.id, 'accepted', editItems);
    setEditingOrder(null);
  };

  // Catalog item save
  const handleSaveCatalogItem = async (e) => {
    e.preventDefault();
    try {
      const isEdit = Boolean(catalogForm.id);
      const url = isEdit ? `/api/catalog/${catalogForm.id}` : '/api/catalog';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...catalogForm,
          shop_id: shop.id || 1,
          price: parseFloat(catalogForm.price) || 0
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowCatalogModal(false);
        fetchCatalog();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Save catalog failed');
    }
  };

  const handleDeleteCatalog = async (id) => {
    if (!confirm('Remove this item from your shop catalog?')) return;
    try {
      const res = await fetch(`/api/catalog/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) fetchCatalog();
    } catch (e) {
      alert('Delete failed');
    }
  };

  // Filter orders
  const filteredOrders = orders.filter(o => {
    if (filter === 'all') return true;
    return o.status === filter;
  });

  return (
    <div className="min-h-screen bg-[#fbf9f5] flex flex-col">
      {/* Top Shop Bar */}
      <header className="bg-gradient-to-r from-[#e65100] to-[#f57c00] text-white shadow-md py-3 px-4 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-base sm:text-lg leading-tight">
                {shop.name || 'Lakshmi Kirana & General Store'}
              </h1>
              <span className="text-[11px] text-amber-100 flex items-center gap-1">
                UPI: <code className="bg-black/20 px-1 rounded text-white">{shop.upi_id || 'lakshmistore@upi'}</code>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher variant="dark" />
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Sound alerts enabled' : 'Sound muted'}
              className="p-2 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white text-xs flex items-center gap-1"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-300" /> : <VolumeX className="w-4 h-4 text-red-300" />}
            </button>
            <button
              onClick={onLogout}
              className="p-2 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white text-xs flex items-center gap-1 font-bold"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto w-full p-4 flex-1 flex flex-col">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-[#ede6dd] pb-2 mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-[#e65100] text-white shadow-sm'
                  : 'bg-white text-stone-600 hover:bg-amber-50'
              }`}
            >
              <span>{t('orders')}</span>
              {pendingCount > 0 && (
                <span className="bg-white text-[#e65100] text-xs font-black px-2 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('catalog')}
              className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'catalog'
                  ? 'bg-[#e65100] text-white shadow-sm'
                  : 'bg-white text-stone-600 hover:bg-amber-50'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>{t('catalog')}</span>
            </button>
          </div>

          {activeTab === 'orders' && (
            <div className="flex items-center gap-1.5 text-xs text-stone-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>5s poll ({lastRefreshed})</span>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* TAB 1: INCOMING ORDERS                                   */}
        {/* ======================================================== */}
        {activeTab === 'orders' && (
          <div className="flex flex-col gap-3">
            {/* Filter Pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {['all', 'pending', 'accepted', 'completed'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all capitalize cursor-pointer ${
                    filter === f
                      ? 'bg-stone-800 text-white shadow-sm'
                      : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  {f} {f === 'pending' && pendingCount > 0 ? `(${pendingCount})` : ''}
                </button>
              ))}
            </div>

            {filteredOrders.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 border border-[#ede6dd] text-center text-stone-400 mt-2">
                <Clock className="w-12 h-12 mx-auto mb-2 opacity-40 text-amber-600" />
                <h3 className="font-bold text-stone-700 text-base">{t('no_orders')}</h3>
                <p className="text-xs mt-1">
                  {t('poll_desc')}
                </p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const isPending = order.status === 'pending';
                const isAccepted = order.status === 'accepted';

                return (
                  <div
                    key={order.id}
                    className={`bg-white rounded-3xl p-4 sm:p-5 border transition-all shadow-sm ${
                      isPending 
                        ? 'border-l-6 border-l-[#f57c00] border-t-amber-100 border-r-amber-100 border-b-amber-100 bg-[#fffcf7]' 
                        : isAccepted 
                        ? 'border-l-6 border-l-emerald-600 border-stone-200' 
                        : 'border-l-6 border-l-stone-400 border-stone-200 opacity-70'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-lg text-stone-900">Order #{order.id}</span>
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                            isPending ? 'bg-amber-100 text-amber-900' :
                            isAccepted ? 'bg-emerald-100 text-emerald-800' :
                            'bg-stone-100 text-stone-700'
                          }`}>
                            {order.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-xs text-stone-400 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(order.created_at).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xl sm:text-2xl font-black text-emerald-700">
                          ₹{order.total_amount.toFixed(2)}
                        </div>
                        <a
                          href={`tel:${order.customer_phone}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 px-2.5 py-1 rounded-full mt-1"
                        >
                          <Phone className="w-3 h-3 text-emerald-600" />
                          <span>{order.customer_phone}</span>
                        </a>
                      </div>
                    </div>

                    {/* Order Items Table */}
                    <div className="bg-stone-50 rounded-2xl p-3 border border-stone-150 mb-3 divide-y divide-stone-200/60">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between py-1.5 first:pt-0 last:pb-0 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-stone-800">{item.name}</span>
                            <span className="text-xs bg-white px-2 py-0.5 rounded-md border border-stone-200 text-stone-600 font-semibold">
                              {item.quantity} {item.unit}
                            </span>
                          </div>
                          <span className="font-semibold text-stone-700 text-xs">
                            ₹{item.line_total ? item.line_total.toFixed(2) : (item.quantity * item.unit_price).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Raw Customer Voice Transcript */}
                    {order.transcript_raw && (
                      <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2.5 text-xs text-stone-600 mb-3 flex items-start gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-stone-800 font-bold">வாடிக்கையாளர் குரல் குறிப்பு (Voice note): </strong>
                          <span className="italic">"{order.transcript_raw}"</span>
                        </div>
                      </div>
                    )}

                    {/* Shop Action Buttons */}
                    {isPending && (
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-stone-200">
                        <button
                          onClick={() => openEditModal(order)}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{t('edit_items')}</span>
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Reject this customer order?')) {
                              handleUpdateStatus(order.id, 'rejected');
                            }
                          }}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold text-red-700 bg-white border border-red-200 hover:bg-red-50 flex items-center gap-1.5 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>{t('reject')}</span>
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'accepted')}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 shadow-sm flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{t('accept_order')}</span>
                        </button>
                      </div>
                    )}

                    {isAccepted && (
                      <div className="flex items-center justify-between pt-2 border-t border-stone-200">
                        <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{t('order_accepted')}</span>
                        </span>
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'completed')}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 cursor-pointer"
                        >
                          {t('mark_completed')}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: MANAGE CATALOG                                    */}
        {/* ======================================================== */}
        {activeTab === 'catalog' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-base font-bold text-stone-800">{t('shop_catalog')}</h2>
                <p className="text-xs text-stone-400">{t('add_aliases_hint')}</p>
              </div>
              <button
                onClick={() => {
                  setCatalogForm({ id: null, name: '', aliases: '', unit: 'kg', price: '' });
                  setShowCatalogModal(true);
                }}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('add_item')}</span>
              </button>
            </div>

            <div className="bg-white rounded-3xl border border-[#ede6dd] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold">
                      <th className="p-3">{t('item_name')}</th>
                      <th className="p-3">{t('aliases')}</th>
                      <th className="p-3">{t('unit')}</th>
                      <th className="p-3">{t('price')}</th>
                      <th className="p-3 text-right">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-150">
                    {catalog.map((item) => (
                      <tr key={item.id} className="hover:bg-amber-50/40">
                        <td className="p-3 font-bold text-stone-900">{item.name}</td>
                        <td className="p-3 text-stone-500 max-w-xs truncate">{item.aliases || '—'}</td>
                        <td className="p-3 font-semibold text-stone-700">{item.unit}</td>
                        <td className="p-3 font-black text-emerald-700">₹{parseFloat(item.price).toFixed(2)}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => {
                              setCatalogForm({
                                id: item.id,
                                name: item.name,
                                aliases: item.aliases || '',
                                unit: item.unit,
                                price: item.price
                              });
                              setShowCatalogModal(true);
                            }}
                            className="p-1.5 text-stone-500 hover:text-emerald-700 rounded-lg mr-1"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCatalog(item.id)}
                            className="p-1.5 text-stone-500 hover:text-red-600 rounded-lg"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* MODAL: EDIT ORDER ITEMS (Shopkeeper modification)       */}
      {/* ======================================================== */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-stone-200 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <h3 className="font-black text-base text-stone-900">
                Edit Order #{editingOrder.id} Items
              </h3>
              <button onClick={() => setEditingOrder(null)} className="text-stone-400 hover:text-stone-700">
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
              {editItems.map((it, idx) => (
                <div key={idx} className="bg-stone-50 p-2.5 rounded-xl border border-stone-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-stone-800 block">{it.name}</span>
                    <span className="text-stone-400">₹{it.unit_price} / {it.unit}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      value={it.quantity}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setEditItems(prev => {
                          const n = [...prev];
                          n[idx].quantity = val;
                          return n;
                        });
                      }}
                      className="w-16 bg-white p-1 text-center font-bold border border-stone-200 rounded-lg outline-none"
                    />
                    <span className="font-bold text-emerald-800 w-14 text-right">
                      ₹{(it.quantity * it.unit_price).toFixed(2)}
                    </span>
                    <button
                      onClick={() => setEditItems(prev => prev.filter((_, i) => i !== idx))}
                      className="text-stone-400 hover:text-red-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-stone-100">
              <span className="text-xs font-bold text-stone-600">Updated Total:</span>
              <span className="text-lg font-black text-emerald-700">
                ₹{editItems.reduce((s, it) => s + (it.quantity * it.unit_price), 0).toFixed(2)}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setEditingOrder(null)}
                className="w-1/2 py-2.5 rounded-xl text-xs font-bold border border-stone-200 text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditedOrder}
                className="w-1/2 py-2.5 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm"
              >
                Save & Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD / EDIT CATALOG ITEM                          */}
      {/* ======================================================== */}
      {showCatalogModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-stone-200 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <h3 className="font-black text-base text-stone-900">
                {catalogForm.id ? t('edit_catalog') : t('add_new')}
              </h3>
              <button onClick={() => setShowCatalogModal(false)} className="text-stone-400 hover:text-stone-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCatalogItem} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="font-bold text-stone-700 block mb-1">{t('item_name')}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ponni Boiled Rice"
                  value={catalogForm.name}
                  onChange={(e) => setCatalogForm({ ...catalogForm, name: e.target.value })}
                  className="w-full p-2 border border-stone-200 rounded-xl outline-none font-semibold text-stone-800"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">{t('aliases')}</label>
                <textarea
                  rows={2}
                  placeholder="e.g. ponni arisi, arisi, chawal, அரிசி, चावल"
                  value={catalogForm.aliases}
                  onChange={(e) => setCatalogForm({ ...catalogForm, aliases: e.target.value })}
                  className="w-full p-2 border border-stone-200 rounded-xl outline-none text-stone-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">{t('unit')}</label>
                  <select
                    value={catalogForm.unit}
                    onChange={(e) => setCatalogForm({ ...catalogForm, unit: e.target.value })}
                    className="w-full p-2 border border-stone-200 rounded-xl outline-none font-semibold bg-white"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="l">l</option>
                    <option value="ml">ml</option>
                    <option value="pcs">pcs</option>
                    <option value="packet">packet</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">{t('price')} (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    placeholder="58.00"
                    value={catalogForm.price}
                    onChange={(e) => setCatalogForm({ ...catalogForm, price: e.target.value })}
                    className="w-full p-2 border border-stone-200 rounded-xl outline-none font-bold text-stone-800"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowCatalogModal(false)}
                  className="w-1/2 py-2.5 rounded-xl font-bold border border-stone-200 text-stone-600 hover:bg-stone-50"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm"
                >
                  {t('save_item')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
