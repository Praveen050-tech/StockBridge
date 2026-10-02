-- =========================================================================
-- StockBridge: B2B Godown & Shop Stock Logistics Network
-- Full MySQL DDL Schema with Foreign Keys, Cascades, Indexes & Audit Trail
-- =========================================================================

CREATE DATABASE IF NOT EXISTS stockbridge_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE stockbridge_db;

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('shop_owner', 'godown_admin') NOT NULL DEFAULT 'shop_owner',
  godown_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_godown (godown_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. GODOWNS TABLE
CREATE TABLE IF NOT EXISTS godowns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  location VARCHAR(255) NOT NULL,
  admin_user_id INT NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_godowns_admin FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign key from users.godown_id to godowns.id (Shop -> Linked Godown)
ALTER TABLE users 
ADD CONSTRAINT fk_users_godown FOREIGN KEY (godown_id) REFERENCES godowns(id) ON DELETE SET NULL;

-- 3. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  godown_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(100) NOT NULL,
  unit VARCHAR(30) NOT NULL, -- 'kg', 'l', 'pcs', 'box', 'packet'
  price_per_unit DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_products_godown (godown_id),
  CONSTRAINT fk_products_godown FOREIGN KEY (godown_id) REFERENCES godowns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. GODOWN_STOCK TABLE
CREATE TABLE IF NOT EXISTS godown_stock (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL UNIQUE,
  godown_id INT NOT NULL,
  quantity_available DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  last_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_godown_stock_godown (godown_id),
  CONSTRAINT fk_godown_stock_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_godown_stock_godown FOREIGN KEY (godown_id) REFERENCES godowns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. SHOP_STOCK TABLE
CREATE TABLE IF NOT EXISTS shop_stock (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shop_user_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity_on_hand DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  reorder_threshold DECIMAL(12, 2) NOT NULL DEFAULT 10.00,
  last_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_shop_product (shop_user_id, product_id),
  INDEX idx_shop_stock_user (shop_user_id),
  INDEX idx_shop_stock_product (product_id),
  CONSTRAINT fk_shop_stock_user FOREIGN KEY (shop_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_shop_stock_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shop_user_id INT NOT NULL,
  godown_id INT NOT NULL,
  status ENUM('pending', 'approved', 'partially_fulfilled', 'dispatched', 'delivered', 'rejected') NOT NULL DEFAULT 'pending',
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_orders_shop (shop_user_id),
  INDEX idx_orders_godown (godown_id),
  INDEX idx_orders_status (status),
  CONSTRAINT fk_orders_shop FOREIGN KEY (shop_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_orders_godown FOREIGN KEY (godown_id) REFERENCES godowns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. ORDER_ITEMS TABLE
CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  qty_requested DECIMAL(12, 2) NOT NULL,
  qty_fulfilled DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  INDEX idx_order_items_order (order_id),
  INDEX idx_order_items_product (product_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. STOCK_MOVEMENTS TABLE (AUDIT TRAIL)
CREATE TABLE IF NOT EXISTS stock_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  godown_id INT NULL,
  shop_user_id INT NULL,
  movement_type ENUM('restock_in', 'dispatch_out', 'sale', 'adjustment', 'damage') NOT NULL,
  quantity DECIMAL(12, 2) NOT NULL,
  reference_order_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_movements_product (product_id),
  INDEX idx_movements_godown (godown_id),
  INDEX idx_movements_shop (shop_user_id),
  INDEX idx_movements_order (reference_order_id),
  CONSTRAINT fk_movements_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_movements_godown FOREIGN KEY (godown_id) REFERENCES godowns(id) ON DELETE SET NULL,
  CONSTRAINT fk_movements_shop FOREIGN KEY (shop_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_movements_order FOREIGN KEY (reference_order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
