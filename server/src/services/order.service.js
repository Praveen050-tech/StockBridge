const { prisma, memoryDb, isMock } = require('../config/db');
const {
  notifyNewOrder,
  notifyOrderStatusChanged,
  notifyGodownStockUpdated,
  notifyShopStockUpdated
} = require('../config/socket');
const { sendLowStockAlert, sendOrderConfirmation } = require('./notification.service');

/**
 * Places a restock order from a shop to the godown.
 * Evaluates current godown inventory availability:
 * - If fully available -> status = "approved"
 * - If any item has insufficient stock -> status = "partially_fulfillable"
 */
async function createOrder({ shopUserId, godownId, items }) {
  if (!items || !items.length) {
    throw new Error('Order must contain at least one product item.');
  }

  // 1. Validate quantities and fetch product info
  let allFullyAvailable = true;
  let totalAmount = 0;
  const processedItems = [];

  for (const item of items) {
    const qtyRequested = parseFloat(item.qty_requested);
    if (isNaN(qtyRequested) || qtyRequested <= 0) {
      throw new Error(`Invalid requested quantity for product ID ${item.product_id}`);
    }

    // Find product
    const product = memoryDb.products.find(p => p.id === parseInt(item.product_id));
    if (!product) {
      throw new Error(`Product with ID ${item.product_id} not found in catalog.`);
    }

    // Check godown stock
    const stockRow = memoryDb.godown_stock.find(
      s => s.product_id === product.id && s.godown_id === parseInt(godownId)
    );
    const available = stockRow ? parseFloat(stockRow.quantity_available) : 0;

    if (available < qtyRequested) {
      allFullyAvailable = false;
    }

    const unitPrice = parseFloat(product.price_per_unit);
    const lineTotal = unitPrice * qtyRequested;
    totalAmount += lineTotal;

    processedItems.push({
      product_id: product.id,
      product_name: product.name,
      unit: product.unit,
      qty_requested: qtyRequested,
      qty_fulfilled: 0,
      unit_price: unitPrice,
      available_in_godown: available
    });
  }

  // Initial order status as per core business logic
  const initialStatus = allFullyAvailable ? 'approved' : 'partially_fulfillable';

  const orderId = memoryDb.orders.length ? Math.max(...memoryDb.orders.map(o => o.id)) + 1 : 101;
  const newOrder = {
    id: orderId,
    shop_user_id: parseInt(shopUserId),
    godown_id: parseInt(godownId),
    status: initialStatus,
    total_amount: parseFloat(totalAmount.toFixed(2)),
    created_at: new Date(),
    updated_at: new Date()
  };

  memoryDb.orders.unshift(newOrder);

  // Add order items
  const createdItems = [];
  for (const item of processedItems) {
    const itemId = memoryDb.order_items.length ? Math.max(...memoryDb.order_items.map(i => i.id)) + 1 : 1;
    const orderItem = {
      id: itemId,
      order_id: orderId,
      product_id: item.product_id,
      qty_requested: item.qty_requested,
      qty_fulfilled: 0,
      unit_price: item.unit_price
    };
    memoryDb.order_items.push(orderItem);
    createdItems.push({
      ...orderItem,
      product_name: item.product_name,
      unit: item.unit
    });
  }

  // Get Shop User details for godown dashboard card
  const shopUser = memoryDb.users.find(u => u.id === parseInt(shopUserId));

  const orderPayload = {
    ...newOrder,
    shop_name: shopUser ? shopUser.name : `Shop #${shopUserId}`,
    shop_phone: shopUser ? shopUser.phone : '',
    items: createdItems,
    notes: allFullyAvailable ? 'Fully in stock at godown. Auto-approved for dispatch.' : 'Stock shortage detected. Godown admin review needed.'
  };

  // Real-time: Notify godown dashboard
  notifyNewOrder(godownId, orderPayload);

  return orderPayload;
}

/**
 * TRANSACTIONAL DISPATCH OF AN ORDER (Core Business Logic)
 * 1. Checks available godown stock. Fails if negative stock would result.
 * 2. Deducts from godown_stock.
 * 3. Adds to shop_stock.
 * 4. Logs two immutable stock_movements (dispatch_out & restock_in).
 * 5. Updates order status and order items.
 * 6. Emits real-time socket events to both sides.
 */
