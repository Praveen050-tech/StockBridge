import React from 'react';

export default function KPICard({ title, value, subtitle, icon: Icon, color = 'blue', isDark = false }) {
  const colorMap = {
    blue: {
      lightBg: 'bg-blue-50/70 border-blue-100 text-blue-900',
      darkBg: 'bg-slate-800/80 border-slate-700/80 text-white',
      iconBg: 'bg-blue-600 text-white',
      accent: 'text-blue-600 dark:text-blue-400'
    },
    emerald: {
      lightBg: 'bg-emerald-50/70 border-emerald-100 text-emerald-950',
      darkBg: 'bg-slate-800/80 border-emerald-900/40 text-white',
      iconBg: 'bg-emerald-600 text-white',
      accent: 'text-emerald-500'
    },
    amber: {
      lightBg: 'bg-amber-50/80 border-amber-100 text-amber-950',
      darkBg: 'bg-slate-800/80 border-amber-900/40 text-white',
      iconBg: 'bg-amber-500 text-white',
      accent: 'text-amber-500'
    },
    rose: {
      lightBg: 'bg-rose-50/80 border-rose-100 text-rose-950',
      darkBg: 'bg-slate-800/80 border-rose-900/40 text-white',
      iconBg: 'bg-rose-600 text-white',
      accent: 'text-rose-500'
    },
    purple: {
      lightBg: 'bg-purple-50/70 border-purple-100 text-purple-950',
      darkBg: 'bg-slate-800/80 border-purple-900/40 text-white',
      iconBg: 'bg-purple-600 text-white',
      accent: 'text-purple-400'
    }
  };

  const style = colorMap[color] || colorMap.blue;

  return (
    <div className={`p-5 rounded-2xl border transition-all duration-200 hover:shadow-md ${isDark ? style.darkBg : style.lightBg}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {title}
          </p>
          <h3 className="text-2xl sm:text-3xl font-extrabold mt-1.5 tracking-tight">
            {value}
          </h3>
          {subtitle && (
            <p className={`text-xs mt-1 font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {subtitle}
            </p>
          )}
        </div>
        {Icon && (
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-xs shrink-0 ${style.iconBg}`}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  );
}
