const Dispute = require('../models/Dispute');
const Order = require('../models/Order');
const Payout = require('../models/Payout');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const AppError = require('../utils/appError');
const asyncHandler = require('../utils/asyncHandler');

// 1. Create Dispute (Buyer only)
exports.createDispute = asyncHandler(async (req, res, next) => {
  const { orderId, productId, reason, description, evidence } = req.body;

  if (!orderId || !reason || !description) {
    return next(new AppError('Order ID, reason, and description are required.', 400));
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return next(new AppError('Order not found.', 404));
  }

  // Strict ownership check
  if (order.buyer.toString() !== req.user._id.toString()) {
    return next(new AppError('You do not own this order.', 403));
  }

  // Verify order is in disputable state (e.g. paid, processing, or delivered)
  if (['PENDING_PAYMENT', 'CANCELLED', 'REFUNDED'].includes(order.orderStatus)) {
    return next(new AppError(`Cannot open a dispute for an order in ${order.orderStatus} status.`, 400));
  }

  // Check if a dispute is already open for this order
  const existingDispute = await Dispute.findOne({ order: order._id, status: { $in: ['OPEN', 'UNDER_REVIEW'] } });
  if (existingDispute) {
    return next(new AppError('A dispute is already active for this order.', 400));
  }

  // Find the seller for the disputed product (or default to the first seller in the order)
  let disputedSeller;
  let disputedProduct = productId;

  if (productId) {
    const item = order.items.find(i => i.product.toString() === productId);
    if (!item) {
      return next(new AppError('Product not found in this order.', 400));
    }
    disputedSeller = item.seller;
  } else {
    // If no product specified, default to first item's seller and product
    disputedSeller = order.items[0].seller;
    disputedProduct = order.items[0].product;
  }

  // Create Dispute
  const dispute = await Dispute.create({
    order: order._id,
    buyer: req.user._id,
    seller: disputedSeller,
    product: disputedProduct,
    reason,
    description,
    evidence: evidence || [],
    status: 'OPEN',
  });

  // Transition Order status to DISPUTED
  order.orderStatus = 'DISPUTED';
  await order.save();

  // Rule: Put the seller's Payout ON_HOLD to block processing during dispute resolution!
  await Payout.updateMany(
    { order: order._id, seller: disputedSeller },
    { $set: { status: 'ON_HOLD' } }
  );

  // Notify Seller
  await Notification.create({
    user: disputedSeller,
    title: 'Dispute Opened',
    message: `A buyer opened a dispute for order ${order.trackingNumber}. Reason: ${reason}.`,
    type: 'DISPUTE',
    relatedId: dispute._id,
  });

  // Audit log
  await AuditLog.create({
    user: req.user._id,
    action: 'CREATE_DISPUTE',
    targetType: 'Dispute',
    targetId: dispute._id,
    metadata: { orderId: order._id, reason },
  });

  res.status(201).json({
    success: true,
    message: 'Dispute opened successfully. A marketplace administrator will investigate.',
    dispute,
  });
});