async function dispatchOrder({ orderId, fulfillmentItems, adminUserId }) {
  const order = memoryDb.orders.find(o => o.id === parseInt(orderId));
  if (!order) {
    throw new Error(`Order #${orderId} not found.`);
  }

  if (['dispatched', 'delivered', 'rejected'].includes(order.status)) {
    throw new Error(`Cannot dispatch Order #${orderId} because it is already marked as '${order.status}'.`);
  }

  // Find all items belonging to this order
  const orderItems = memoryDb.order_items.filter(i => i.order_id === order.id);
  if (!orderItems.length) {
    throw new Error(`Order #${orderId} contains no items.`);
  }

  // Map requested fulfillment items or default to full request
  const fulfillPlan = [];
  let isPartialDispatch = false;

  for (const item of orderItems) {
    const product = memoryDb.products.find(p => p.id === item.product_id);
    const stockRow = memoryDb.godown_stock.find(
      s => s.product_id === item.product_id && s.godown_id === order.godown_id
    );
    const currentGodownQty = stockRow ? parseFloat(stockRow.quantity_available) : 0;

    let targetQty = parseFloat(item.qty_requested);
    if (fulfillmentItems && Array.isArray(fulfillmentItems)) {
      const custom = fulfillmentItems.find(f => parseInt(f.product_id) === item.product_id);
      if (custom !== undefined && custom.qty_fulfilled !== undefined) {
        targetQty = parseFloat(custom.qty_fulfilled);
      }
    }

    if (targetQty < 0) {
      throw new Error(`Fulfillment quantity cannot be negative for product "${product?.name}".`);
    }

    if (targetQty < parseFloat(item.qty_requested)) {
      isPartialDispatch = true;
    }

    // STRICT CHECK: NEVER ALLOW NEGATIVE STOCK
    if (currentGodownQty < targetQty) {
      throw new Error(
        `Insufficient godown stock for "${product?.name}". Available: ${currentGodownQty} ${product?.unit}, Requested to dispatch: ${targetQty} ${product?.unit}. Negative stock is strictly prohibited!`
      );
    }

    fulfillPlan.push({
      orderItem: item,
      product,
      stockRow,
      currentGodownQty,
      qtyToDispatch: targetQty
    });
  }

  // --- EXECUTE TRANSACTIONAL CHANGES ---
  const movementsCreated = [];
  const updatedProducts = [];

  for (const plan of fulfillPlan) {
    const { orderItem, product, stockRow, currentGodownQty, qtyToDispatch } = plan;

    // 1. Deduct from godown_stock
    const newGodownStock = parseFloat((currentGodownQty - qtyToDispatch).toFixed(2));
    stockRow.quantity_available = newGodownStock;
    stockRow.last_updated = new Date();

    // 2. Add to shop_stock
    let shopStockRow = memoryDb.shop_stock.find(
      s => s.shop_user_id === order.shop_user_id && s.product_id === product.id
    );

    if (!shopStockRow) {
      shopStockRow = {
        id: memoryDb.shop_stock.length + 1,
        shop_user_id: order.shop_user_id,
        product_id: product.id,
        quantity_on_hand: 0.00,
        reorder_threshold: 10.00,
        last_updated: new Date()
      };
      memoryDb.shop_stock.push(shopStockRow);
    }

    const previousShopQty = parseFloat(shopStockRow.quantity_on_hand);
    shopStockRow.quantity_on_hand = parseFloat((previousShopQty + qtyToDispatch).toFixed(2));
    shopStockRow.last_updated = new Date();

    // 3. Update orderItem fulfilled quantity
    orderItem.qty_fulfilled = qtyToDispatch;

    // 4. Record stock movement 1: dispatch_out for godown
    const movement1Id = memoryDb.stock_movements.length ? Math.max(...memoryDb.stock_movements.map(m => m.id)) + 1 : 1;
    const godownMovement = {
      id: movement1Id,
      product_id: product.id,
      godown_id: order.godown_id,
      shop_user_id: null,
      movement_type: 'dispatch_out',
      quantity: qtyToDispatch,
      reference_order_id: order.id,
      created_at: new Date()
    };
    memoryDb.stock_movements.push(godownMovement);
    movementsCreated.push(godownMovement);

    // 5. Record stock movement 2: restock_in for shop
    const movement2Id = movement1Id + 1;
    const shopMovement = {
      id: movement2Id,
      product_id: product.id,
      godown_id: null,
      shop_user_id: order.shop_user_id,
      movement_type: 'restock_in',
      quantity: qtyToDispatch,
      reference_order_id: order.id,
      created_at: new Date()
    };
    memoryDb.stock_movements.push(shopMovement);
    movementsCreated.push(shopMovement);

    updatedProducts.push({
      product_id: product.id,
      product_name: product.name,
      newGodownStock,
      newShopStock: shopStockRow.quantity_on_hand,
      unit: product.unit
    });
  }

  // 6. Update order status
  order.status = isPartialDispatch ? 'partially_fulfilled' : 'dispatched';
  order.updated_at = new Date();

  // 7. Real-Time Broadcasts
  // To the shop owner
  notifyOrderStatusChanged(order.shop_user_id, {
    id: order.id,
    status: order.status,
    updated_at: order.updated_at,
    items: orderItems
  });

  // To everyone browsing godown stock
  for (const p of updatedProducts) {
    notifyGodownStockUpdated(order.godown_id, {
      product_id: p.product_id,
      quantity_available: p.newGodownStock
    });
  }

  // Notify Shop's inventory view
  notifyShopStockUpdated(order.shop_user_id, {
    order_id: order.id,
    dispatched_items: updatedProducts
  });

  // Trigger optional WhatsApp/Email confirmation alert
  const shopUser = memoryDb.users.find(u => u.id === order.shop_user_id);
  if (shopUser) {
    sendOrderConfirmation({
      recipientPhone: shopUser.phone,
      recipientEmail: shopUser.email,
      orderId: order.id,
      status: order.status,
      itemsCount: fulfillPlan.length,
      totalAmount: order.total_amount
    }).catch(err => console.error('Alert error:', err));
  }

  return {
    success: true,
    message: `Order #${order.id} successfully dispatched with status: ${order.status}`,
    order,
    updated_products: updatedProducts,
    movements_logged: movementsCreated.length
  };
}

