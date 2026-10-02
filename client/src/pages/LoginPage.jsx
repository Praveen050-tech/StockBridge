import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Store, Warehouse, ArrowRight, ShieldCheck, Zap, Lock, Mail, Phone, User, CheckCircle } from 'lucide-react';

export default function LoginPage() {
  const { login, register, quickDemoLogin } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form states
  const [loginEmailOrPhone, setLoginEmailOrPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [registerData, setRegisterData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    role: 'shop_owner',
    godown_id: 1
  });

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      setLoading(true);
      await login(loginEmailOrPhone, loginPassword);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      setLoading(true);
      await register(registerData);
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (role) => {
    setError(null);
    try {
      setLoading(true);
      await quickDemoLogin(role);
    } catch (err) {
      setError(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      
      {/* Decorative Glow Elements */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <div className="inline-flex items-center justify-center space-x-2 bg-slate-800/80 border border-slate-700/80 px-4 py-1.5 rounded-full mb-4 shadow-inner">
          <Zap className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-slate-300">B2B Inventory & Restock Network</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
          StockBridge
        </h2>
        <p className="mt-2 text-sm text-slate-400 max-w-sm mx-auto">
          Synchronizing Kirana shop stock with regional wholesale godowns in real time.
        </p>
      </div>

      {/* Main Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="bg-slate-800/90 backdrop-blur-xl border border-slate-700/80 py-8 px-6 sm:px-10 rounded-3xl shadow-2xl">
          
          {/* Quick Demo 1-Click Login Buttons */}
          <div className="mb-6 p-4 rounded-2xl bg-slate-900/80 border border-slate-700/60 text-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
              ⚡ Instant 1-Click Role Switcher Demo
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleQuickDemo('shop_owner')}
                disabled={loading}
                className="py-2.5 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-bold text-xs flex items-center justify-center space-x-1.5 transition-all"
              >
                <Store className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate">Shop Owner</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo('godown_admin')}
                disabled={loading}
                className="py-2.5 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-bold text-xs flex items-center justify-center space-x-1.5 transition-all"
              >
                <Warehouse className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Godown Admin</span>
              </button>
            </div>
          </div>

          <div className="relative flex py-2 items-center mb-4">
            <div className="flex-grow border-t border-slate-700"></div>
            <span className="flex-shrink mx-4 text-xs font-semibold text-slate-500 uppercase">Or sign in with account</span>
            <div className="flex-grow border-t border-slate-700"></div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold">
              {error}
            </div>
          )}

          {!isRegistering ? (
            /* LOGIN FORM */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Email or Phone Number
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={loginEmailOrPhone}
                    onChange={(e) => setLoginEmailOrPhone(e.target.value)}
                    placeholder="e.g. shop@stockbridge.io or 9840987654"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-xl text-sm font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
              </button>
            </form>
          ) : (
            /* REGISTER FORM */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Full Name / Store Name</label>
                <input
                  type="text"
                  required
                  value={registerData.name}
                  onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                  placeholder="e.g. Lakshmi Kirana Store"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Phone</label>
                  <input
                    type="text"
                    required
                    value={registerData.phone}
                    onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
                    placeholder="9840123456"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={registerData.email}
                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                    placeholder="store@domain.com"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={registerData.password}
                  onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                  placeholder="Create secure password"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Role Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRegisterData({ ...registerData, role: 'shop_owner' })}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 ${
                      registerData.role === 'shop_owner'
                        ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}
                  >
                    <Store className="w-3.5 h-3.5" />
                    <span>Shop Owner</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegisterData({ ...registerData, role: 'godown_admin' })}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 ${
                      registerData.role === 'godown_admin'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}
                  >
                    <Warehouse className="w-3.5 h-3.5" />
                    <span>Godown Admin</span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-3 py-3 px-4 rounded-xl text-sm font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
              >
                {loading ? 'Creating Account...' : 'Complete Registration'}
              </button>
            </form>
          )}

          <div className="mt-5 text-center">
            <button
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
            >
              {isRegistering ? 'Already have an account? Sign In' : 'Need a new account? Register as Shop / Godown'}
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}
