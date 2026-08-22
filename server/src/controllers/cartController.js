const Cart = require('../models/Cart');
const Product = require('../models/Product');
const AppError = require('../utils/appError');
const asyncHandler = require('../utils/asyncHandler');

// Helper to get or create user's cart
const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId }).populate('items.product');
  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  }
  return cart;
};

// 1. Get user's cart
exports.getCart = asyncHandler(async (req, res, next) => {
  const cart = await getOrCreateCart(req.user._id);

  // Validate that products are still available and approve state is correct
  let cartModified = false;
  const activeItems = [];

  for (const item of cart.items) {
    if (!item.product || item.product.approvalStatus !== 'APPROVED') {
      cartModified = true;
      continue; // Skip/remove unavailable or rejected products
    }

    // Limit item quantity to available stock
    if (item.quantity > item.product.quantity) {
      item.quantity = item.product.quantity;
      cartModified = true;
    }

    if (item.quantity > 0) {
      activeItems.push(item);
    } else {
      cartModified = true;
    }
  }

  if (cartModified) {
    cart.items = activeItems;
    await cart.save();
  }

  // Calculate subtotals
  const subtotal = cart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  res.status(200).json({
    success: true,
    cart: {
      _id: cart._id,
      items: cart.items,
      subtotal,
    },
  });
});

// 2. Add product to cart
exports.addToCart = asyncHandler(async (req, res, next) => {
  const { productId, quantity } = req.body;
  const qty = Number(quantity) || 1;

  const product = await Product.findById(productId);
  if (!product || product.approvalStatus !== 'APPROVED') {
    return next(new AppError('Product not found or not available for purchase.', 404));
  }

  if (product.quantity < qty) {
    return next(new AppError(`Only ${product.quantity} items available in stock.`, 400));
  }

  const cart = await getOrCreateCart(req.user._id);
  const existingItemIndex = cart.items.findIndex(item => item.product._id.toString() === productId);

  if (existingItemIndex > -1) {
    // Validate combined quantity
    const newQty = cart.items[existingItemIndex].quantity + qty;
    if (product.quantity < newQty) {
      return next(new AppError(`Only ${product.quantity} items available in stock. Cannot add more.`, 400));
    }
    cart.items[existingItemIndex].quantity = newQty;
  } else {
    cart.items.push({ product: productId, quantity: qty });
  }

  await cart.save();

  // Return full cart
  const populatedCart = await Cart.findOne({ user: req.user._id }).populate('items.product');
  const subtotal = populatedCart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  res.status(200).json({
    success: true,
    message: 'Product added to cart successfully.',
    cart: {
      _id: populatedCart._id,
      items: populatedCart.items,
      subtotal,
    },
  });
});

// 3. Update item quantity in cart
exports.updateCartItem = asyncHandler(async (req, res, next) => {
  const { productId, quantity } = req.body;
  const qty = Number(quantity);

  if (qty <= 0) {
    return exports.removeFromCart(req, res, next);
  }

  const product = await Product.findById(productId);
  if (!product || product.approvalStatus !== 'APPROVED') {
    return next(new AppError('Product not found.', 404));
  }

  if (product.quantity < qty) {
    return next(new AppError(`Only ${product.quantity} items available in stock.`, 400));
  }

  const cart = await getOrCreateCart(req.user._id);
  const itemIndex = cart.items.findIndex(item => item.product._id.toString() === productId);

  if (itemIndex === -1) {
    return next(new AppError('Item not found in cart.', 404));
  }

  cart.items[itemIndex].quantity = qty;
  await cart.save();

  const populatedCart = await Cart.findOne({ user: req.user._id }).populate('items.product');
  const subtotal = populatedCart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  res.status(200).json({
    success: true,
    cart: {
      _id: populatedCart._id,
      items: populatedCart.items,
      subtotal,
    },
  });
});

// 4. Remove item from cart
exports.removeFromCart = asyncHandler(async (req, res, next) => {
  const { productId } = req.body;

  const cart = await getOrCreateCart(req.user._id);
  cart.items = cart.items.filter(item => item.product && item.product._id.toString() !== productId);
  await cart.save();

  const populatedCart = await Cart.findOne({ user: req.user._id }).populate('items.product');
  const subtotal = populatedCart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  res.status(200).json({
    success: true,
    message: 'Item removed from cart.',
    cart: {
      _id: populatedCart._id,
      items: populatedCart.items,
      subtotal,
    },
  });
});

// 5. Clear cart
exports.clearCart = asyncHandler(async (req, res, next) => {
  const cart = await getOrCreateCart(req.user._id);
  cart.items = [];
  await cart.save();

  res.status(200).json({
    success: true,
    cart: {
      _id: cart._id,
      items: [],
      subtotal: 0,
    },
  });
});
