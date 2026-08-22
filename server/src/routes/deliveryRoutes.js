const express = require('express');
const deliveryController = require('../controllers/deliveryController');
const { protect, restrictTo, hasPermission } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(restrictTo('ADMIN', 'STAFF'));

router.get('/', deliveryController.getDeliveries);
router.get('/:id', deliveryController.getDeliveryDetails);

router.post('/set-fee', hasPermission('SET_DELIVERY_FEES'), deliveryController.setDeliveryFee);
router.post('/assign', hasPermission('MANAGE_DELIVERIES'), deliveryController.assignDeliveryStaff);
router.put('/status', deliveryController.updateDeliveryStatus); // internal staff checks inside controller

module.exports = router;
