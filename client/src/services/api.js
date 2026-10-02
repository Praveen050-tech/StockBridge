/**
 * Centralized API client for StockBridge.
 * Uses a relative /api path so Vite's dev proxy forwards to localhost:5000,
 * and works in production when frontend & backend share the same host.
 */
const BASE_URL = '/api';

function getAuthHeader() {
  const token = localStorage.getItem('stockbridge_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options.headers
  };

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (networkErr) {
    throw new Error(
      'Cannot reach the StockBridge server. Please make sure the backend is running on port 5000.'
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Server error (${response.status})`);
  }

  return data;
}

export const api = {
  // Auth
  login: (emailOrPhone, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ emailOrPhone, password })
    }),

  register: (userData) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    }),

  getProfile: () => request('/auth/me'),

  // Shop Owner
  getShopStock: () => request('/shop/stock'),
  getShopCatalog: () => request('/shop/catalog'),
  getShopOrders: () => request('/shop/orders'),
  getShopMovements: () => request('/shop/movements'),
  placeShopOrder: (items) =>
    request('/shop/orders', {
      method: 'POST',
      body: JSON.stringify({ items })
    }),
  updateShopStock: (productId, delta, reason, customThreshold) =>
    request(`/shop/stock/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify({ delta, reason, customThreshold })
    }),

  // Godown Admin
  getGodownStock: () => request('/godown/stock'),
  getGodownOrders: (status) =>
    request(`/godown/orders${status ? `?status=${status}` : ''}`),
  getGodownAnalytics: () => request('/godown/analytics'),
  getGodownMovements: () => request('/godown/movements'),
  restockGodown: (product_id, quantity) =>
    request('/godown/stock/restock', {
      method: 'POST',
      body: JSON.stringify({ product_id, quantity })
    }),
  addProduct: (productData) =>
    request('/godown/products', {
      method: 'POST',
      body: JSON.stringify(productData)
    }),
  processOrder: (orderId, action, fulfillmentItems, reason) =>
    request(`/godown/orders/${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify({ action, fulfillmentItems, reason })
    })
};