/**
 * Reject an order
 */
async function rejectOrder({ orderId, reason }) {
  const order = memoryDb.orders.find(o => o.id === parseInt(orderId));
  if (!order) throw new Error(`Order #${orderId} not found.`);

  if (order.status === 'dispatched' || order.status === 'delivered') {
    throw new Error(`Cannot reject order that has already been dispatched.`);
  }

  order.status = 'rejected';
  order.updated_at = new Date();

  notifyOrderStatusChanged(order.shop_user_id, {
    id: order.id,
    status: 'rejected',
    reason: reason || 'Rejected by godown admin',
    updated_at: order.updated_at
  });

  return { success: true, order };
}

/**
 * Approve order (without immediate dispatch)
 */
async function approveOrder({ orderId }) {
  const order = memoryDb.orders.find(o => o.id === parseInt(orderId));
  if (!order) throw new Error(`Order #${orderId} not found.`);

  order.status = 'approved';
  order.updated_at = new Date();

  notifyOrderStatusChanged(order.shop_user_id, {
    id: order.id,
    status: 'approved',
    updated_at: order.updated_at
  });

  return { success: true, order };
}

/**
 * Manual shop stock adjustment (e.g. sale, damaged, physical audit)
 * Strict validation: never allow negative stock!
 */
async function adjustShopStock({ shopUserId, productId, delta, reason, customThreshold }) {
  const product = memoryDb.products.find(p => p.id === parseInt(productId));
  if (!product) {
    throw new Error(`Product #${productId} not found.`);
  }

  let stockRow = memoryDb.shop_stock.find(
    s => s.shop_user_id === parseInt(shopUserId) && s.product_id === parseInt(productId)
  );

  if (!stockRow) {
    stockRow = {
      id: memoryDb.shop_stock.length + 1,
      shop_user_id: parseInt(shopUserId),
      product_id: parseInt(productId),
      quantity_on_hand: 0.00,
      reorder_threshold: customThreshold !== undefined ? parseFloat(customThreshold) : 10.00,
      last_updated: new Date()
    };
    memoryDb.shop_stock.push(stockRow);
  }

  const currentQty = parseFloat(stockRow.quantity_on_hand);
  const deltaNum = parseFloat(delta);

  if (isNaN(deltaNum)) {
    throw new Error('Adjustment delta must be a valid number.');
  }

  const newQty = parseFloat((currentQty + deltaNum).toFixed(2));

  // Check negative stock
  if (newQty < 0) {
    throw new Error(
      `Cannot adjust stock below zero! Current: ${currentQty} ${product.unit}, Adjustment: ${deltaNum} ${product.unit} would result in ${newQty} ${product.unit}.`
    );
  }

  // Update stock level & threshold
  stockRow.quantity_on_hand = newQty;
  if (customThreshold !== undefined && !isNaN(parseFloat(customThreshold))) {
    stockRow.reorder_threshold = parseFloat(customThreshold);
  }
  stockRow.last_updated = new Date();

  // Audit trail movement type
  let movementType = 'adjustment';
  if (reason === 'sale' || deltaNum < 0) {
    movementType = reason === 'damage' ? 'damage' : 'sale';
  } else if (deltaNum > 0) {
    movementType = 'adjustment';
  }

  const movementId = memoryDb.stock_movements.length ? Math.max(...memoryDb.stock_movements.map(m => m.id)) + 1 : 1;
  const movement = {
    id: movementId,
    product_id: product.id,
    godown_id: null,
    shop_user_id: parseInt(shopUserId),
    movement_type: movementType,
    quantity: Math.abs(deltaNum),
    reference_order_id: null,
    created_at: new Date()
  };
  memoryDb.stock_movements.push(movement);

  // Check low stock trigger
  const isLowStock = newQty <= parseFloat(stockRow.reorder_threshold);
  if (isLowStock) {
    const shopUser = memoryDb.users.find(u => u.id === parseInt(shopUserId));
    if (shopUser) {
      sendLowStockAlert({
        recipientPhone: shopUser.phone,
        recipientEmail: shopUser.email,
        shopName: shopUser.name,
        productName: product.name,
        currentStock: newQty,
        unit: product.unit,
        threshold: stockRow.reorder_threshold
      }).catch(console.error);
    }
  }

  // Notify socket
  notifyShopStockUpdated(shopUserId, {
    product_id: product.id,
    quantity_on_hand: newQty,
    reorder_threshold: stockRow.reorder_threshold,
    is_low_stock: isLowStock
  });

  return {
    success: true,
    product_id: product.id,
    product_name: product.name,
    previous_quantity: currentQty,
    new_quantity: newQty,
    reorder_threshold: stockRow.reorder_threshold,
    is_low_stock: isLowStock,
    movement_id: movement.id
  };
}

