const Product = require('../models/Product');
const Category = require('../models/Category');
const MaterialType = require('../models/MaterialType');
const AuditLog = require('../models/AuditLog');
const StorageService = require('../services/StorageService');
const AppError = require('../utils/appError');
const asyncHandler = require('../utils/asyncHandler');
const mongoose = require('mongoose');
const { calculateDistanceKm } = require('../config/serviceArea');

// Helper for parsing filters
const buildFilters = async (query) => {
  const filter = {};

  // Public listings are ONLY approved products
  filter.approvalStatus = 'APPROVED';

  // Category filter (support ID or Slug)
  if (query.category) {
    if (mongoose.Types.ObjectId.isValid(query.category)) {
      filter.category = query.category;
    } else {
      const cat = await Category.findOne({ slug: query.category });
      if (cat) filter.category = cat._id;
    }
  }

  // Material type filter (support ID or Slug)
  if (query.materialType) {
    if (mongoose.Types.ObjectId.isValid(query.materialType)) {
      filter.materialType = query.materialType;
    } else {
      const mat = await MaterialType.findOne({ slug: query.materialType });
      if (mat) filter.materialType = mat._id;
    }
  }

  // Condition filter
  if (query.condition) {
    const conditions = Array.isArray(query.condition) ? query.condition : query.condition.split(',');
    filter.condition = { $in: conditions };
  }

  // Price range filter
  if (query.minPrice || query.maxPrice) {
    filter.price = {};
    if (query.minPrice) filter.price.$gte = Number(query.minPrice);
    if (query.maxPrice) filter.price.$lte = Number(query.maxPrice);
  }

  // Text search on name & description
  if (query.search) {
    filter.$text = { $search: query.search };
  }

  // Stock availability
  if (query.inStock === 'true') {
    filter.quantity = { $gt: 0 };
  }

  return filter;
};

// 1. Get all public products (with filters & pagination & location-aware sorting)
exports.getPublicProducts = asyncHandler(async (req, res, next) => {
  const filter = await buildFilters(req.query);

  const { buyerLat, buyerLng, sortBy } = req.query;
  const hasBuyerLocation =
    buyerLat !== undefined &&
    buyerLng !== undefined &&
    !isNaN(Number(buyerLat)) &&
    !isNaN(Number(buyerLng));

  const numBuyerLat = hasBuyerLocation ? Number(buyerLat) : null;
  const numBuyerLng = hasBuyerLocation ? Number(buyerLng) : null;

  // Pagination params
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 12;
  const skip = (page - 1) * limit;

  // Standard MongoDB sorting (if not distance-based)
  let sortOption = { createdAt: -1 };
  if (sortBy === 'price-low') sortOption = { price: 1 };
  if (sortBy === 'price-high') sortOption = { price: -1 };
  if (sortBy === 'newest') sortOption = { createdAt: -1 };

  let products = await Product.find(filter)
    .populate('category', 'name slug')
    .populate('materialType', 'name slug')
    .populate('seller', 'name email sellerProfile.shopName sellerProfile.shopLocation')
    .sort(sortOption);

  // Attach distanceKm to each product if buyer coordinates are available
  let productsWithDistance = products.map((p) => {
    const doc = p.toObject();
    let distanceKm = null;

    const coords = p.seller?.sellerProfile?.shopLocation?.coordinates;
    if (hasBuyerLocation && Array.isArray(coords) && coords.length === 2 && coords[0] && coords[1]) {
      const sellerLng = coords[0];
      const sellerLat = coords[1];
      distanceKm = calculateDistanceKm(numBuyerLat, numBuyerLng, sellerLat, sellerLng);
    }

    doc.distanceKm = distanceKm;
    return doc;
  });

  // If buyer location is provided, default to NEAREST FIRST sorting (or when explicitly requested)
  if (hasBuyerLocation && (!sortBy || sortBy === 'nearest')) {
    productsWithDistance.sort((a, b) => {
      if (a.distanceKm === null && b.distanceKm === null) return 0;
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });
  }

  const total = productsWithDistance.length;
  const paginatedProducts = productsWithDistance.slice(skip, skip + limit);

  res.status(200).json({
    success: true,
    count: paginatedProducts.length,
    total,
    pages: Math.ceil(total / limit),
    page,
    buyerLocation: hasBuyerLocation ? { lat: numBuyerLat, lng: numBuyerLng } : null,
    products: paginatedProducts,
  });
});

