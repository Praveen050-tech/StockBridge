/**
 * Database client configuration with Prisma & In-Memory / MySQL fallback.
 * Supports Prisma transactions (prisma.$transaction) as specified.
 */
let prisma = null;
let useMock = false;

// Attempt to load PrismaClient
try {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient();
} catch (e) {
  // Prisma client not yet generated, will use in-memory transactional mock engine
  prisma = null;
  useMock = true;
}

// In-Memory Database Store for testing and offline fallback
const memoryDb = {
  users: [
    {
      id: 1,
      name: 'Ramesh Sundaram (Central Godown)',
      phone: '9840123456',
      email: 'godown@stockbridge.io',
      password_hash: '$2a$10$wK1mJj11r2pI0jS/WvL2feXkHkM0yV1Vz.wE1.069M9j/k5Msq5y.', // 'admin123'
      role: 'godown_admin',
      godown_id: null,
      created_at: new Date('2026-01-10')
    },
    {
      id: 2,
      name: 'Murugan Kirana & Provisions',
      phone: '9840987654',
      email: 'shop@stockbridge.io',
      password_hash: '$2a$10$wK1mJj11r2pI0jS/WvL2feXkHkM0yV1Vz.wE1.069M9j/k5Msq5y.', // 'shop123'
      role: 'shop_owner',
      godown_id: 1,
      created_at: new Date('2026-01-15')
    },
    {
      id: 3,
      name: 'Lakshmi General Supermarket',
      phone: '9840555123',
      email: 'lakshmi@stockbridge.io',
      password_hash: '$2a$10$wK1mJj11r2pI0jS/WvL2feXkHkM0yV1Vz.wE1.069M9j/k5Msq5y.',
      role: 'shop_owner',
      godown_id: 1,
      created_at: new Date('2026-02-01')
    }
  ],
  godowns: [
    {
      id: 1,
      name: 'Metro Logistics Godown #4',
      location: 'Koyambedu Wholesale Hub, Chennai',
      admin_user_id: 1,
      created_at: new Date('2026-01-10')
    }
  ],
  products: [
    { id: 1, godown_id: 1, name: 'Ponni Boiled Rice (Deluxe)', category: 'Grains & Rice', unit: 'kg', price_per_unit: 58.00, created_at: new Date('2026-01-10') },
    { id: 2, godown_id: 1, name: 'Toor Dal (Premium Unpolished)', category: 'Pulses & Dals', unit: 'kg', price_per_unit: 165.00, created_at: new Date('2026-01-10') },
    { id: 3, godown_id: 1, name: 'Aashirvaad Whole Wheat Atta 5kg', category: 'Flours', unit: 'box', price_per_unit: 275.00, created_at: new Date('2026-01-10') },
    { id: 4, godown_id: 1, name: 'Gold Winner Refined Sunflower Oil 1L', category: 'Oils & Ghee', unit: 'l', price_per_unit: 135.00, created_at: new Date('2026-01-10') },
    { id: 5, godown_id: 1, name: 'Tata Iodized Salt 1kg Packet', category: 'Spices & Essentials', unit: 'box', price_per_unit: 26.00, created_at: new Date('2026-01-10') },
    { id: 6, godown_id: 1, name: 'White Refined Crystal Sugar', category: 'Sugar & Sweeteners', unit: 'kg', price_per_unit: 44.00, created_at: new Date('2026-01-10') },
    { id: 7, godown_id: 1, name: 'Red Chilli Whole (Guntur S4)', category: 'Spices & Essentials', unit: 'kg', price_per_unit: 290.00, created_at: new Date('2026-01-10') },
    { id: 8, godown_id: 1, name: 'Chakra Gold Dust Tea 250g', category: 'Beverages', unit: 'pcs', price_per_unit: 125.00, created_at: new Date('2026-01-10') }
  ],
  godown_stock: [
    { id: 1, product_id: 1, godown_id: 1, quantity_available: 1500.00, last_updated: new Date() },
    { id: 2, product_id: 2, godown_id: 1, quantity_available: 800.00, last_updated: new Date() },
    { id: 3, product_id: 3, godown_id: 1, quantity_available: 240.00, last_updated: new Date() },
    { id: 4, product_id: 4, godown_id: 1, quantity_available: 450.00, last_updated: new Date() },
    { id: 5, product_id: 5, godown_id: 1, quantity_available: 600.00, last_updated: new Date() },
    { id: 6, product_id: 6, godown_id: 1, quantity_available: 1200.00, last_updated: new Date() },
    { id: 7, product_id: 7, godown_id: 1, quantity_available: 18.00, last_updated: new Date() }, // low stock in godown!
    { id: 8, product_id: 8, godown_id: 1, quantity_available: 350.00, last_updated: new Date() }
  ],
  shop_stock: [
    { id: 1, shop_user_id: 2, product_id: 1, quantity_on_hand: 8.50, reorder_threshold: 25.00, last_updated: new Date() }, // Low stock!
    { id: 2, shop_user_id: 2, product_id: 2, quantity_on_hand: 5.00, reorder_threshold: 15.00, last_updated: new Date() }, // Low stock!
    { id: 3, shop_user_id: 2, product_id: 3, quantity_on_hand: 14.00, reorder_threshold: 10.00, last_updated: new Date() },
    { id: 4, shop_user_id: 2, product_id: 4, quantity_on_hand: 6.00, reorder_threshold: 20.00, last_updated: new Date() }, // Low stock!
    { id: 5, shop_user_id: 2, product_id: 5, quantity_on_hand: 32.00, reorder_threshold: 15.00, last_updated: new Date() },
    { id: 6, shop_user_id: 2, product_id: 6, quantity_on_hand: 50.00, reorder_threshold: 20.00, last_updated: new Date() },
    { id: 7, shop_user_id: 2, product_id: 7, quantity_on_hand: 2.00, reorder_threshold: 5.00, last_updated: new Date() },  // Low stock!
    { id: 8, shop_user_id: 2, product_id: 8, quantity_on_hand: 12.00, reorder_threshold: 10.00, last_updated: new Date() }
  ],
  orders: [
    {
      id: 101,
      shop_user_id: 2,
      godown_id: 1,
      status: 'pending',
      total_amount: 3450.00,
      created_at: new Date(Date.now() - 3600000 * 3),
      updated_at: new Date(Date.now() - 3600000 * 3)
    },
    {
      id: 102,
      shop_user_id: 2,
      godown_id: 1,
      status: 'dispatched',
      total_amount: 5800.00,
      created_at: new Date(Date.now() - 86400000 * 2),
      updated_at: new Date(Date.now() - 86400000 * 1)
    }
  ],
  order_items: [
    { id: 1, order_id: 101, product_id: 1, qty_requested: 50.00, qty_fulfilled: 0.00, unit_price: 58.00 },
    { id: 2, order_id: 101, product_id: 7, qty_requested: 20.00, qty_fulfilled: 0.00, unit_price: 290.00 },
    { id: 3, order_id: 102, product_id: 1, qty_requested: 100.00, qty_fulfilled: 100.00, unit_price: 58.00 }
  ],
  stock_movements: [
    { id: 1, product_id: 1, godown_id: 1, shop_user_id: null, movement_type: 'restock_in', quantity: 2000.00, reference_order_id: null, created_at: new Date('2026-01-10') },
    { id: 2, product_id: 1, godown_id: 1, shop_user_id: null, movement_type: 'dispatch_out', quantity: 100.00, reference_order_id: 102, created_at: new Date(Date.now() - 86400000) },
    { id: 3, product_id: 1, godown_id: null, shop_user_id: 2, movement_type: 'restock_in', quantity: 100.00, reference_order_id: 102, created_at: new Date(Date.now() - 86400000) }
  ]
};

async function testConnection() {
  if (prisma) {
    try {
      await prisma.$connect();
      console.log('✅ Connected to MySQL via Prisma ORM');
      return true;
    } catch (err) {
      console.warn('⚠️  Prisma MySQL connection failed (' + err.message + '). Falling back to in-memory transaction engine.');
      useMock = true;
      return false;
    }
  } else {
    console.log('ℹ️  Using integrated in-memory transactional database engine.');
    useMock = true;
    return false;
  }
}

module.exports = {
  prisma,
  memoryDb,
  isMock: () => useMock,
  setMock: (val) => { useMock = val; },
  testConnection
};
