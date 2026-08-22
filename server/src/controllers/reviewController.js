const Review = require('../models/Review');
const Order = require('../models/Order');
const AppError = require('../utils/appError');
const asyncHandler = require('../utils/asyncHandler');

// 1. Create Product Review
exports.createReview = asyncHandler(async (req, res, next) => {
  const { productId, orderId, rating, comment, images } = req.body;

  if (!productId || !orderId || !rating || !comment) {
    return next(new AppError('Product ID, Order ID, rating, and comment are required.', 400));
  }

  const numRating = Number(rating);
  if (isNaN(numRating) || numRating < 1 || numRating > 5) {
    return next(new AppError('Rating must be between 1 and 5.', 400));
  }

  // Enforce Rule 11: Check if buyer successfully received the product
  const order = await Order.findOne({
    _id: orderId,
    buyer: req.user._id,
    orderStatus: { $in: ['DELIVERED', 'COMPLETED'] },
  });

  if (!order) {
    return next(new AppError('You can only review products from orders that have been successfully delivered to you.', 403));
  }

  // Verify the product was actually in that order
  const itemExists = order.items.some(item => item.product.toString() === productId);
  if (!itemExists) {
    return next(new AppError('This product is not part of the specified order.', 400));
  }

  // Check if review already exists to prevent duplicate reviews
  const existingReview = await Review.findOne({
    order: orderId,
    product: productId,
    buyer: req.user._id,
  });

  if (existingReview) {
    return next(new AppError('You have already submitted a review for this product in this order.', 400));
  }

  // Create Review
  const review = await Review.create({
    product: productId,
    order: orderId,
    buyer: req.user._id,
    rating: numRating,
    comment,
    images: images || [],
  });

  res.status(201).json({
    success: true,
    message: 'Review submitted successfully.',
    review,
  });
});

// 2. Get reviews for a specific product
exports.getProductReviews = asyncHandler(async (req, res, next) => {
  const reviews = await Review.find({ product: req.params.productId })
    .populate('buyer', 'name')
    .sort({ createdAt: -1 });

  // Calculate average rating
  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0 
    ? Number((reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1))
    : 0;

  res.status(200).json({
    success: true,
    count: totalReviews,
    averageRating,
    reviews,
  });
});
