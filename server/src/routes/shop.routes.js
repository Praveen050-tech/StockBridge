const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shop.controller');
const { authenticateToken, requireRole } = require('../middleware/auth');

// All shop routes require shop_owner role
router.use(authenticateToken, requireRole(['shop_owner']));

router.get('/stock', shopController.getShopStock);
router.patch('/stock/:productId', shopController.updateStock);
router.post('/orders', shopController.placeOrder);
router.get('/orders', shopController.getOrders);
router.get('/catalog', shopController.getCatalog);
router.get('/movements', shopController.getMovements);

module.exports = router;
