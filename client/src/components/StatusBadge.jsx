import React from 'react';
import { Clock, CheckCircle2, Truck, Check, XCircle, AlertTriangle } from 'lucide-react';

export default function StatusBadge({ status }) {
  const configs = {
    pending: {
      label: 'Pending Review',
      bg: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
      icon: Clock
    },
    approved: {
      label: 'Approved (Ready to Dispatch)',
      bg: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
      icon: CheckCircle2
    },
    partially_fulfillable: {
      label: 'Partially Fulfillable',
      bg: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800',
      icon: AlertTriangle
    },
    partially_fulfilled: {
      label: 'Partially Dispatched',
      bg: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
      icon: Truck
    },
    dispatched: {
      label: 'Dispatched',
      bg: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
      icon: Truck
    },
    delivered: {
      label: 'Delivered',
      bg: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800',
      icon: Check
    },
    rejected: {
      label: 'Rejected',
      bg: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800',
      icon: XCircle
    }
  };

  const config = configs[status] || {
    label: status,
    bg: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300',
    icon: Clock
  };

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bg}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{config.label}</span>
    </span>
  );
}
