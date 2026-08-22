const express = require('express');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/google', authController.googleAuth);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refresh);

// Protected routes
router.use(protect);

router.get('/me', authController.getMe);
router.put('/me/update', authController.updateMe);
router.post('/onboarding', authController.completeOnboarding);
router.put('/seller/location', authController.updateSellerLocation);

// Address management
router.get('/me/addresses', authController.getMyAddresses);
router.post('/me/addresses', authController.addAddress);
router.put('/me/addresses/:addressId', authController.updateAddress);
router.delete('/me/addresses/:addressId', authController.deleteAddress);

module.exports = router;

