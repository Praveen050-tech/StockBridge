const express = require('express');
const router = express.Router();
const godownController = require('../controllers/godown.controller');
const { authenticateToken, requireRole } = require('../middleware/auth');

// All godown routes require godown_admin role
router.use(authenticateToken, requireRole(['godown_admin']));

router.get('/stock', godownController.getGodownStock);
router.post('/stock/restock', godownController.restockStock);
router.post('/products', godownController.addProduct);
router.get('/orders', godownController.getOrders);
router.patch('/orders/:orderId', godownController.processOrder);
router.get('/analytics', godownController.getAnalytics);
router.get('/movements', godownController.getMovements);

module.exports = router;
