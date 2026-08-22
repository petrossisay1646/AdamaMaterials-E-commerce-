const express = require('express');
const disputeController = require('../controllers/disputeController');
const { protect, restrictTo, hasPermission } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// Buyer opens a dispute
router.post('/', restrictTo('BUYER'), disputeController.createDispute);

// Buyers and sellers retrieve their relevant disputes
router.get('/my', disputeController.getMyDisputes);

// Staff/Admin retrieve list
router.get(
  '/',
  restrictTo('ADMIN', 'STAFF'),
  hasPermission('VIEW_DISPUTES'),
  disputeController.getAllDisputes
);

// Admins ONLY resolve disputes (Rule 8)
router.post('/resolve', restrictTo('ADMIN'), disputeController.resolveDispute);

module.exports = router;
