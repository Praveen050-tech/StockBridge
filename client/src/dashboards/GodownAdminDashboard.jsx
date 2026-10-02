import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import KPICard from '../components/KPICard';
import StatusBadge from '../components/StatusBadge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import {
  Warehouse,
  Boxes,
  Truck,
  TrendingUp,
  AlertTriangle,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Check,
  Send,
  SlidersHorizontal,
  X,
  History,
  Phone,
  Layers,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';

export default function GodownAdminDashboard() {
  const { user } = useAuth();
  const { lastEvent } = useSocket();

  // State
  const [activeTab, setActiveTab] = useState('orders'); // 'orders', 'inventory', 'analytics', 'movements'
  const [statusFilter, setStatusFilter] = useState('all');
  const [stockSummary, setStockSummary] = useState({ totalProducts: 0, lowStockCount: 0, totalInventoryValue: 0 });
  const [stockItems, setStockItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState({ topDemanded: [], shopBreakdown: [], recentMovements: [] });
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showFulfillModal, setShowFulfillModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [fulfillmentInput, setFulfillmentInput] = useState({}); // { [productId]: qtyToFulfill }

  // Form states
  const [restockForm, setRestockForm] = useState({ product_id: '', quantity: '' });
  const [productForm, setProductForm] = useState({ name: '', category: 'Grains & Rice', unit: 'kg', price_per_unit: '', initial_stock: '100' });
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Load all godown data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [stockRes, ordersRes, analyticsRes, moveRes] = await Promise.all([
        api.getGodownStock(),
        api.getGodownOrders(),
        api.getGodownAnalytics(),
        api.getGodownMovements()
      ]);

      if (stockRes.success) {
        setStockSummary(stockRes.data.summary);
        setStockItems(stockRes.data.items);
      }
      if (ordersRes.success) {
        setOrders(ordersRes.orders);
      }
      if (analyticsRes.success) {
        setAnalytics(analyticsRes.data);
      }
      if (moveRes.success) {
        setMovements(moveRes.movements);
      }
    } catch (err) {
      console.error('Error fetching godown dashboard data:', err);
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
      if (lastEvent.type === 'new_order' || lastEvent.type === 'order_status_changed' || lastEvent.type === 'godown_stock_updated') {
        fetchData();
      }
    }
  }, [lastEvent]);

  // Quick One-Click Full Dispatch
  const handleFullDispatch = async (orderId) => {
    if (!window.confirm(`Are you sure you want to dispatch Order #${orderId} with full requested quantities? Stock will be automatically deducted from godown and credited to shop.`)) {
      return;
    }

    try {
      setActionLoading(true);
      const res = await api.processOrder(orderId, 'dispatch');
      fetchData();
      setFeedback({ type: 'success', text: res.message });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err) {
      alert(`Dispatch failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Open Partial Fulfillment Modal
  const openFulfillModal = (order) => {
    setSelectedOrder(order);
    const initialInput = {};
    order.items.forEach(item => {
      // Default to requested or available, whichever is smaller
      const maxPossible = Math.min(item.qty_requested, item.godown_available);
      initialInput[item.product_id] = maxPossible.toString();
    });
    setFulfillmentInput(initialInput);
    setShowFulfillModal(true);
  };

  // Submit Partial Fulfillment
  const handleFulfillSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;

    try {
      setActionLoading(true);
      const fulfillmentItems = Object.entries(fulfillmentInput).map(([productId, qty]) => ({
        product_id: parseInt(productId),
        qty_fulfilled: parseFloat(qty)
      }));

      const res = await api.processOrder(selectedOrder.id, 'dispatch', fulfillmentItems);
      setShowFulfillModal(false);
      fetchData();
      setFeedback({ type: 'success', text: res.message });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err) {
      alert(`Dispatch error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Approve Order
  const handleApprove = async (orderId) => {
    try {
      setActionLoading(true);
      await api.processOrder(orderId, 'approve');
      fetchData();
      setFeedback({ type: 'success', text: `Order #${orderId} approved.` });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      alert(`Approval error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Reject Order
  const handleReject = async (orderId) => {
    const reason = prompt('Please enter reason for rejection (e.g., product out of stock):');
    if (reason === null) return;

    try {
      setActionLoading(true);
      await api.processOrder(orderId, 'reject', null, reason);
      fetchData();
      setFeedback({ type: 'info', text: `Order #${orderId} rejected.` });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      alert(`Rejection error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Restock Incoming Shipment
  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await api.restockGodown(parseInt(restockForm.product_id), parseFloat(restockForm.quantity));
      setShowRestockModal(false);
      setRestockForm({ product_id: '', quantity: '' });
      fetchData();
      setFeedback({ type: 'success', text: res.message });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      alert(`Restock error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Add Product
  const handleAddProductSubmit = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await api.addProduct(productForm);
      setShowAddProductModal(false);
      setProductForm({ name: '', category: 'Grains & Rice', unit: 'kg', price_per_unit: '', initial_stock: '100' });
      fetchData();
      setFeedback({ type: 'success', text: res.message });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      alert(`Product creation error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Filter Orders
  const filteredOrders = orders.filter(o => statusFilter === 'all' || o.status === statusFilter);
  const pendingOrdersCount = orders.filter(o => o.status === 'pending' || o.status === 'partially_fulfillable').length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 pb-16">
      {/* Top Banner Header (Dark Emerald Theme) */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 border-b border-emerald-800/40 pt-8 pb-14 px-4 sm:px-6 lg:px-8 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-emerald-400 text-xs font-bold tracking-wider uppercase">Godown Logistics Portal</span>
              <span className="bg-emerald-900/60 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-700/50">
                Warehouse ID #{user?.godown_id || 1}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold mt-1 tracking-tight text-white">
              {user?.godown_name || 'Central Wholesale Godown Hub'}
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-xl">
              Manage incoming retail restock orders, execute partial or full transactional dispatches, log supplier inward shipments, and monitor cross-shop demand trends.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowRestockModal(true)}
              className="flex items-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-900/40 transition-all transform hover:-translate-y-0.5 text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Inward Delivery (Restock)</span>
            </button>
            <button
              onClick={fetchData}
              title="Refresh Data"
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
        
        {/* Feedback Alert */}
        {feedback && (
          <div className="mb-4 p-4 rounded-xl bg-emerald-600/90 text-white font-medium text-sm flex items-center justify-between shadow-xl backdrop-blur-md border border-emerald-400/30">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{feedback.text}</span>
            </div>
            <button onClick={() => setFeedback(null)}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KPICard
            title="Master SKUs"
            value={stockSummary.totalProducts}
            subtitle="Products cataloged"
            icon={Boxes}
            color="emerald"
            isDark={true}
          />
          <KPICard
            title="Pending Orders"
            value={pendingOrdersCount}
            subtitle="Awaiting fulfillment / dispatch"
            icon={Clock}
            color={pendingOrdersCount > 0 ? 'amber' : 'emerald'}
            isDark={true}
          />
          <KPICard
            title="Low Godown Stock"
            value={stockSummary.lowStockCount}
            subtitle="Need supplier reordering"
            icon={AlertTriangle}
            color={stockSummary.lowStockCount > 0 ? 'rose' : 'emerald'}
            isDark={true}
          />
          <KPICard
            title="Total Warehouse Value"
            value={`₹${stockSummary.totalInventoryValue.toLocaleString('en-IN')}`}
            subtitle="Available stock valuation"
            icon={TrendingUp}
            color="purple"
            isDark={true}
          />
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-slate-800 bg-slate-800/90 rounded-t-2xl px-4 pt-2 shadow-sm">
          <button
            onClick={() => setActiveTab('orders')}
            className={`py-3 px-4 font-bold text-sm border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'orders'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Incoming Orders ({orders.length})</span>
            {pendingOrdersCount > 0 && (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs px-2 py-0.5 rounded-full font-bold">
                {pendingOrdersCount} new
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`py-3 px-4 font-bold text-sm border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'inventory'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Master Inventory ({stockItems.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-3 px-4 font-bold text-sm border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'analytics'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Demand Trends & Forecasting</span>
          </button>

          <button
            onClick={() => setActiveTab('movements')}
            className={`py-3 px-4 font-bold text-sm border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'movements'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Audit Trail Ledger</span>
          </button>
        </div>

        {/* Content Box */}
        <div className="bg-slate-850 bg-slate-800/60 rounded-b-2xl border border-slate-800 p-4 sm:p-6 min-h-[460px]">
          
          {/* TAB 1: INCOMING ORDERS */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              {/* Filter Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/60">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-slate-400">Filter Status:</span>
                  {['all', 'pending', 'approved', 'partially_fulfillable', 'dispatched'].map(st => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                        statusFilter === st
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <div className="text-xs text-slate-400">
                  Showing {filteredOrders.length} orders
                </div>
              </div>

              {/* Order Cards */}
              <div className="space-y-4">
                {filteredOrders.map(order => {
                  const isActionable = order.status === 'pending' || order.status === 'approved' || order.status === 'partially_fulfillable';
                  const allCanFulfill = order.items.every(i => i.can_fully_fulfill);

                  return (
                    <div
                      key={order.id}
                      className="border border-slate-700/80 rounded-2xl p-5 bg-slate-800/90 hover:border-slate-600 transition-all shadow-md"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-700/60">
                        <div>
                          <div className="flex items-center space-x-3">
                            <span className="text-lg font-extrabold text-white">Order #{order.id}</span>
                            <StatusBadge status={order.status} />
                            {!allCanFulfill && isActionable && (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                <AlertTriangle className="w-3 h-3 text-amber-400" />
                                <span>Stock Shortage on Items</span>
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                            <span className="font-bold text-slate-200">Shop: {order.shop_name}</span>
                            {order.shop_phone && (
                              <span className="flex items-center space-x-1 text-slate-400">
                                <Phone className="w-3 h-3" />
                                <span>{order.shop_phone}</span>
                              </span>
                            )}
                            <span>Placed: {new Date(order.created_at).toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <span className="text-[11px] text-slate-400 uppercase tracking-wide block">Order Value</span>
                            <span className="text-xl font-black text-emerald-400">₹{order.total_amount}</span>
                          </div>

                          {/* Action Buttons for Pending/Approved Orders */}
                          {isActionable && (
                            <div className="flex items-center space-x-2">
                              {/* 1-Click Full Dispatch */}
                              <button
                                onClick={() => handleFullDispatch(order.id)}
                                disabled={actionLoading || !allCanFulfill}
                                title={!allCanFulfill ? 'Cannot full dispatch: insufficient godown stock' : 'Full Dispatch'}
                                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-1.5 shadow-md shadow-emerald-950/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>Dispatch Full</span>
                              </button>

                              {/* Partial Fulfillment / Custom Dispatch */}
                              <button
                                onClick={() => openFulfillModal(order)}
                                disabled={actionLoading}
                                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 flex items-center space-x-1.5 transition-all"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                <span>Partial / Custom</span>
                              </button>

                              {/* Reject */}
                              <button
                                onClick={() => handleReject(order.id)}
                                disabled={actionLoading}
                                title="Reject Order"
                                className="p-2 rounded-xl text-xs font-semibold bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Items Table */}
                      <div className="pt-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {order.items.map(item => {
                            const hasShortage = item.godown_available < item.qty_requested;

                            return (
                              <div
                                key={item.id}
                                className={`p-3 rounded-xl border text-xs flex justify-between items-center ${
                                  hasShortage && isActionable
                                    ? 'bg-amber-950/30 border-amber-800/50'
                                    : 'bg-slate-900/60 border-slate-700/60'
                                }`}
                              >
                                <div>
                                  <p className="font-bold text-white">{item.product_name}</p>
                                  <p className="text-[11px] text-slate-400">
                                    ₹{item.unit_price} / {item.unit}
                                  </p>
                                  <p className="text-[11px] mt-0.5">
                                    <span className="text-slate-400">Godown Stock: </span>
                                    <strong className={hasShortage ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
                                      {item.godown_available} {item.unit}
                                    </strong>
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Requested</span>
                                  <span className="text-sm font-extrabold text-white">
                                    {item.qty_requested} {item.unit}
                                  </span>
                                  {order.status === 'dispatched' || order.status === 'partially_fulfilled' ? (
                                    <span className="text-emerald-400 font-bold block text-[11px]">
                                      Fulfilled: {item.qty_fulfilled} {item.unit}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {!filteredOrders.length && (
                  <div className="text-center py-16 text-slate-500">
                    No incoming orders matching the selected filter.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: MASTER INVENTORY */}
          {activeTab === 'inventory' && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <h3 className="text-lg font-bold text-white">Warehouse Master Inventory</h3>
                  <p className="text-xs text-slate-400">Central stock levels available for retail dispatches</p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowAddProductModal(true)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 flex items-center space-x-1.5 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New SKU</span>
                  </button>

                  <button
                    onClick={() => setShowRestockModal(true)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-1.5 transition-colors shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Delivery (+ Stock)</span>
                  </button>
                </div>
              </div>

              {/* Master Inventory Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-900/80 text-slate-400 uppercase text-[11px] font-bold tracking-wider border-y border-slate-700">
                    <tr>
                      <th className="py-3 px-4">SKU / Product</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-right">Available in Godown</th>
                      <th className="py-3 px-4 text-right">Safety Threshold</th>
                      <th className="py-3 px-4">Stock Status</th>
                      <th className="py-3 px-4 text-right">Wholesale Price</th>
                      <th className="py-3 px-4 text-center">Inward Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {stockItems.map(item => (
                      <tr key={item.product_id} className="hover:bg-slate-800/80 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-white">
                          {item.name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400">
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-xs font-medium text-slate-300">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-base">
                          <span className={item.quantity_available < item.safety_threshold ? 'text-amber-400' : 'text-emerald-400'}>
                            {item.quantity_available}
                          </span>
                          <span className="text-xs text-slate-400 ml-1 font-normal">{item.unit}</span>
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-400 font-medium">
                          {item.safety_threshold} {item.unit}
                        </td>
                        <td className="py-3.5 px-4">
                          {item.quantity_available < item.safety_threshold ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-950/60 text-amber-300 border border-amber-800">
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              <span>Reorder from Supplier</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>Sufficient Stock</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-200">
                          ₹{item.price_per_unit}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => {
                              setRestockForm({ product_id: item.product_id.toString(), quantity: '100' });
                              setShowRestockModal(true);
                            }}
                            className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-300 border border-emerald-700/60 transition-colors"
                          >
                            + Inward Stock
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: DEMAND TRENDS & FORECASTING */}
          {activeTab === 'analytics' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-bold text-white">Demand Trends & Stock Depletion Velocity</h3>
                <p className="text-xs text-slate-400">Insights from retail orders across all connected Kirana stores</p>
              </div>

              {/* Chart 1: Most Demanded Products */}
              <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-700/80">
                <h4 className="text-sm font-bold text-slate-200 mb-4 flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>Top Product Demand (Requested vs Fulfilled Quantities)</span>
                </h4>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.topDemanded.slice(0, 7)} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                      <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '10px' }} />
                      <Bar dataKey="total_requested" name="Qty Requested" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="total_fulfilled" name="Qty Dispatched" fill="#10b981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Grid: Shop Distribution & Fastest Depleting */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Shop Order Volume */}
                <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-700/80">
                  <h4 className="text-sm font-bold text-slate-200 mb-3">Shop Ordering Distribution</h4>
                  <div className="space-y-3">
                    {analytics.shopBreakdown.map((s, idx) => (
                      <div key={idx} className="p-3 bg-slate-800/80 rounded-xl flex items-center justify-between border border-slate-700/60">
                        <div>
                          <p className="font-bold text-white text-sm">{s.shopName}</p>
                          <p className="text-xs text-slate-400">{s.totalOrders} total orders placed</p>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-emerald-400 text-sm">₹{s.totalAmount.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    ))}
                    {!analytics.shopBreakdown.length && (
                      <p className="text-xs text-slate-500 py-6 text-center">No shop ordering history recorded yet.</p>
                    )}
                  </div>
                </div>

                {/* Safety Stock Priority Alerts */}
                <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-700/80">
                  <h4 className="text-sm font-bold text-slate-200 mb-3 flex items-center space-x-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    <span>Warehouse Safety Reorder Alerts</span>
                  </h4>
                  <div className="space-y-2.5">
                    {stockItems
                      .filter(i => i.quantity_available < i.safety_threshold)
                      .map(item => (
                        <div key={item.product_id} className="p-3 bg-amber-950/30 rounded-xl border border-amber-800/50 flex justify-between items-center">
                          <div>
                            <p className="font-bold text-white text-xs">{item.name}</p>
                            <p className="text-[11px] text-amber-300">
                              Current: {item.quantity_available} {item.unit} (Below safety threshold of {item.safety_threshold} {item.unit})
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setRestockForm({ product_id: item.product_id.toString(), quantity: '200' });
                              setShowRestockModal(true);
                            }}
                            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors"
                          >
                            Order Restock
                          </button>
                        </div>
                      ))}
                    {!stockItems.some(i => i.quantity_available < i.safety_threshold) && (
                      <div className="text-center py-8 text-emerald-400 text-xs flex flex-col items-center">
                        <CheckCircle2 className="w-8 h-8 mb-2" />
                        <span>All warehouse SKU levels are healthy and above safety thresholds.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AUDIT TRAIL LEDGER */}
          {activeTab === 'movements' && (
            <div>
              <h3 className="font-bold text-base text-white mb-4">Complete Warehouse Stock Ledger (Audit Trail)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-900/80 text-slate-400 uppercase text-[11px] font-bold border-y border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Product</th>
                      <th className="py-3 px-4">Movement Type</th>
                      <th className="py-3 px-4 text-right">Quantity Delta</th>
                      <th className="py-3 px-4">Shop Destination</th>
                      <th className="py-3 px-4">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {movements.map(m => (
                      <tr key={m.id} className="hover:bg-slate-800/80">
                        <td className="py-3 px-4 text-xs text-slate-400">
                          {new Date(m.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-bold text-white">
                          {m.product_name}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            m.movement_type === 'restock_in'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : m.movement_type === 'dispatch_out'
                              ? 'bg-purple-950 text-purple-300 border border-purple-800'
                              : 'bg-slate-800 text-slate-300'
                          }`}>
                            {m.movement_type.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-white">
                          {m.movement_type === 'restock_in' ? `+${m.quantity}` : `-${m.quantity}`} {m.unit}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-300">
                          {m.shop_name || '-'}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-400">
                          {m.reference_order_id ? `Order #${m.reference_order_id}` : 'Inward Delivery'}
                        </td>
                      </tr>
                    ))}
                    {!movements.length && (
                      <tr>
                        <td colSpan="6" className="py-12 text-center text-slate-500">
                          No warehouse movements recorded yet.
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

      {/* MODAL: PARTIAL FULFILLMENT / CUSTOM DISPATCH */}
      {showFulfillModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-slate-850 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-xl w-full p-6 animate-in fade-in zoom-in-95 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">Fulfill & Dispatch Order #{selectedOrder.id}</h3>
                <p className="text-xs text-slate-400">Shop: {selectedOrder.shop_name}</p>
              </div>
              <button onClick={() => setShowFulfillModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <form onSubmit={handleFulfillSubmit} className="mt-4 space-y-4">
              <p className="text-xs text-slate-300">
                Specify fulfilled quantity for each requested SKU. If stock is partially dispatched, the order will be marked as <strong className="text-purple-400">partially_fulfilled</strong>.
              </p>

              <div className="divide-y divide-slate-800 max-h-72 overflow-y-auto">
                {selectedOrder.items.map(item => {
                  const val = fulfillmentInput[item.product_id] || '';
                  const numVal = parseFloat(val) || 0;
                  const hasInsufficient = numVal > item.godown_available;

                  return (
                    <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-white text-sm">{item.product_name}</p>
                        <p className="text-xs text-slate-400">
                          Requested: <strong>{item.qty_requested} {item.unit}</strong> • Available: <strong className={item.godown_available < item.qty_requested ? 'text-amber-400' : 'text-emerald-400'}>{item.godown_available} {item.unit}</strong>
                        </p>
                      </div>

                      <div className="w-32">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max={item.godown_available}
                          value={val}
                          onChange={(e) => setFulfillmentInput({ ...fulfillmentInput, [item.product_id]: e.target.value })}
                          className={`w-full border rounded-lg px-2.5 py-1.5 text-sm font-bold text-right bg-slate-800 focus:outline-none focus:ring-2 ${
                            hasInsufficient ? 'border-rose-500 text-rose-300 focus:ring-rose-500' : 'border-slate-700 text-white focus:ring-emerald-500'
                          }`}
                        />
                        {hasInsufficient && (
                          <span className="text-[10px] text-rose-400 block text-right">Exceeds available!</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowFulfillModal(false)}
                  className="px-4 py-2 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-950/50 disabled:opacity-50"
                >
                  {actionLoading ? 'Processing Dispatch...' : 'Confirm & Dispatch Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INWARD DELIVERY RESTOCK */}
      {showRestockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full p-6 text-white animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Record Inward Supplier Delivery</h3>
              <button onClick={() => setShowRestockModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <form onSubmit={handleRestockSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Select Product</label>
                <select
                  required
                  value={restockForm.product_id}
                  onChange={(e) => setRestockForm({ ...restockForm, product_id: e.target.value })}
                  className="w-full border border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Choose Product --</option>
                  {stockItems.map(p => (
                    <option key={p.product_id} value={p.product_id}>
                      {p.name} (Current: {p.quantity_available} {p.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Quantity Received</label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  required
                  placeholder="e.g. 500"
                  value={restockForm.quantity}
                  onChange={(e) => setRestockForm({ ...restockForm, quantity: e.target.value })}
                  className="w-full border border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-800 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRestockModal(false)}
                  className="px-4 py-2 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-950/50 disabled:opacity-50"
                >
                  {actionLoading ? 'Recording...' : 'Add to Godown Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW MASTER PRODUCT */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full p-6 text-white animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Add New Product to Master Catalog</h3>
              <button onClick={() => setShowAddProductModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <form onSubmit={handleAddProductSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sona Masoori Raw Rice 25kg"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full border border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Category</label>
                  <input
                    type="text"
                    required
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    className="w-full border border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Unit</label>
                  <select
                    value={productForm.unit}
                    onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                    className="w-full border border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="kg">kg</option>
                    <option value="l">l (liter)</option>
                    <option value="pcs">pcs</option>
                    <option value="box">box</option>
                    <option value="packet">packet</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Wholesale Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 62.50"
                    value={productForm.price_per_unit}
                    onChange={(e) => setProductForm({ ...productForm, price_per_unit: e.target.value })}
                    className="w-full border border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Initial Stock</label>
                  <input
                    type="number"
                    step="any"
                    value={productForm.initial_stock}
                    onChange={(e) => setProductForm({ ...productForm, initial_stock: e.target.value })}
                    className="w-full border border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="px-4 py-2 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-950/50 disabled:opacity-50"
                >
                  {actionLoading ? 'Creating...' : 'Create SKU'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
