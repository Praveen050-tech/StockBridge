import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [lastEvent, setLastEvent] = useState(null);

  const addNotification = (title, message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    const newNotif = { id, title, message, type, time: new Date() };
    setNotifications((prev) => [newNotif, ...prev.slice(0, 7)]); // Keep last 8

    // Auto dismiss toast after 6 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 6000);
  };

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  useEffect(() => {
    // Connect to the same host the page is served from.
    // In dev, Vite proxies WebSocket traffic; in prod both share the same origin.
    const socketUrl = window.location.origin;

    const s = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000
    });

    s.on('connect', () => {
      console.log('⚡ Connected to StockBridge live socket:', s.id);
      setIsConnected(true);
    });

    s.on('disconnect', () => {
      console.log('🔌 Disconnected from socket');
      setIsConnected(false);
    });

    // Listen to real-time events
    s.on('new_order', (orderData) => {
      addNotification(
        '📦 New Order Received!',
        `Order #${orderData.id} from ${orderData.shop_name} for ₹${orderData.total_amount}.`,
        'success'
      );
      setLastEvent({ type: 'new_order', data: orderData, timestamp: Date.now() });
    });

    s.on('order_status_changed', (orderData) => {
      const statusTitle = orderData.status === 'dispatched' ? '🚚 Order Dispatched!' : `Order #${orderData.id} Updated`;
      addNotification(
        statusTitle,
        `Your order #${orderData.id} is now ${orderData.status.toUpperCase()}.`,
        orderData.status === 'dispatched' ? 'success' : orderData.status === 'rejected' ? 'error' : 'info'
      );
      setLastEvent({ type: 'order_status_changed', data: orderData, timestamp: Date.now() });
    });

    s.on('godown_stock_updated', (update) => {
      setLastEvent({ type: 'godown_stock_updated', data: update, timestamp: Date.now() });
    });

    s.on('shop_stock_updated', (update) => {
      setLastEvent({ type: 'shop_stock_updated', data: update, timestamp: Date.now() });
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  // Join role room when user loads
  useEffect(() => {
    if (!socket || !user) return;

    if (user.role === 'godown_admin') {
      const godownId = user.godown_id || 1;
      socket.emit('join_godown', godownId);
      console.log(`Joined room: godown_${godownId}`);
    } else if (user.role === 'shop_owner') {
      socket.emit('join_shop', user.id);
      console.log(`Joined room: shop_${user.id}`);
    }
  }, [socket, user]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        notifications,
        removeNotification,
        addNotification,
        lastEvent
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
