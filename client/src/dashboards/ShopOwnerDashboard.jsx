import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import KPICard from '../components/KPICard';
import StockBadge from '../components/StockBadge';
import StatusBadge from '../components/StatusBadge';
import {
  Boxes,
  AlertTriangle,
  Flame,
  IndianRupee,
  ShoppingCart,
  Plus,
  RefreshCw,
  Sliders,
  History,
  CheckCircle,
  Search,
  Filter,
  X,
  ArrowDownRight,
  TrendingDown
} from 'lucide-react';

export default function ShopOwnerDashboard() {
  const { user } = useAuth();
  const { lastEvent } = useSocket();

  // State
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory', 'low_stock', 'orders', 'movements'
  const [stockSummary, setStockSummary] = useState({ totalProducts: 0, lowStockCount: 0, criticalCount: 0, totalInventoryValue: 0 });
  const [stockItems, setStockItems] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [orders, setOrders] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modals
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Form states
  const [orderCart, setOrderCart] = useState({}); // { [productId]: quantity }
  const [adjustData, setAdjustData] = useState({ reason: 'sale', delta: '', customThreshold: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Load all data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [stockRes, catalogRes, ordersRes, moveRes] = await Promise.all([
        api.getShopStock(),
        api.getShopCatalog(),
        api.getShopOrders(),
        api.getShopMovements()
      ]);

      if (stockRes.success) {
        setStockSummary(stockRes.data.summary);
        setStockItems(stockRes.data.items);
      }
      if (catalogRes.success) {
        setCatalog(catalogRes.catalog);
      }
      if (ordersRes.success) {
        setOrders(ordersRes.orders);
      }
      if (moveRes.success) {
        setMovements(moveRes.movements);
      }
    } catch (err) {
      console.error('Error fetching shop dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // React to live socket events
  useEffect(() => {
    if (lastEvent) {
      if (lastEvent.type === 'order_status_changed' || lastEvent.type === 'shop_stock_updated' || lastEvent.type === 'godown_stock_updated') {
        fetchData();
      }
    }
  }, [lastEvent]);

  // Open Adjust Modal
  const openAdjust = (product) => {
    setSelectedProduct(product);
    setAdjustData({
      reason: 'sale',
      delta: '1',
      customThreshold: product.reorder_threshold.toString()
    });
    setShowAdjustModal(true);
  };

  // Open Order Modal (with optional single product preselected)
  const openOrderModalWithItem = (product = null) => {
    if (product) {
      const suggestedQty = Math.max(10, Math.ceil((product.reorder_threshold * 2) - product.quantity_on_hand));
      setOrderCart({ [product.product_id]: suggestedQty });
    } else {
      setOrderCart({});
    }
    setShowOrderModal(true);
  };

  // Handle Adjustment Submit
  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;

    try {
      setActionLoading(true);
      const deltaNum = parseFloat(adjustData.delta);
      if (isNaN(deltaNum) || deltaNum <= 0) {
        alert('Please enter a positive numeric quantity');
        return;
      }

      // Convert delta based on reason
      const actualDelta = adjustData.reason === 'restock' ? deltaNum : -deltaNum;

      await api.updateShopStock(
        selectedProduct.product_id,
        actualDelta,
        adjustData.reason,
        adjustData.customThreshold ? parseFloat(adjustData.customThreshold) : undefined
      );

      setShowAdjustModal(false);
      fetchData();
      setFeedbackMsg({ type: 'success', text: `Stock successfully adjusted for ${selectedProduct.name}!` });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err) {
      alert(`Adjustment error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Order Submit
  const handleOrderSubmit = async (e) => {
    e.preventDefault();
    const items = Object.entries(orderCart)
      .map(([productId, qty]) => ({ product_id: parseInt(productId), qty_requested: parseFloat(qty) }))
      .filter(i => i.qty_requested > 0);

    if (!items.length) {
      alert('Please specify quantity for at least one item.');
      return;
    }

    try {
      setActionLoading(true);
      const res = await api.placeShopOrder(items);
      setShowOrderModal(false);
      setOrderCart({});
      fetchData();
      setActiveTab('orders');
      setFeedbackMsg({
        type: 'success',
        text: `Restock Order #${res.order.id} placed! Status: ${res.order.status.toUpperCase()}`
      });
      setTimeout(() => setFeedbackMsg(null), 5000);
    } catch (err) {
      alert(`Order placement error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered Items
  const filteredItems = stockItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesLowStock = activeTab === 'low_stock' ? item.is_low_stock : true;
    return matchesSearch && matchesCategory && matchesLowStock;
  });

  const categories = ['all', ...new Set(stockItems.map(i => i.category))];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white pt-8 pb-14 px-4 sm:px-6 lg:px-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-blue-200 text-xs font-semibold tracking-wider uppercase">Shop Owner Portal</span>
              <span className="bg-blue-500/40 text-blue-100 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-400/30">
                Connected to: {user?.godown_name}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold mt-1 tracking-tight">{user?.name}</h1>
            <p className="text-blue-100 text-sm mt-1 max-w-xl">
              Track your Kirana stock, monitor automatic low-stock triggers, and dispatch one-click replenishment orders directly to the godown.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => openOrderModalWithItem()}
              className="flex items-center space-x-2 bg-white text-blue-700 hover:bg-blue-50 font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-blue-900/20 transition-all transform hover:-translate-y-0.5 text-sm"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Place Restock Order</span>
            </button>
            <button
              onClick={fetchData}
              title="Refresh Data"
              className="p-2.5 rounded-xl bg-blue-600/60 hover:bg-blue-600 text-white border border-blue-400/30 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
        
        {/* Feedback Alert */}
        {feedbackMsg && (
          <div className="mb-4 p-4 rounded-xl bg-emerald-600 text-white font-medium text-sm flex items-center justify-between shadow-lg animate-in fade-in">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 shrink-0" />
              <span>{feedbackMsg.text}</span>
            </div>
            <button onClick={() => setFeedbackMsg(null)}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KPICard
            title="Total Products"
            value={stockSummary.totalProducts}
            subtitle="Active SKUs in inventory"
            icon={Boxes}
            color="blue"
          />
          <KPICard
            title="Low Stock Items"
            value={stockSummary.lowStockCount}
            subtitle="At or below reorder threshold"
            icon={AlertTriangle}
            color={stockSummary.lowStockCount > 0 ? 'amber' : 'emerald'}
          />
          <KPICard
            title="Critical Stock"
            value={stockSummary.criticalCount}
            subtitle="Zero quantity on hand"
            icon={Flame}
            color={stockSummary.criticalCount > 0 ? 'rose' : 'blue'}
          />
          <KPICard
            title="Inventory Value"
            value={`₹${stockSummary.totalInventoryValue.toLocaleString('en-IN')}`}
            subtitle="Current stock valuation"
            icon={IndianRupee}
            color="purple"
          />
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-slate-200 bg-white rounded-t-2xl shadow-xs px-4 pt-2">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`py-3 px-4 font-bold text-sm border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'inventory'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>All Products ({stockItems.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('low_stock')}
            className={`py-3 px-4 font-bold text-sm border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'low_stock'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Low Stock Urgency</span>
            {stockSummary.lowStockCount > 0 && (
              <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-extrabold">
                {stockSummary.lowStockCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`py-3 px-4 font-bold text-sm border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'orders'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Restock Orders ({orders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('movements')}
            className={`py-3 px-4 font-bold text-sm border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'movements'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Audit Trail</span>
          </button>
        </div>

        {/* Content Section */}
        <div className="bg-white rounded-b-2xl shadow-xs border border-t-0 border-slate-200 p-4 sm:p-6 min-h-[420px]">
          
          {/* TAB 1 & 2: INVENTORY & LOW STOCK */}
          {(activeTab === 'inventory' || activeTab === 'low_stock') && (
            <div>
              {/* Search & Filters */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search product or category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <Filter className="w-4 h-4 text-slate-500" />
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-bold tracking-wider border-y border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Product Name</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-right">On Hand</th>
                      <th className="py-3 px-4 text-right">Threshold</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Unit Price</th>
                      <th className="py-3 px-4 text-center">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredItems.map(item => (
                      <tr
                        key={item.product_id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          item.urgency === 'critical' ? 'bg-rose-50/30' : item.is_low_stock ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {item.name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-xs font-medium text-slate-700">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-base">
                          <span className={item.quantity_on_hand === 0 ? 'text-rose-600 font-extrabold' : item.is_low_stock ? 'text-amber-600 font-bold' : 'text-slate-800'}>
                            {item.quantity_on_hand}
                          </span>
                          <span className="text-xs font-normal text-slate-400 ml-1">{item.unit}</span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-slate-500">
                          {item.reorder_threshold} {item.unit}
                        </td>
                        <td className="py-3.5 px-4">
                          <StockBadge
                            urgency={item.urgency}
                            isLowStock={item.is_low_stock}
                            quantity={item.quantity_on_hand}
                            threshold={item.reorder_threshold}
                            unit={item.unit}
                          />
                        </td>
                        <td className="py-3.5 px-4 text-right font-semibold text-slate-700">
                          ₹{item.price_per_unit}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => openAdjust(item)}
                              title="Log Sale or Adjust Stock"
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                            >
                              Adjust / Sale
                            </button>
                            <button
                              onClick={() => openOrderModalWithItem(item)}
                              title="Quick Restock Order"
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                            >
                              Restock
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!filteredItems.length && (
                      <tr>
                        <td colSpan="7" className="py-12 text-center text-slate-400">
                          No products found matching your filter criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: RESTOCK ORDERS */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-base text-slate-800">Your Godown Restock Orders</h3>
                <button
                  onClick={() => openOrderModalWithItem()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Restock Order</span>
                </button>
              </div>

              <div className="space-y-3">
                {orders.map(order => (
                  <div key={order.id} className="border border-slate-200 rounded-xl p-4.5 bg-slate-50/50 hover:bg-white transition-all shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/60">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-slate-900 text-base">Order #{order.id}</span>
                          <StatusBadge status={order.status} />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Placed on: {new Date(order.created_at).toLocaleString()} • Godown: {order.godown_name}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-500">Total Order Value:</span>
                        <div className="text-xl font-extrabold text-blue-700">₹{order.total_amount}</div>
                      </div>
                    </div>

                    {/* Order items detail */}
                    <div className="pt-3">
                      <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Ordered Items</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {order.items.map(item => (
                          <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs flex justify-between items-center">
                            <div>
                              <p className="font-bold text-slate-800">{item.product_name}</p>
                              <p className="text-slate-500 text-[11px]">₹{item.unit_price} per {item.unit}</p>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-slate-900">
                                {item.qty_requested} {item.unit}
                              </span>
                              {order.status === 'dispatched' || order.status === 'partially_fulfilled' ? (
                                <p className="text-emerald-600 font-semibold text-[11px]">
                                  Fulfilled: {item.qty_fulfilled} {item.unit}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                {!orders.length && (
                  <div className="text-center py-12 text-slate-400">
                    You have not placed any restock orders yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: AUDIT TRAIL */}
          {activeTab === 'movements' && (
            <div>
              <h3 className="font-bold text-base text-slate-800 mb-4">Stock Movements & Audit Ledger</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-bold border-y border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Product</th>
                      <th className="py-3 px-4">Movement Type</th>
                      <th className="py-3 px-4 text-right">Quantity</th>
                      <th className="py-3 px-4">Order Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movements.map(m => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 text-xs text-slate-500">
                          {new Date(m.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {m.product_name}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            m.movement_type === 'restock_in'
                              ? 'bg-emerald-100 text-emerald-800'
                              : m.movement_type === 'sale'
                              ? 'bg-blue-100 text-blue-800'
                              : m.movement_type === 'damage'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}>
                            {m.movement_type.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {m.movement_type === 'restock_in' ? `+${m.quantity}` : `-${m.quantity}`} {m.unit}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500">
                          {m.reference_order_id ? `Order #${m.reference_order_id}` : 'Manual Adjustment'}
                        </td>
                      </tr>
                    ))}
                    {!movements.length && (
                      <tr>
                        <td colSpan="5" className="py-12 text-center text-slate-400">
                          No audit movements recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* MODAL 1: PLACE RESTOCK ORDER */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-blue-50/60">
              <div>
                <h3 className="text-lg font-bold text-blue-900">Place Restock Order to Godown</h3>
                <p className="text-xs text-blue-700">Select catalog items and quantities to replenish</p>
              </div>
              <button onClick={() => setShowOrderModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOrderSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="divide-y divide-slate-100">
                {catalog.map(item => {
                  const qty = orderCart[item.id] || '';
                  const lineTotal = (parseFloat(qty || 0) * item.price_per_unit).toFixed(2);
                  const isAvailableInGodown = item.quantity_available > 0;

                  return (
                    <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-800 text-sm">{item.name}</span>
                          <span className="text-xs text-slate-400">({item.category})</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Price: ₹{item.price_per_unit} / {item.unit} •{' '}
                          <span className={item.quantity_available < 20 ? 'text-amber-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                            Available in Godown: {item.quantity_available} {item.unit}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <div className="w-24">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="Qty"
                            value={qty}
                            onChange={(e) => setOrderCart({ ...orderCart, [item.id]: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm text-right font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                        <div className="w-20 text-right text-xs font-bold text-blue-700">
                          {parseFloat(qty) > 0 ? `₹${lineTotal}` : '-'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 p-4 rounded-xl">
                <div>
                  <span className="text-xs text-slate-500 block">Estimated Order Total:</span>
                  <span className="text-2xl font-extrabold text-blue-700">
                    ₹{Object.entries(orderCart).reduce((sum, [pid, q]) => {
                      const p = catalog.find(c => c.id === parseInt(pid));
                      return sum + (p ? p.price_per_unit * (parseFloat(q) || 0) : 0);
                    }, 0).toFixed(2)}
                  </span>
                </div>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowOrderModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 disabled:opacity-50"
                  >
                    {actionLoading ? 'Submitting...' : 'Submit Order'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MANUAL STOCK ADJUSTMENT / SALE */}
      {showAdjustModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Adjust Stock / Record Sale</h3>
              <button onClick={() => setShowAdjustModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="mt-4 space-y-4">
              <div>
                <span className="text-xs font-semibold text-slate-500">Selected Product</span>
                <p className="font-bold text-slate-800 text-sm mt-0.5">{selectedProduct.name}</p>
                <p className="text-xs text-slate-500">Current On Hand: <strong className="text-blue-700">{selectedProduct.quantity_on_hand} {selectedProduct.unit}</strong></p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Reason for Adjustment</label>
                <select
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="sale">Customer Sale (Deduct Stock)</option>
                  <option value="damage">Damaged / Expired / Spoilage (Deduct)</option>
                  <option value="restock">Direct Physical Count Addition (+ Add)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Quantity ({selectedProduct.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={adjustData.delta}
                  onChange={(e) => setAdjustData({ ...adjustData, delta: e.target.value })}
                  placeholder={`e.g. 5 ${selectedProduct.unit}`}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Custom Reorder Alert Threshold ({selectedProduct.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={adjustData.customThreshold}
                  onChange={(e) => setAdjustData({ ...adjustData, customThreshold: e.target.value })}
                  placeholder="e.g. 15"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Alert me whenever stock drops below this level.
                </span>
              </div>

              {/* Real-time preview calculation */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-500">Calculated New Stock: </span>
                {(() => {
                  const d = parseFloat(adjustData.delta) || 0;
                  const newQty = adjustData.reason === 'restock'
                    ? selectedProduct.quantity_on_hand + d
                    : selectedProduct.quantity_on_hand - d;
                  return (
                    <strong className={newQty < 0 ? 'text-rose-600 font-extrabold' : 'text-blue-700 font-bold'}>
                      {newQty.toFixed(2)} {selectedProduct.unit} {newQty < 0 && '(Negative Stock Forbidden!)'}
                    </strong>
                  );
                })()}
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Apply Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
