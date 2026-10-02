import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Store, Warehouse, LogOut, ArrowRightLeft, Radio, Bell } from 'lucide-react';

export default function Navbar({ onSwitchRole }) {
  const { user, logout, quickDemoLogin } = useAuth();
  const { isConnected, notifications } = useSocket();

  const isGodown = user?.role === 'godown_admin';

  const handleQuickSwitch = async () => {
    if (isGodown) {
      await quickDemoLogin('shop_owner');
    } else {
      await quickDemoLogin('godown_admin');
    }
    if (onSwitchRole) onSwitchRole();
  };

  return (
    <header className={`sticky top-0 z-40 border-b backdrop-blur-md transition-colors duration-300 ${
      isGodown 
        ? 'bg-slate-900/90 border-emerald-800/50 text-white' 
        : 'bg-white/95 border-blue-100 text-slate-900 shadow-xs'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand & Connection Status */}
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shadow-md ${
            isGodown 
              ? 'bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-emerald-500/20' 
              : 'bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-blue-500/20'
          }`}>
            {isGodown ? <Warehouse className="w-5 h-5" /> : <Store className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-xl tracking-tight">StockBridge</span>
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                isGodown 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                  : 'bg-blue-100 text-blue-700 border border-blue-200'
              }`}>
                {isGodown ? 'Godown Admin' : 'Shop Owner'}
              </span>
            </div>
            <p className={`text-xs ${isGodown ? 'text-slate-400' : 'text-slate-500'}`}>
              B2B Godown & Shop Inventory Logistics
            </p>
          </div>
        </div>

        {/* Right side tools */}
        <div className="flex items-center space-x-3">
          {/* Real-time Socket Indicator */}
          <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
            isConnected 
              ? isGodown 
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-600'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 live-indicator' : 'bg-red-500'}`} />
            <span className="hidden sm:inline">{isConnected ? 'Live Real-time' : 'Reconnecting...'}</span>
          </div>

          {/* Quick 1-Click Role Switcher */}
          <button
            onClick={handleQuickSwitch}
            title={`Switch to ${isGodown ? 'Shop Owner' : 'Godown Admin'}`}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border shadow-xs ${
              isGodown
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Switch to {isGodown ? 'Shop Owner' : 'Godown Admin'}</span>
          </button>

          {/* User Profile summary */}
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-bold truncate max-w-[140px]">{user?.name}</span>
            <span className={`text-[10px] ${isGodown ? 'text-emerald-400' : 'text-blue-600'}`}>
              {user?.godown_name || 'Central Logistics'}
            </span>
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            className={`p-2 rounded-lg transition-colors border ${
              isGodown
                ? 'hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white'
                : 'hover:bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-800'
            }`}
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

      </div>
    </header>
  );
}
