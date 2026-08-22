const Delivery = require('../models/Delivery');
const Order = require('../models/Order');
const Payout = require('../models/Payout');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const AppError = require('../utils/appError');
const asyncHandler = require('../utils/asyncHandler');

// 1. Set Delivery Fee
exports.setDeliveryFee = asyncHandler(async (req, res, next) => {
  const { deliveryId, fee } = req.body;
  const numericFee = Number(fee);

  if (!deliveryId || isNaN(numericFee) || numericFee < 0) {
    return next(new AppError('Delivery ID and a valid non-negative fee are required.', 400));
  }

  const delivery = await Delivery.findById(deliveryId);
  if (!delivery) {
    return next(new AppError('Delivery record not found.', 404));
  }

  const order = await Order.findById(delivery.order);
  if (!order) {
    return next(new AppError('Associated order not found.', 404));
  }

  // Calculate new total
  order.deliveryFee = numericFee;
  order.total = order.subtotal + numericFee;
  await order.save();

  delivery.fee = numericFee;
  await delivery.save();

  // Audit log
  await AuditLog.create({
    user: req.user._id,
    action: 'SET_DELIVERY_FEE',
    targetType: 'Delivery',
    targetId: delivery._id,
    metadata: { orderId: order._id, fee: numericFee },
  });

  res.status(200).json({
    success: true,
    message: `Delivery fee set to ${numericFee} ETB. Order total updated.`,
    delivery,
    order,
  });
});

// 2. Assign Delivery Staff
exports.assignDeliveryStaff = asyncHandler(async (req, res, next) => {
  const { deliveryId, staffId } = req.body;

  const delivery = await Delivery.findById(deliveryId);
  if (!delivery) {
    return next(new AppError('Delivery record not found.', 404));
  }

  const staffUser = await User.findOne({ _id: staffId, role: 'STAFF' });
  if (!staffUser) {
    return next(new AppError('Staff user not found.', 404));
  }

  delivery.assignedStaff = staffId;
  delivery.status = 'ASSIGNED';
  delivery.history.push({
    status: 'ASSIGNED',
    note: `Assigned delivery to ${staffUser.name}`,
    updatedBy: req.user._id,
  });
  await delivery.save();

  // Sync Order Status to PROCESSING if it was CONFIRMED
  const order = await Order.findById(delivery.order);
  if (order && order.orderStatus === 'CONFIRMED') {
    order.orderStatus = 'PROCESSING';
    order.deliveryStatus = 'ASSIGNED';
    await order.save();
  } else if (order) {
    order.deliveryStatus = 'ASSIGNED';
    await order.save();
  }

  // Notify delivery agent
  await Notification.create({
    user: staffId,
    title: 'New Delivery Assignment',
    message: `You have been assigned to deliver order ${order.trackingNumber}.`,
    type: 'ORDER',
    relatedId: order._id,
  });

  // Notify buyer
  await Notification.create({
    user: order.buyer,
    title: 'Delivery Staff Assigned',
    message: `Our courier ${staffUser.name} has been assigned to deliver your package.`,
    type: 'ORDER',
    relatedId: order._id,
  });

  res.status(200).json({
    success: true,
    message: `Delivery assigned to ${staffUser.name} successfully.`,
    delivery,
  });
});

// 3. Update Delivery Status (Courier updates details)
exports.updateDeliveryStatus = asyncHandler(async (req, res, next) => {
  const { deliveryId, status, note } = req.body;

  const delivery = await Delivery.findById(deliveryId);
  if (!delivery) {
    return next(new AppError('Delivery record not found.', 404));
  }

  const allowedStatuses = ['PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED'];
  if (!allowedStatuses.includes(status)) {
    return next(new AppError('Invalid delivery status.', 400));
  }

  // Enforce staff assignment checks if not admin/editor
  if (req.user.role === 'STAFF' && delivery.assignedStaff?.toString() !== req.user._id.toString() && !req.user.staffPermissions.includes('MANAGE_DELIVERIES')) {
    return next(new AppError('You are not assigned to this delivery.', 403));
  }

  delivery.status = status;
  delivery.notes = note || '';
  delivery.history.push({
    status,
    note: note || `Status updated to ${status}`,
    updatedBy: req.user._id,
  });
  await delivery.save();

  // Sync changes back to Order
  const order = await Order.findById(delivery.order);
  if (order) {
    order.deliveryStatus = status;

    if (status === 'OUT_FOR_DELIVERY') {
      order.orderStatus = 'OUT_FOR_DELIVERY';
    }

    if (status === 'DELIVERED') {
      order.orderStatus = 'DELIVERED';
      order.paymentStatus = 'PAID'; // In case it was cash-on-delivery or manual

      // Rule: Seller payouts become ELIGIBLE only after successful delivery!
      await Payout.updateMany({ order: order._id, status: 'PENDING' }, { $set: { status: 'ELIGIBLE' } });

      // Notify sellers
      const payouts = await Payout.find({ order: order._id });
      for (const payout of payouts) {
        await Notification.create({
          user: payout.seller,
          title: 'Payout Eligible',
          message: `Order ${order.trackingNumber} has been delivered. Your payout of ${payout.payoutAmount} ETB is now eligible.`,
          type: 'PAYOUT',
          relatedId: order._id,
        });
      }
    }

    await order.save();

    // Notify Buyer
    await Notification.create({
      user: order.buyer,
      title: `Delivery Update: ${status}`,
      message: `Your package status is now: ${status}. Note: ${note || 'None'}`,
      type: 'ORDER',
      relatedId: order._id,
    });

    // Notify live tracking room listeners in real-time
    try {
      const SocketService = require('../services/SocketService');
      SocketService.notifyStatusChange(delivery._id, status);
    } catch (sockErr) {
      console.warn('[Socket Notification Warn]:', sockErr.message);
    }
  }

  // Audit log
  await AuditLog.create({
    user: req.user._id,
    action: `DELIVERY_STATUS_UPDATE_${status}`,
    targetType: 'Delivery',
    targetId: delivery._id,
    metadata: { orderId: delivery.order, note },
  });

  res.status(200).json({
    success: true,
    message: 'Delivery status updated successfully.',
    delivery,
  });
});

// 4. Get Deliveries (filtered by assignment if staff)
exports.getDeliveries = asyncHandler(async (req, res, next) => {
  let query = {};
  
  // If role is courier (staff without global MANAGE_DELIVERIES override), only show their assigned tasks
  if (req.user.role === 'STAFF' && !req.user.staffPermissions.includes('MANAGE_DELIVERIES')) {
    query = { assignedStaff: req.user._id };
  }

  const deliveries = await Delivery.find(query)
    .populate('order', 'trackingNumber orderStatus paymentMethod total subtotal deliveryAddress')
    .populate('assignedStaff', 'name email')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: deliveries.length,
    deliveries,
  });
});

// 5. Get Delivery Details
exports.getDeliveryDetails = asyncHandler(async (req, res, next) => {
  const delivery = await Delivery.findById(req.params.id)
    .populate({
      path: 'order',
      populate: { path: 'buyer', select: 'name email' },
    })
    .populate('assignedStaff', 'name email');

  if (!delivery) {
    return next(new AppError('Delivery record not found.', 404));
  }

  res.status(200).json({
    success: true,
    delivery,
  });
});
