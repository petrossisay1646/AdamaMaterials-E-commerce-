const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Payment = require('../models/Payment');
const Delivery = require('../models/Delivery');
const Payout = require('../models/Payout');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const PaymentService = require('../services/PaymentService');
const TelegramBotService = require('../services/TelegramBotService');
const AppError = require('../utils/appError');
const asyncHandler = require('../utils/asyncHandler');
const { calculateDynamicDeliveryFee } = require('../utils/deliveryFeeCalculator');
const { isLocationInAdamaServiceArea } = require('../config/serviceArea');

// Helper to generate a unique tracking number
const generateTrackingNumber = () => {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, ''); // YYMMDD
  const rand = Math.floor(1000 + Math.random() * 9000); // 4-digit random
  return `AM-${dateStr}-${rand}`;
};

// Configurable marketplace commission — set MARKETPLACE_COMMISSION_RATE in .env (default 10%)
const MARKETPLACE_COMMISSION_RATE = PaymentService.getCommissionRate ? PaymentService.getCommissionRate() : (parseFloat(process.env.MARKETPLACE_COMMISSION_RATE) || 0.10);

// 1. Checkout (Create Order)
exports.checkout = asyncHandler(async (req, res, next) => {
  // Role check: Only Buyers can checkout
  if (req.user.role !== 'BUYER' && !req.user.roles?.includes('BUYER')) {
    return next(new AppError('Only registered buyer accounts are authorized to checkout and purchase materials.', 403));
  }

  const { deliveryAddress, paymentMethod } = req.body;

  if (!deliveryAddress || !paymentMethod) {
    return next(new AppError('Delivery address and payment method are required.', 400));
  }

  // Validate delivery location is within Adama City service area
  if (deliveryAddress.latitude !== undefined && deliveryAddress.longitude !== undefined) {
    const numLat = Number(deliveryAddress.latitude);
    const numLng = Number(deliveryAddress.longitude);
    if (!isLocationInAdamaServiceArea(numLat, numLng)) {
      return next(
        new AppError(
          'Delivery location is outside the Adama City service area. Delivery is currently available only within Adama.',
          400
        )
      );
    }
  }

  // Validate payment method — Customer payment MUST BE strictly CHAPA
  if (paymentMethod !== 'CHAPA') {
    return next(
      new AppError(
        `Invalid payment method "${paymentMethod}". Chapa is the only accepted payment method for customer orders.`,
        400
      )
    );
  }

  // Fetch Cart
  const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
  if (!cart || cart.items.length === 0) {
    return next(new AppError('Your cart is empty.', 400));
  }

  // Double-check stock availability and approval status
  for (const item of cart.items) {
    if (!item.product || item.product.approvalStatus !== 'APPROVED') {
      return next(new AppError(`Product "${item.product?.name || 'Unknown'}" is no longer available.`, 400));
    }
    if (item.product.quantity < item.quantity) {
      return next(new AppError(`Insufficient stock for "${item.product.name}". Available: ${item.product.quantity}.`, 400));
    }
  }

  // Calculate Subtotal & Total Quantity
  const subtotal = cart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const totalQuantity = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  // Calculate Dynamic Delivery Fee BEFORE creating Order, Payment, and Payout records
  // Delivery fee depends on: Day of week (Weekend vs Weekday surge), Location/Distance, and Total Quantity.
  const { deliveryFee } = calculateDynamicDeliveryFee({
    address: deliveryAddress,
    totalQuantity,
    date: new Date(),
  });

  const total = subtotal + deliveryFee;

  const trackingNumber = generateTrackingNumber();

  // Map cart items to order items
  const orderItems = cart.items.map(item => ({
    product: item.product._id,
    name: item.product.name,
    price: item.product.price,
    quantity: item.quantity,
    seller: item.product.seller,
  }));

  // Set GeoJSON deliveryLocation if coordinates present
  const deliveryLocation =
    deliveryAddress.latitude !== undefined && deliveryAddress.longitude !== undefined
      ? {
          type: 'Point',
          coordinates: [Number(deliveryAddress.longitude), Number(deliveryAddress.latitude)],
        }
      : undefined;

  // Create Order
  const order = await Order.create({
    buyer: req.user._id,
    items: orderItems,
    subtotal,
    deliveryFee,
    total,
    paymentMethod,
    orderStatus: 'PENDING_PAYMENT',
    paymentStatus: paymentMethod === 'BANK_TRANSFER' ? 'PENDING_VERIFICATION' : 'PENDING',
    deliveryStatus: 'PENDING',
    deliveryAddress,
    deliveryLocation,
    trackingNumber,
  });

  // Create Payment record
  const payment = await Payment.create({
    order: order._id,
    provider: paymentMethod,
    amount: total,
    status: paymentMethod === 'BANK_TRANSFER' ? 'PENDING_VERIFICATION' : 'PENDING',
  });

  // Create Payout records for each unique seller in the order
  const sellerItemsMap = {};
  orderItems.forEach(item => {
    const sellerId = (item.seller?._id || item.seller).toString();
    if (!sellerItemsMap[sellerId]) {
      sellerItemsMap[sellerId] = [];
    }
    sellerItemsMap[sellerId].push({
      product: item.product,
      quantity: item.quantity,
      price: item.price,
    });
  });

  for (const sellerId of Object.keys(sellerItemsMap)) {
    const items = sellerItemsMap[sellerId];
    const amount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const commissionAmount = amount * MARKETPLACE_COMMISSION_RATE;
    const payoutAmount = amount - commissionAmount;

    await Payout.create({
      seller: sellerId,
      order: order._id,
      items,
      amount,
      commissionRate: MARKETPLACE_COMMISSION_RATE,
      commissionAmount,
      payoutAmount,
      status: 'PENDING', // Payout is PENDING. Becomes ELIGIBLE only after delivery!
    });

    // Notify seller
    await Notification.create({
      user: sellerId,
      title: 'New Sale! Pending Approval',
      message: `An order (${trackingNumber}) containing your materials was placed.`,
      type: 'ORDER',
      relatedId: order._id,
    });
  }

  // Decrement product inventory upon order placement
  for (const item of orderItems) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { quantity: -item.quantity },
    });
  }

  // Clear Cart
  cart.items = [];
  await cart.save();

  // Process payment initialization (Telebirr/Chapa checkout url)
  let paymentUrl = '';
  let transactionId = '';

  if (paymentMethod !== 'BANK_TRANSFER') {
    try {
      const callbackUrl = `${req.protocol}://${req.get('host')}/api/v1/payments/webhook/${paymentMethod.toLowerCase()}`;
      const payInit = await PaymentService.initialize(order, paymentMethod, callbackUrl);
      
      paymentUrl = payInit.paymentUrl;
      transactionId = payInit.transactionId;

      // Update payment record with transaction reference
      payment.transactionId = transactionId;
      await payment.save();
    } catch (payError) {
      console.error('Payment initialization failed during checkout:', payError);
      return next(new AppError(payError.message || 'Chapa payment gateway initialization failed.', 400));
    }
  }

  res.status(201).json({
    success: true,
    message: 'Order created successfully.',
    order,
    paymentUrl,
    transactionId,
  });
});

