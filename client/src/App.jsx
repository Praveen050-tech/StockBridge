import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import Navbar from './components/Navbar';
import NotificationToast from './components/NotificationToast';
import LoginPage from './pages/LoginPage';
import ShopOwnerDashboard from './dashboards/ShopOwnerDashboard';
import GodownAdminDashboard from './dashboards/GodownAdminDashboard';
import { RefreshCw } from 'lucide-react';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <RefreshCw className="w-10 h-10 text-blue-500 animate-spin mb-4" />
        <h2 className="text-xl font-bold tracking-tight">StockBridge</h2>
        <p className="text-xs text-slate-400 mt-1">Connecting Kirana stores with Wholesale Godowns...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-950">
      <Navbar />
      <main className="flex-1">
        {user.role === 'godown_admin' ? (
          <GodownAdminDashboard />
        ) : (
          <ShopOwnerDashboard />
        )}
      </main>
      <NotificationToast />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AppContent />
      </SocketProvider>
    </AuthProvider>
  );
}
