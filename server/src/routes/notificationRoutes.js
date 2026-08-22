const express = require('express');
const notificationController = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', notificationController.getMyNotifications);
router.put('/:id/read', notificationController.markNotificationRead);
router.put('/read-all', notificationController.markAllNotificationsRead);

module.exports = router;