// 2. Get Order Details
exports.getOrderDetails = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate('buyer', 'name email')
    .populate('items.product', 'name images')
    .populate('items.seller', 'name email');

  if (!order) {
    return next(new AppError('Order not found.', 404));
  }

  const isAdminOrStaff = ['ADMIN', 'STAFF'].includes(req.user.role);
  const isBuyer = (order.buyer?._id || order.buyer).toString() === req.user._id.toString();

  // If seller, check if they own any item in the order
  const sellerItemIds = order.items
    .filter(item => (item.seller?._id || item.seller).toString() === req.user._id.toString())
    .map(item => item._id.toString());
  const isSeller = sellerItemIds.length > 0;

  if (!isAdminOrStaff && !isBuyer && !isSeller) {
    return next(new AppError('You do not have permission to view this order.', 403));
  }

  // If role is seller, filter order items to only show their products (Rule: Strict ownership & permission check)
  let orderData = order.toObject();
  if (req.user.role === 'SELLER' && !isAdminOrStaff) {
    orderData.items = orderData.items.filter(item => (item.seller?._id || item.seller).toString() === req.user._id.toString());
  }

  res.status(200).json({
    success: true,
    order: orderData,
  });
});

// 3. Get User Orders
exports.getMyOrders = asyncHandler(async (req, res, next) => {
  let query = {};

  if (req.user.role === 'BUYER') {
    query = { buyer: req.user._id };
  } else if (req.user.role === 'SELLER') {
    query = { 'items.seller': req.user._id };
  } else {
    // Staff/Admin can view all
    query = {};
  }

  const orders = await Order.find(query)
    .populate('buyer', 'name email')
    .sort({ createdAt: -1 });

  // Filter orders for sellers
  let filteredOrders = orders;
  if (req.user.role === 'SELLER') {
    filteredOrders = orders.map(order => {
      const orderObj = order.toObject();
      orderObj.items = orderObj.items.filter(item => item.seller.toString() === req.user._id.toString());
      return orderObj;
    });
  }

  res.status(200).json({
    success: true,
    count: filteredOrders.length,
    orders: filteredOrders,
  });
});

