const { memoryDb } = require('../config/db');
const {
  dispatchOrder,
  rejectOrder,
  approveOrder,
  restockGodown
} = require('../services/order.service');

/**
 * GET /api/godown/stock
 * Master inventory for the godown with stock levels and low-stock alerts
 */
async function getGodownStock(req, res) {
  try {
    const godownId = req.user.godown_id || 1;
    const products = memoryDb.products.filter(p => p.godown_id === godownId);

    const items = products.map(product => {
      const stockRow = memoryDb.godown_stock.find(
        s => s.product_id === product.id && s.godown_id === godownId
      );
      const available = stockRow ? parseFloat(stockRow.quantity_available) : 0;
      
      // Godown safety stock alert threshold (e.g. 50 kg/units)
      const godownSafetyThreshold = 50.0;
      const isLowStock = available < godownSafetyThreshold;

      return {
        product_id: product.id,
        name: product.name,
        category: product.category,
        unit: product.unit,
        price_per_unit: parseFloat(product.price_per_unit),
        quantity_available: available,
        is_low_stock: isLowStock,
        safety_threshold: godownSafetyThreshold,
        last_updated: stockRow ? stockRow.last_updated : product.created_at
      };
    });

    const totalProducts = items.length;
    const lowStockCount = items.filter(i => i.is_low_stock).length;
    const totalInventoryValue = items.reduce((sum, i) => sum + (i.quantity_available * i.price_per_unit), 0);

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalProducts,
          lowStockCount,
          totalInventoryValue: parseFloat(totalInventoryValue.toFixed(2))
        },
        items: items.sort((a, b) => a.quantity_available - b.quantity_available)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/godown/stock/restock
 * Add new deliveries into the godown from suppliers
 */
async function restockStock(req, res) {
  try {
    const godownId = req.user.godown_id || 1;
    const { product_id, quantity } = req.body;

    if (!product_id || !quantity) {
      return res.status(400).json({ success: false, message: 'product_id and quantity are required.' });
    }

    const result = await restockGodown({
      godownId,
      productId: product_id,
      quantityAdded: quantity
    });

    return res.status(200).json({
      success: true,
      message: `Successfully restocked ${quantity} units for product #${product_id}`,
      data: result
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/godown/products
 * Add new product to master catalog
 */
async function addProduct(req, res) {
  try {
    const godownId = req.user.godown_id || 1;
    const { name, category, unit, price_per_unit, initial_stock } = req.body;

    if (!name || !category || !unit || !price_per_unit) {
      return res.status(400).json({ success: false, message: 'Name, category, unit, and price are required.' });
    }

    const newProdId = memoryDb.products.length ? Math.max(...memoryDb.products.map(p => p.id)) + 1 : 1;
    const newProduct = {
      id: newProdId,
      godown_id: godownId,
      name,
      category,
      unit,
      price_per_unit: parseFloat(price_per_unit),
      created_at: new Date()
    };
    memoryDb.products.push(newProduct);

    // Initial stock
    const initQty = parseFloat(initial_stock || 0);
    const stockRow = {
      id: memoryDb.godown_stock.length + 1,
      product_id: newProdId,
      godown_id: godownId,
      quantity_available: initQty,
      last_updated: new Date()
    };
    memoryDb.godown_stock.push(stockRow);

    if (initQty > 0) {
      memoryDb.stock_movements.push({
        id: memoryDb.stock_movements.length + 1,
        product_id: newProdId,
        godown_id: godownId,
        shop_user_id: null,
        movement_type: 'restock_in',
        quantity: initQty,
        reference_order_id: null,
        created_at: new Date()
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Product added to master catalog',
      product: newProduct,
      stock: stockRow
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/godown/orders
 * Retrieve all incoming shop orders, filterable by status
 */
async function getOrders(req, res) {
  try {
    const godownId = req.user.godown_id || 1;
    const { status } = req.query;

    let orders = memoryDb.orders.filter(o => o.godown_id === godownId);

    if (status && status !== 'all') {
      orders = orders.filter(o => o.status === status);
    }

    const detailedOrders = orders.map(o => {
      const shopUser = memoryDb.users.find(u => u.id === o.shop_user_id);
      const items = memoryDb.order_items
        .filter(i => i.order_id === o.id)
        .map(i => {
          const product = memoryDb.products.find(p => p.id === i.product_id);
          const stockRow = memoryDb.godown_stock.find(
            s => s.product_id === i.product_id && s.godown_id === godownId
          );
          const availableInGodown = stockRow ? parseFloat(stockRow.quantity_available) : 0;
          return {
            ...i,
            product_name: product ? product.name : `Product #${i.product_id}`,
            unit: product ? product.unit : 'unit',
            godown_available: availableInGodown,
            can_fully_fulfill: availableInGodown >= parseFloat(i.qty_requested)
          };
        });

      return {
        ...o,
        shop_name: shopUser ? shopUser.name : `Shop #${o.shop_user_id}`,
        shop_phone: shopUser ? shopUser.phone : '',
        shop_email: shopUser ? shopUser.email : '',
        items
      };
    });

    return res.status(200).json({
      success: true,
      orders: detailedOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * PATCH /api/godown/orders/:orderId
 * Dispatches, partially fulfills, approves, or rejects an incoming order
 */
async function processOrder(req, res) {
  try {
    const { orderId } = req.params;
    const { action, fulfillmentItems, reason } = req.body;
    const adminUserId = req.user.id;

    if (!action) {
      return res.status(400).json({
        success: false,
        message: 'Action is required. Must be "dispatch", "approve", or "reject".'
      });
    }

    if (action === 'dispatch') {
      // Core transactional dispatch logic
      const result = await dispatchOrder({
        orderId,
        fulfillmentItems,
        adminUserId
      });
      return res.status(200).json(result);
    } else if (action === 'approve') {
      const result = await approveOrder({ orderId });
      return res.status(200).json(result);
    } else if (action === 'reject') {
      const result = await rejectOrder({ orderId, reason });
      return res.status(200).json(result);
    } else {
      return res.status(400).json({ success: false, message: `Unsupported action "${action}".` });
    }
  } catch (err) {
    console.error('Error processing order in godown:', err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/godown/analytics
 * Demand trends: Most-ordered products, fastest-depleting stock, shop distribution
 */
async function getAnalytics(req, res) {
  try {
    const godownId = req.user.godown_id || 1;
    const products = memoryDb.products.filter(p => p.godown_id === godownId);

    // Aggregate orders & order_items
    const productStats = {};
    products.forEach(p => {
      productStats[p.id] = {
        id: p.id,
        name: p.name,
        category: p.category,
        unit: p.unit,
        total_requested: 0,
        total_fulfilled: 0,
        order_count: 0,
        current_stock: 0
      };
      const s = memoryDb.godown_stock.find(s => s.product_id === p.id && s.godown_id === godownId);
      if (s) productStats[p.id].current_stock = parseFloat(s.quantity_available);
    });

    memoryDb.order_items.forEach(item => {
      if (productStats[item.product_id]) {
        productStats[item.product_id].total_requested += parseFloat(item.qty_requested);
        productStats[item.product_id].total_fulfilled += parseFloat(item.qty_fulfilled);
        productStats[item.product_id].order_count += 1;
      }
    });

    const topDemanded = Object.values(productStats)
      .sort((a, b) => b.total_requested - a.total_requested);

    // Shop activity breakdown
    const shopBreakdown = {};
    memoryDb.orders.filter(o => o.godown_id === godownId).forEach(o => {
      const shop = memoryDb.users.find(u => u.id === o.shop_user_id);
      const name = shop ? shop.name : `Shop #${o.shop_user_id}`;
      if (!shopBreakdown[name]) {
        shopBreakdown[name] = { shopName: name, totalOrders: 0, totalAmount: 0 };
      }
      shopBreakdown[name].totalOrders += 1;
      shopBreakdown[name].totalAmount += parseFloat(o.total_amount);
    });

    // Recent stock movement velocity (dispatches vs restocks)
    const recentMovements = memoryDb.stock_movements
      .filter(m => m.godown_id === godownId)
      .slice(-15)
      .reverse();

    return res.status(200).json({
      success: true,
      data: {
        topDemanded,
        shopBreakdown: Object.values(shopBreakdown),
        recentMovements
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/godown/movements
 * Master audit trail
 */
async function getMovements(req, res) {
  try {
    const godownId = req.user.godown_id || 1;
    const movements = memoryDb.stock_movements
      .filter(m => m.godown_id === godownId || m.reference_order_id !== null)
      .map(m => {
        const prod = memoryDb.products.find(p => p.id === m.product_id);
        const shop = m.shop_user_id ? memoryDb.users.find(u => u.id === m.shop_user_id) : null;
        return {
          ...m,
          product_name: prod ? prod.name : `Product #${m.product_id}`,
          unit: prod ? prod.unit : 'unit',
          shop_name: shop ? shop.name : null
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.status(200).json({ success: true, movements });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getGodownStock,
  restockStock,
  addProduct,
  getOrders,
  processOrder,
  getAnalytics,
  getMovements
};
