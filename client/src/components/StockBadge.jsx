import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Flame } from 'lucide-react';

export default function StockBadge({ urgency, isLowStock, quantity, threshold, unit = 'units' }) {
  if (quantity === 0 || urgency === 'critical') {
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800">
        <Flame className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
        <span>Out of Stock</span>
      </span>
    );
  }

  if (urgency === 'high' || (isLowStock && quantity <= threshold * 0.5)) {
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
        <span>Critical Low ({quantity} {unit})</span>
      </span>
    );
  }

  if (isLowStock) {
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300 dark:bg-yellow-950/60 dark:text-yellow-300 dark:border-yellow-800">
        <AlertCircle className="w-3.5 h-3.5 text-yellow-600" />
        <span>Low Stock</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
      <span>Adequate</span>
    </span>
  );
}