// 4. Update Order Status (Enforce state machine transitions)
exports.updateOrderStatus = asyncHandler(async (req, res, next) => {
  const { status, note } = req.body;
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found.', 404));
  }

  const allowedStatuses = [
    'PENDING_PAYMENT',
    'PAYMENT_VERIFICATION',
    'CONFIRMED',
    'PROCESSING',
    'READY_FOR_DELIVERY',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
    'DISPUTED',
    'REFUNDED',
    'COMPLETED',
  ];

  if (!allowedStatuses.includes(status)) {
    return next(new AppError('Invalid order status.', 400));
  }

  // Strict state machine validations
  const current = order.orderStatus;

  if (current === 'DELIVERED' && !['DISPUTED', 'COMPLETED'].includes(status)) {
    return next(new AppError('Delivered orders can only transition to DISPUTED or COMPLETED.', 400));
  }

  if (current === 'CANCELLED' || current === 'REFUNDED' || current === 'COMPLETED') {
    return next(new AppError(`Cannot change status of a finished order (${current}).`, 400));
  }

  // Apply transition
  order.orderStatus = status;

  // Sync payment or delivery status if appropriate
  if (status === 'DELIVERED') {
    order.deliveryStatus = 'DELIVERED';

    // Automatically transition related deliveries
    await Delivery.updateMany({ order: order._id }, { $set: { status: 'DELIVERED', notes: note || 'Delivered' } });

    // Rule: Seller payouts become eligible ONLY after successful delivery!
    await Payout.updateMany({ order: order._id, status: 'PENDING' }, { $set: { status: 'ELIGIBLE' } });

    // Notify sellers
    const payouts = await Payout.find({ order: order._id });
    for (const payout of payouts) {
      await Notification.create({
        user: payout.seller,
        title: 'Payout Eligible!',
        message: `Order ${order.trackingNumber} has been delivered. Your payout is now eligible.`,
        type: 'PAYOUT',
        relatedId: order._id,
      });
    }

    // In-app notification for buyer
    await Notification.create({
      user: order.buyer,
      title: 'Order Delivered!',
      message: `Your package (tracking: ${order.trackingNumber}) has been delivered successfully.`,
      type: 'ORDER',
      relatedId: order._id,
    });

    // Telegram: notify buyer directly if they linked via bot
    const deliveredPayment = await Payment.findOne({ order: order._id });
    if (deliveredPayment?.buyerTelegramChatId) {
      TelegramBotService.notifyBuyerDelivered(deliveredPayment.buyerTelegramChatId, order)
        .catch((err) => console.error('[TelegramBot] Delivery notify error:', err.message));
    }
  }

  if (status === 'CONFIRMED') {
    order.paymentStatus = 'PAID';
    // Sync payment records
    await Payment.updateMany({ order: order._id }, { $set: { status: 'PAID' } });

    // Automatically create a Delivery document if it doesn't exist
    const existingDelivery = await Delivery.findOne({ order: order._id });
    if (!existingDelivery) {
      await Delivery.create({
        order: order._id,
        status: 'PENDING',
        fee: order.deliveryFee || 0,
      });
    }

    // Notify buyer
    await Notification.create({
      user: order.buyer,
      title: 'Order Confirmed',
      message: `Payment verified. Order ${order.trackingNumber} is now confirmed.`,
      type: 'ORDER',
      relatedId: order._id,
    });
  }

  if (status === 'CANCELLED') {
    // Only restore stock if order has not already been delivered or completed
    if (!['DELIVERED', 'COMPLETED'].includes(current)) {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, { $inc: { quantity: item.quantity } });
      }
    }

    // Mark payment and payouts — only touch non-PAID payouts
    order.paymentStatus = 'FAILED';
    await Payment.updateMany({ order: order._id }, { $set: { status: 'FAILED' } });
    await Payout.updateMany(
      { order: order._id, status: { $in: ['PENDING', 'ELIGIBLE'] } },
      { $set: { status: 'FAILED' } }
    );

    // Notify buyer
    await Notification.create({
      user: order.buyer,
      title: 'Order Cancelled',
      message: `Your order ${order.trackingNumber} has been cancelled.`,
      type: 'ORDER',
      relatedId: order._id,
    });
  }

  await order.save();

  // Create Audit Log
  await AuditLog.create({
    user: req.user._id,
    action: 'ORDER_STATUS_OVERRIDE',
    targetType: 'Order',
    targetId: order._id,
    metadata: { status, current, note },
  });

  res.status(200).json({
    success: true,
    message: 'Order status updated successfully.',
    order,
  });
});

// 6. Estimate Dynamic Delivery Fee (Public/Buyer Route)
exports.estimateDeliveryFee = asyncHandler(async (req, res, next) => {
  const { address, totalQuantity, date } = req.body;
  const result = calculateDynamicDeliveryFee({ address, totalQuantity, date });
  res.status(200).json({
    success: true,
    ...result,
  });
});
