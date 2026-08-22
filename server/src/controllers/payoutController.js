const Payout = require('../models/Payout');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const AppError = require('../utils/appError');
const asyncHandler = require('../utils/asyncHandler');

// 1. Get seller's own payouts and aggregated earnings
exports.getMyPayouts = asyncHandler(async (req, res, next) => {
  const payouts = await Payout.find({ seller: req.user._id })
    .populate('order', 'trackingNumber orderStatus deliveryStatus')
    .sort({ createdAt: -1 });

  // Calculate aggregated earnings
  let totalSales = 0;
  let eligiblePayout = 0;
  let paidPayout = 0;
  let pendingPayout = 0;

  payouts.forEach(p => {
    totalSales += p.amount;
    if (p.status === 'PAID') {
      paidPayout += p.payoutAmount;
    } else if (p.status === 'ELIGIBLE') {
      eligiblePayout += p.payoutAmount;
    } else if (p.status === 'PENDING' || p.status === 'PROCESSING') {
      pendingPayout += p.payoutAmount;
    }
  });

  res.status(200).json({
    success: true,
    stats: {
      totalSales,
      eligiblePayout,
      paidPayout,
      pendingPayout,
    },
    payouts,
  });
});

// 2. Get all payouts (Staff / Admin with VIEW_SELLER_PAYOUTS)
exports.getAllPayouts = asyncHandler(async (req, res, next) => {
  const payouts = await Payout.find()
    .populate('seller', 'name email')
    .populate('order', 'trackingNumber orderStatus')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: payouts.length,
    payouts,
  });
});

// 3. Process Payout (Admin / Staff with PROCESS_PAYOUTS)
exports.processPayout = asyncHandler(async (req, res, next) => {
  const { payoutId, transactionRef } = req.body;

  if (!payoutId || !transactionRef) {
    return next(new AppError('Payout ID and bank transaction reference are required.', 400));
  }

  const payout = await Payout.findById(payoutId);
  if (!payout) {
    return next(new AppError('Payout record not found.', 404));
  }

  // Ensure payout is actually eligible (successful delivery happened)
  if (payout.status !== 'ELIGIBLE' && payout.status !== 'FAILED') {
    return next(new AppError(`Cannot process payout in current state: ${payout.status}. Only ELIGIBLE or FAILED payouts can be processed.`, 400));
  }

  payout.status = 'PAID';
  payout.transactionRef = transactionRef;
  payout.processedBy = req.user._id;
  payout.processedAt = new Date();
  await payout.save();

  // Notify seller
  await Notification.create({
    user: payout.seller,
    title: 'Payout Processed!',
    message: `Your payout of ${payout.payoutAmount} ETB has been deposited. Ref: ${transactionRef}`,
    type: 'PAYOUT',
    relatedId: payout.order,
  });

  // Audit log
  await AuditLog.create({
    user: req.user._id,
    action: 'PROCESS_SELLER_PAYOUT',
    targetType: 'Payout',
    targetId: payout._id,
    metadata: { sellerId: payout.seller, amount: payout.payoutAmount, transactionRef },
  });

  res.status(200).json({
    success: true,
    message: 'Payout marked as PAID successfully.',
    payout,
  });
});
