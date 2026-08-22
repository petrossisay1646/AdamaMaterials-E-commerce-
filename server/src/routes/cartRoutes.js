const express = require('express');
const cartController = require('../controllers/cartController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(restrictTo('BUYER'));

router.get('/', cartController.getCart);
router.post('/add', cartController.addToCart);
router.put('/update', cartController.updateCartItem);
router.post('/remove', cartController.removeFromCart);
router.post('/clear', cartController.clearCart);

module.exports = router;
