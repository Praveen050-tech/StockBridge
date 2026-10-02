const { memoryDb } = require('../config/db');
const { createOrder, adjustShopStock } = require('../services/order.service');

/**
 * GET /api/shop/stock
 * Returns all products carried by the shop, on-hand quantity, reorder threshold,
 * and low-stock urgency flags.
 */
async function getShopStock(req, res) {
  try {
    const shopUserId = req.user.id;
    const godownId = req.user.godown_id || 1;

    // Get all shop stock rows
    const stocks = memoryDb.shop_stock.filter(s => s.shop_user_id === shopUserId);
    
    // Ensure all products from the godown catalog exist in shop_stock view
    const godownProducts = memoryDb.products.filter(p => p.godown_id === godownId);

    const items = godownProducts.map(product => {
      let stock = stocks.find(s => s.product_id === product.id);
      const onHand = stock ? parseFloat(stock.quantity_on_hand) : 0;
      const threshold = stock ? parseFloat(stock.reorder_threshold) : 10;
      const isLowStock = onHand <= threshold;
      
      // Calculate urgency score (lower ratio = higher urgency)
      const ratio = threshold > 0 ? onHand / threshold : 1;
      let urgency = 'normal';
      if (onHand === 0) urgency = 'critical';
      else if (ratio <= 0.5) urgency = 'high';
      else if (ratio <= 1.0) urgency = 'medium';

      return {
        product_id: product.id,
        name: product.name,
        category: product.category,
        unit: product.unit,
        price_per_unit: parseFloat(product.price_per_unit),
        quantity_on_hand: onHand,
        reorder_threshold: threshold,
        is_low_stock: isLowStock,
        urgency,
        urgency_score: ratio,
        last_updated: stock ? stock.last_updated : product.created_at
      };
    });

    // Summary KPIs
    const totalProducts = items.length;
    const lowStockCount = items.filter(i => i.is_low_stock).length;
    const criticalCount = items.filter(i => i.urgency === 'critical').length;
    const totalInventoryValue = items.reduce((sum, i) => sum + (i.quantity_on_hand * i.price_per_unit), 0);

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalProducts,
          lowStockCount,
          criticalCount,
          totalInventoryValue: parseFloat(totalInventoryValue.toFixed(2))
        },
        items: items.sort((a, b) => a.urgency_score - b.urgency_score) // Low stock first
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * PATCH /api/shop/stock/:productId
 * Manual stock adjustment (e.g. sale, wastage, manual audit count)
 */
async function updateStock(req, res) {
  try {
    const shopUserId = req.user.id;
    const { productId } = req.params;
    const { delta, reason, customThreshold } = req.body;

    const result = await adjustShopStock({
      shopUserId,
      productId,
      delta: delta !== undefined ? delta : 0,
      reason: reason || 'adjustment',
      customThreshold
    });

    return res.status(200).json({
      success: true,
      message: 'Shop stock successfully updated',
      data: result
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/shop/orders
 * Places a restock order to the linked godown
 */
async function placeOrder(req, res) {
  try {
    const shopUserId = req.user.id;
    const godownId = req.user.godown_id || req.body.godown_id || 1;
    const { items } = req.body;

    const order = await createOrder({
      shopUserId,
      godownId,
      items
    });

    return res.status(201).json({
      success: true,
      message: `Restock order #${order.id} placed successfully with status: ${order.status}`,
      order
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/shop/orders
 * Returns all historical orders placed by this shop
 */
async function getOrders(req, res) {
  try {
    const shopUserId = req.user.id;
    const orders = memoryDb.orders
      .filter(o => o.shop_user_id === shopUserId)
      .map(o => {
        const items = memoryDb.order_items
          .filter(i => i.order_id === o.id)
          .map(i => {
            const prod = memoryDb.products.find(p => p.id === i.product_id);
            return {
              ...i,
              product_name: prod ? prod.name : `Item #${i.product_id}`,
              unit: prod ? prod.unit : 'unit'
            };
          });

        const godown = memoryDb.godowns.find(g => g.id === o.godown_id);

        return {
          ...o,
          godown_name: godown ? godown.name : `Godown #${o.godown_id}`,
          godown_location: godown ? godown.location : '',
          items
        };
      });

    return res.status(200).json({
      success: true,
      orders: orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/shop/catalog
 * Browse available items from the godown catalog with live availability
 */
async function getCatalog(req, res) {
  try {
    const godownId = req.user.godown_id || 1;
    const products = memoryDb.products.filter(p => p.godown_id === godownId);

    const catalog = products.map(p => {
      const stock = memoryDb.godown_stock.find(s => s.product_id === p.id && s.godown_id === godownId);
      const available = stock ? parseFloat(stock.quantity_available) : 0;
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        unit: p.unit,
        price_per_unit: parseFloat(p.price_per_unit),
        quantity_available: available,
        in_stock: available > 0
      };
    });

    return res.status(200).json({
      success: true,
      catalog
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/shop/movements
 * Audit trail for this shop's stock movements
 */
async function getMovements(req, res) {
  try {
    const shopUserId = req.user.id;
    const movements = memoryDb.stock_movements
      .filter(m => m.shop_user_id === shopUserId)
      .map(m => {
        const prod = memoryDb.products.find(p => p.id === m.product_id);
        return {
          ...m,
          product_name: prod ? prod.name : `Product #${m.product_id}`,
          unit: prod ? prod.unit : 'unit'
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.status(200).json({ success: true, movements });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getShopStock,
  updateStock,
  placeOrder,
  getOrders,
  getCatalog,
  getMovements
};
