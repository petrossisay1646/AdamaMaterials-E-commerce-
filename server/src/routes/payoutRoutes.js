const express = require('express');
const payoutController = require('../controllers/payoutController');
const { protect, restrictTo, hasPermission } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// Seller dashboard routes
router.get('/my/listings', restrictTo('SELLER'), payoutController.getMyPayouts);

// Staff / Admin routes
router.get(
  '/',
  restrictTo('ADMIN', 'STAFF'),
  hasPermission('VIEW_SELLER_PAYOUTS'),
  payoutController.getAllPayouts
);

router.post(
  '/process',
  restrictTo('ADMIN', 'STAFF'),
  hasPermission('PROCESS_PAYOUTS'),
  payoutController.processPayout
);

module.exports = router;
