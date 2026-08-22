const express = require('express');
const orderController = require('../controllers/orderController');
const { protect, restrictTo, hasPermission } = require('../middleware/auth');

const router = express.Router();

// Public route — no auth required for delivery fee estimation
router.post('/estimate-delivery-fee', orderController.estimateDeliveryFee);

// All routes below require authentication
// Buyer checkout route
router.post('/checkout', protect, restrictTo('BUYER'), orderController.checkout);

// Common order retrieval routes
router.get('/', protect, orderController.getMyOrders);
router.get('/:id', protect, orderController.getOrderDetails);

// Staff/Admin update status route (State machine transition)
router.put(
  '/:id/status',
  protect,
  restrictTo('ADMIN', 'STAFF'),
  hasPermission('UPDATE_ORDER_STATUS'),
  orderController.updateOrderStatus
);

module.exports = router;