// 2. Get Single Product
exports.getProductById = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id)
    .populate('category', 'name slug description')
    .populate('materialType', 'name slug description')
    .populate('seller', 'name email sellerProfile.shopName sellerProfile.shopAddress sellerProfile.shopLocation');

  if (!product) {
    return next(new AppError('Product not found.', 404));
  }

  const isApproved = product.approvalStatus === 'APPROVED';
  const isSeller = req.user && product.seller._id.toString() === req.user._id.toString();
  const isAdminOrStaff = req.user && ['ADMIN', 'STAFF'].includes(req.user.role);

  if (!isApproved && !isSeller && !isAdminOrStaff) {
    return next(new AppError('You do not have permission to view this product.', 403));
  }

  const relatedProducts = await Product.find({
    category: product.category._id,
    approvalStatus: 'APPROVED',
    _id: { $ne: product._id },
  })
    .limit(4)
    .select('name price condition images');

  res.status(200).json({
    success: true,
    product,
    relatedProducts,
  });
});

// ================= SELLER PRODUCT CONTROLLERS =================

// Create Product (defaults to DRAFT)
exports.createProduct = asyncHandler(async (req, res, next) => {
  const { name, description, price, quantity, category, materialType, condition, location, images } = req.body;

  if (!images || images.length === 0) {
    return next(new AppError('At least one product image is required.', 400));
  }

  const newProduct = await Product.create({
    name,
    description,
    price,
    quantity,
    category,
    materialType,
    condition,
    images,
    seller: req.user._id,
    approvalStatus: 'DRAFT',
    location: location || { subCity: 'Adama Kebele 04', city: 'Adama' },
  });

  res.status(201).json({
    success: true,
    product: newProduct,
  });
});

// Get seller's own products
exports.getMyProducts = asyncHandler(async (req, res, next) => {
  const products = await Product.find({ seller: req.user._id })
    .populate('category', 'name slug')
    .populate('materialType', 'name slug')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: products.length,
    products,
  });
});

// Edit Product
exports.updateProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError('Product not found.', 404));
  }

  if (product.seller.toString() !== req.user._id.toString()) {
    return next(new AppError('You do not own this product.', 403));
  }

  if (['APPROVED', 'PENDING_APPROVAL'].includes(product.approvalStatus)) {
    product.approvalStatus = 'DRAFT';
  }

  const updatedProduct = await Product.findByIdAndUpdate(
    req.params.id,
    { ...req.body, seller: req.user._id, approvalStatus: product.approvalStatus },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    message: 'Product updated and moved to DRAFT. Please submit for approval.',
    product: updatedProduct,
  });
});

// Delete Product
exports.deleteProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError('Product not found.', 404));
  }

  if (product.seller.toString() !== req.user._id.toString()) {
    return next(new AppError('You do not own this product.', 403));
  }

  await product.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Product deleted successfully.',
  });
});

// Submit Product for Review
exports.submitForReview = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError('Product not found.', 404));
  }

  if (product.seller.toString() !== req.user._id.toString()) {
    return next(new AppError('You do not own this product.', 403));
  }

  if (product.approvalStatus === 'APPROVED') {
    return next(new AppError('This product is already approved.', 400));
  }

  product.approvalStatus = 'PENDING_APPROVAL';
  await product.save();

  res.status(200).json({
    success: true,
    message: 'Product submitted for administrator review.',
    product,
  });
});

// Upload Product Images
exports.uploadImages = asyncHandler(async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next(new AppError('Please select at least one image file.', 400));
  }

  const uploadPromises = req.files.map((file) => StorageService.uploadImage(file));
  const imageUrls = await Promise.all(uploadPromises);

  res.status(200).json({
    success: true,
    message: `${imageUrls.length} images uploaded successfully.`,
    urls: imageUrls,
  });
});

// Backward-compatible route aliases
exports.getProductDetails = exports.getProductById;
exports.submitForApproval = exports.submitForReview;
exports.uploadProductImages = exports.uploadImages;