// 2. Resolve Dispute (Admin only)
exports.resolveDispute = asyncHandler(async (req, res, next) => {
  const { disputeId, decision, adminNotes } = req.body;

  if (!disputeId || !decision || !adminNotes) {
    return next(new AppError('Dispute ID, decision, and administrator notes are required.', 400));
  }

  const dispute = await Dispute.findById(disputeId);
  if (!dispute) {
    return next(new AppError('Dispute not found.', 404));
  }

  if (!['BUYER_REFUND', 'SELLER_PAYOUT_RELEASED', 'PARTIAL_REFUND', 'NO_ACTION'].includes(decision)) {
    return next(new AppError('Invalid resolution decision.', 400));
  }

  const order = await Order.findById(dispute.order);
  if (!order) {
    return next(new AppError('Associated order not found.', 404));
  }

  dispute.status = 'RESOLVED';
  dispute.adminDecision = decision;
  dispute.adminNotes = adminNotes;
  dispute.resolvedAt = new Date();
  await dispute.save();

  // Execute decision logic
  if (decision === 'BUYER_REFUND') {
    // Transition Order to REFUNDED
    order.orderStatus = 'REFUNDED';
    order.paymentStatus = 'REFUNDED';
    await order.save();

    // Cancel payout to seller
    await Payout.updateMany(
      { order: order._id, seller: dispute.seller },
      { $set: { status: 'FAILED' } }
    );

    // Notify Buyer
    await Notification.create({
      user: dispute.buyer,
      title: 'Dispute Resolved: Refund Approved',
      message: `Your dispute for order ${order.trackingNumber} has been resolved in your favor. A refund has been issued.`,
      type: 'DISPUTE',
      relatedId: dispute._id,
    });

    // Notify Seller
    await Notification.create({
      user: dispute.seller,
      title: 'Dispute Resolved: Payout Cancelled',
      message: `The dispute for order ${order.trackingNumber} was resolved in favor of the buyer. The payout has been cancelled.`,
      type: 'DISPUTE',
      relatedId: dispute._id,
    });
  } else if (decision === 'SELLER_PAYOUT_RELEASED') {
    // Transition Order back to DELIVERED / COMPLETED depending on current state
    order.orderStatus = order.deliveryStatus === 'DELIVERED' ? 'DELIVERED' : 'CONFIRMED';
    await order.save();

    // Release payout
    const targetStatus = order.deliveryStatus === 'DELIVERED' ? 'ELIGIBLE' : 'PENDING';
    await Payout.updateMany(
      { order: order._id, seller: dispute.seller },
      { $set: { status: targetStatus } }
    );

    // Notify Buyer
    await Notification.create({
      user: dispute.buyer,
      title: 'Dispute Resolved: Payout Released',
      message: `The dispute for order ${order.trackingNumber} was resolved. The payout has been released to the seller.`,
      type: 'DISPUTE',
      relatedId: dispute._id,
    });

    // Notify Seller
    await Notification.create({
      user: dispute.seller,
      title: 'Dispute Resolved: Payout Released',
      message: `The dispute for order ${order.trackingNumber} was resolved. Your payout is now released.`,
      type: 'DISPUTE',
      relatedId: dispute._id,
    });
  } else {
    // NO_ACTION / PARTIAL_REFUND (Re-release payout and keep order status)
    order.orderStatus = order.deliveryStatus === 'DELIVERED' ? 'DELIVERED' : 'CONFIRMED';
    await order.save();

    const targetStatus = order.deliveryStatus === 'DELIVERED' ? 'ELIGIBLE' : 'PENDING';
    await Payout.updateMany(
      { order: order._id, seller: dispute.seller },
      { $set: { status: targetStatus } }
    );

    // Notify Buyer & Seller
    await Notification.create({
      user: dispute.buyer,
      title: 'Dispute Closed',
      message: `Dispute for order ${order.trackingNumber} closed. Resolution: ${decision}`,
      type: 'DISPUTE',
      relatedId: dispute._id,
    });
  }

  // Audit log
  await AuditLog.create({
    user: req.user._id,
    action: `RESOLVE_DISPUTE_${decision}`,
    targetType: 'Dispute',
    targetId: dispute._id,
    metadata: { orderId: order._id, decision, notes: adminNotes },
  });

  res.status(200).json({
    success: true,
    message: 'Dispute resolved successfully.',
    dispute,
    order,
  });
});

// 3. Get disputes related to user
exports.getMyDisputes = asyncHandler(async (req, res, next) => {
  let query = {};
  if (req.user.role === 'BUYER') {
    query = { buyer: req.user._id };
  } else if (req.user.role === 'SELLER') {
    query = { seller: req.user._id };
  }

  const disputes = await Dispute.find(query)
    .populate('order', 'trackingNumber')
    .populate('buyer', 'name email')
    .populate('seller', 'name email')
    .populate('product', 'name')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: disputes.length,
    disputes,
  });
});

// 4. Get all disputes (Admin / Staff)
exports.getAllDisputes = asyncHandler(async (req, res, next) => {
  const disputes = await Dispute.find()
    .populate('order', 'trackingNumber orderStatus')
    .populate('buyer', 'name email')
    .populate('seller', 'name email')
    .populate('product', 'name')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: disputes.length,
    disputes,
  });
});
