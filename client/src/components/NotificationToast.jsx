import React from 'react';
import { useSocket } from '../contexts/SocketContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function NotificationToast() {
  const { notifications, removeNotification } = useSocket();

  if (!notifications.length) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2.5 max-w-sm w-full pointer-events-none">
      {notifications.map((notif) => {
        let icon = <Info className="w-5 h-5 text-blue-500 shrink-0" />;
        let borderClass = 'border-blue-500/40 bg-white/95 dark:bg-slate-900/95';

        if (notif.type === 'success') {
          icon = <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />;
          borderClass = 'border-emerald-500/40 bg-white/95 dark:bg-slate-900/95';
        } else if (notif.type === 'error') {
          icon = <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />;
          borderClass = 'border-rose-500/40 bg-white/95 dark:bg-slate-900/95';
        }

        return (
          <div
            key={notif.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-xl border backdrop-blur-md flex items-start space-x-3 transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 ${borderClass}`}
          >
            {icon}
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {notif.title}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                {notif.message}
              </p>
            </div>
            <button
              onClick={() => removeNotification(notif.id)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-sm"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
