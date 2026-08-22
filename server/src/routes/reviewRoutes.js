const express = require('express');
const reviewController = require('../controllers/reviewController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// Public route to view reviews for a product
router.get('/product/:productId', reviewController.getProductReviews);

// Protected route to write a review
router.post('/', protect, restrictTo('BUYER'), reviewController.createReview);

module.exports = router;