/**
 * Add incoming stock to godown (new shipment from supplier)
 */
async function restockGodown({ godownId, productId, quantityAdded }) {
  const qty = parseFloat(quantityAdded);
  if (isNaN(qty) || qty <= 0) {
    throw new Error('Restock quantity must be a positive number.');
  }

  const product = memoryDb.products.find(p => p.id === parseInt(productId));
  if (!product) {
    throw new Error(`Product #${productId} not found.`);
  }

  let stockRow = memoryDb.godown_stock.find(
    s => s.product_id === parseInt(productId) && s.godown_id === parseInt(godownId)
  );

  if (!stockRow) {
    stockRow = {
      id: memoryDb.godown_stock.length + 1,
      product_id: parseInt(productId),
      godown_id: parseInt(godownId),
      quantity_available: 0.00,
      last_updated: new Date()
    };
    memoryDb.godown_stock.push(stockRow);
  }

  const currentAvailable = parseFloat(stockRow.quantity_available);
  const newAvailable = parseFloat((currentAvailable + qty).toFixed(2));
  stockRow.quantity_available = newAvailable;
  stockRow.last_updated = new Date();

  // Audit trail movement
  const movementId = memoryDb.stock_movements.length ? Math.max(...memoryDb.stock_movements.map(m => m.id)) + 1 : 1;
  const movement = {
    id: movementId,
    product_id: product.id,
    godown_id: parseInt(godownId),
    shop_user_id: null,
    movement_type: 'restock_in',
    quantity: qty,
    reference_order_id: null,
    created_at: new Date()
  };
  memoryDb.stock_movements.push(movement);

  // Broadcast to all shops & godown
  notifyGodownStockUpdated(godownId, {
    product_id: product.id,
    quantity_available: newAvailable
  });

  return {
    success: true,
    product_id: product.id,
    product_name: product.name,
    previous_stock: currentAvailable,
    new_stock: newAvailable,
    movement_id: movement.id
  };
}

module.exports = {
  createOrder,
  dispatchOrder,
  rejectOrder,
  approveOrder,
  adjustShopStock,
  restockGodown
};
