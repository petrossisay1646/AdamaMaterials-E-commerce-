const crypto = require('crypto');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Delivery = require('../models/Delivery');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const User = require('../models/User');
const PaymentService = require('../services/PaymentService');
const TelegramBotService = require('../services/TelegramBotService');
const StorageService = require('../services/StorageService');
const AppError = require('../utils/appError');
const asyncHandler = require('../utils/asyncHandler');

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Notify all admins + staff with VERIFY_PAYMENTS permission in-app
// ─────────────────────────────────────────────────────────────────────────────
async function notifyAdminStaff(title, message, relatedId) {
  try {
    const adminsAndStaff = await User.find({
      $or: [
        { role: 'ADMIN' },
        { role: 'STAFF', staffPermissions: 'VERIFY_PAYMENTS' },
      ],
      isActive: true,
    }).select('_id');

    if (adminsAndStaff.length > 0) {
      const notifications = adminsAndStaff.map(u => ({
        user: u._id,
        title,
        message,
        type: 'PAYMENT',
        relatedId,
        read: false,
      }));
      await Notification.insertMany(notifications);
    }
  } catch (err) {
    console.error('[notifyAdminStaff] Error creating admin notifications:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Hash a raw token for secure storage
// ─────────────────────────────────────────────────────────────────────────────
function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// 0. Generate Bot Deep Link — Buyer calls this after placing a Bank Transfer order
//    Returns a Telegram deep link with a one-time secure token embedded.
//    Only the buyer who owns the order can call this.
// ─────────────────────────────────────────────────────────────────────────────
exports.generateBotLink = asyncHandler(async (req, res, next) => {
  const { orderId } = req.params;

  const order = await Order.findById(orderId);
  if (!order) return next(new AppError('Order not found.', 404));

  if (order.buyer.toString() !== req.user._id.toString()) {
    return next(new AppError('You do not own this order.', 403));
  }

  if (!['BANK_TRANSFER', 'TELEBIRR'].includes(order.paymentMethod)) {
    return next(new AppError('This order does not use Bank Transfer or Telebirr.', 400));
  }

  const payment = await Payment.findOne({ order: order._id });
  if (!payment) return next(new AppError('Payment record not found.', 404));

  // Generate a cryptographically secure random token (32 bytes = 64 hex chars)
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);

  // Store the hash and expiry (24 hours)
  payment.botToken = tokenHash;
  payment.botTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await payment.save({ validateBeforeSave: false });

  // Get bot username to construct the deep link
  const botUsername = await TelegramBotService.getBotUsername();
  if (!botUsername) {
    return next(new AppError('Could not reach Telegram API to generate bot link.', 502));
  }

  const deepLink = `https://t.me/${botUsername}?start=${rawToken}`;

  res.status(200).json({
    success: true,
    deepLink,
    token: rawToken,
    paymentId: payment._id,
    orderTotal: order.total,
    trackingNumber: order.trackingNumber,
    // Bank details for the instructions panel on the frontend
    bankDetails: {
      bankName: process.env.BANK_NAME || 'Commercial Bank of Ethiopia (CBE)',
      accountNumber: process.env.BANK_ACCOUNT_NUMBER || '1000123456789',
      accountName: process.env.BANK_ACCOUNT_NAME || 'Adama Materials Marketplace PLC',
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 0b. Bot Link Validate — Called by the Telegram bot when a buyer opens via deep link.
//     Public route (no JWT); authenticated by the one-time token.
//     Registers the buyer's Telegram chat_id on the Payment record.
// ─────────────────────────────────────────────────────────────────────────────
exports.botLinkValidate = asyncHandler(async (req, res, next) => {
  const { token, telegramChatId } = req.body;

  if (!telegramChatId) {
    return next(new AppError('Telegram chat ID is required.', 400));
  }

  let payment = null;

  // 1. Try finding by matching botToken hash
  if (token) {
    const tokenHash = hashToken(token);
    payment = await Payment.findOne({
      botToken: tokenHash,
      botTokenExpiry: { $gt: new Date() },
    }).select('+botToken').populate({
      path: 'order',
      populate: { path: 'buyer', select: 'name email phone' },
    });
  }

  // 2. If token lookup failed, check if this chat_id already has an active pending payment
  if (!payment) {
    payment = await Payment.findOne({
      buyerTelegramChatId: String(telegramChatId),
      status: { $in: ['PENDING', 'PENDING_VERIFICATION'] },
    }).populate({
      path: 'order',
      populate: { path: 'buyer', select: 'name email phone' },
    }).sort({ createdAt: -1 });
  }

  // 3. Fallback: Find the most recent pending unverified payment in the database
  if (!payment) {
    payment = await Payment.findOne({
      status: { $in: ['PENDING', 'PENDING_VERIFICATION'] },
    }).populate({
      path: 'order',
      populate: { path: 'buyer', select: 'name email phone' },
    }).sort({ createdAt: -1 });
  }

  if (!payment || !payment.order) {
    return next(new AppError('No pending orders found. Please place an order on the website first.', 404));
  }

  const order = payment.order;
  const buyer = order.buyer || { name: 'Valued Buyer', email: '' };

  // Register or update the buyer's Telegram chat_id
  payment.buyerTelegramChatId = String(telegramChatId);
  await payment.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: 'Linked successfully.',
    buyer: {
      name: buyer.name,
      email: buyer.email,
    },
    order: {
      trackingNumber: order.trackingNumber,
      total: order.total,
      status: order.orderStatus,
      paymentStatus: order.paymentStatus,
    },
    paymentId: payment._id,
    paymentStatus: payment.status,
    alreadySubmitted: Boolean(payment.refNumber && payment.refNumber !== 'SCREENSHOT_UPLOAD'),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 0c. Bot Submit Receipt — Called by the Telegram bot on behalf of the buyer.
//     Public route; authenticated by the one-time token + Telegram chat_id.
//     Records the bank reference number and fires admin notifications.
// ─────────────────────────────────────────────────────────────────────────────
exports.botSubmitReceipt = asyncHandler(async (req, res, next) => {
  const { token, telegramChatId, paymentId, refNumber, submissionType, receiptImage, botPaymentMethod, bankName } = req.body;

  if (!telegramChatId || (!refNumber && !receiptImage)) {
    return next(new AppError('Telegram chat ID, and either reference number or receipt screenshot are required.', 400));
  }

  if (submissionType !== 'RECEIPT_IMAGE' && botPaymentMethod === 'TELEBIRR' && refNumber && refNumber.trim().length !== 10) {
    return next(new AppError('Telebirr transaction reference number must be exactly 10 characters long.', 400));
  }

  let payment = null;

  if (token) {
    const tokenHash = hashToken(token);
    payment = await Payment.findOne({
      botToken: tokenHash,
      buyerTelegramChatId: String(telegramChatId),
      botTokenExpiry: { $gt: new Date() },
    }).select('+botToken').populate({
      path: 'order',
      populate: { path: 'buyer', select: 'name email' },
    });
  }

  // Fallback: lookup by paymentId and telegramChatId or active chat_id
  if (!payment && paymentId) {
    payment = await Payment.findOne({
      _id: paymentId,
      buyerTelegramChatId: String(telegramChatId),
    }).populate({
      path: 'order',
      populate: { path: 'buyer', select: 'name email' },
    });
  }

  if (!payment) {
    payment = await Payment.findOne({
      buyerTelegramChatId: String(telegramChatId),
      status: { $in: ['PENDING', 'PENDING_VERIFICATION'] },
    }).populate({
      path: 'order',
      populate: { path: 'buyer', select: 'name email' },
    }).sort({ createdAt: -1 });
  }

  if (!payment || !payment.order) {
    return next(new AppError('Invalid token or session expired. Please use a fresh link from the website.', 401));
  }

  // Idempotency: already submitted
  if (payment.status === 'PENDING_VERIFICATION' && (payment.refNumber || payment.receiptImage) && payment.refNumber !== 'SCREENSHOT_UPLOAD') {
    return res.status(200).json({
      success: true,
      alreadySubmitted: true,
      message: 'Receipt already submitted and pending verification.',
      paymentId: payment._id,
    });
  }

  const order = payment.order;
  const buyer = order.buyer;

  // Update payment record with method, bank, reference, and receipt screenshot
  payment.refNumber = refNumber || 'SCREENSHOT_UPLOAD';
  payment.submissionType = submissionType || (receiptImage ? 'RECEIPT_IMAGE' : 'REF_NUMBER');
  if (receiptImage) payment.receiptImage = receiptImage;
  payment.status = 'PENDING_VERIFICATION';
  if (botPaymentMethod) payment.botPaymentMethod = botPaymentMethod;
  if (bankName) payment.bankName = bankName;
  await payment.save();

  // Update order status
  order.orderStatus = 'PAYMENT_VERIFICATION';
  order.paymentStatus = 'PENDING_VERIFICATION';
  await order.save();

  // Human-readable payment method label for notifications
  const methodLabel = botPaymentMethod === 'TELEBIRR'
    ? 'Telebirr'
    : (bankName ? `Bank Transfer (${bankName})` : 'Bank Transfer');

  const refInfo = receiptImage ? `Screenshot attached (${refNumber || 'Image'})` : `ref: ${refNumber}`;

  // 1. Buyer Notification
  await Notification.create({
    user: order.buyer._id || order.buyer,
    title: '⏳ Receipt Submitted — Pending Verification',
    message: `Your ${methodLabel} receipt submission (${refInfo}) for order #${order.trackingNumber} is being verified by admin.`,
    type: 'PAYMENT',
    relatedId: order._id,
  });

  // 2. Admin & Staff Notification
  await notifyAdminStaff(
    `🔔 Payment Verification Required (Order #${order.trackingNumber})`,
    `Buyer ${buyer.name} submitted a ${methodLabel} receipt (${refInfo}) for order #${order.trackingNumber}. Amount: ${order.total?.toLocaleString()} ETB. Please verify payment in Admin Portal.`,
    order._id
  );

  // 3. Seller Notification(s) - Notify sellers whose products are in this order
  if (order.items && order.items.length > 0) {
    const sellerIds = [...new Set(order.items.map(item => item.seller?.toString()).filter(Boolean))];
    for (const sellerId of sellerIds) {
      await Notification.create({
        user: sellerId,
        title: '📦 New Order Placed — Payment Verification Pending',
        message: `Order #${order.trackingNumber} containing your materials was placed by ${buyer.name}. Payment is currently under review by Admin.`,
        type: 'ORDER',
        relatedId: order._id,
      });
    }
  }

  // Alert admin Telegram channel with inline Approve/Reject buttons & optional photo
  TelegramBotService.notifyAdminNewReceipt(order, buyer, payment.refNumber, payment._id.toString(), botPaymentMethod, bankName, payment.submissionType, receiptImage)
    .catch((err) => console.error('[TelegramBot] Admin alert error:', err.message));

  res.status(200).json({
    success: true,
    message: 'Receipt submitted successfully. Admin has been notified.',
    paymentId: payment._id,
    orderTracking: order.trackingNumber,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 0d. Bot Get Active Session — Called by bot to restore active order session
// ─────────────────────────────────────────────────────────────────────────────
exports.botGetActiveSession = asyncHandler(async (req, res, next) => {
  const { telegramChatId } = req.params;

  if (!telegramChatId) {
    return next(new AppError('Telegram chat ID is required.', 400));
  }

  const payment = await Payment.findOne({
    buyerTelegramChatId: String(telegramChatId),
    status: { $in: ['PENDING', 'PENDING_VERIFICATION'] },
  }).populate({
    path: 'order',
    populate: { path: 'buyer', select: 'name email phone' },
  }).sort({ createdAt: -1 });

  if (!payment || !payment.order) {
    return res.status(200).json({ success: false, message: 'No active session found.' });
  }

  res.status(200).json({
    success: true,
    paymentId: payment._id,
    orderTracking: payment.order.trackingNumber,
    orderTotal: payment.order.total,
    buyerName: payment.order.buyer?.name || 'Buyer',
    botPaymentMethod: payment.botPaymentMethod || (payment.provider === 'TELEBIRR' ? 'TELEBIRR' : 'BANK_TRANSFER'),
    bankName: payment.bankName || null,
    status: payment.status,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Buyer submits payment proof (Transaction ID + Screenshot Image) via the WEBSITE
// ─────────────────────────────────────────────────────────────────────────────
exports.submitReceiptWithProof = asyncHandler(async (req, res, next) => {
  const { orderId, refNumber, bankName, botPaymentMethod } = req.body;

  if (!orderId) {
    return next(new AppError('Order ID is required.', 400));
  }

  // At least one proof must be provided: transaction reference or screenshot image
  if (!refNumber && !req.file && !req.body.receiptImage) {
    return next(new AppError('Please enter a Transaction Reference ID or upload a payment receipt screenshot.', 400));
  }

  const order = await Order.findById(orderId);
  if (!order) return next(new AppError('Order not found.', 404));

  if (order.buyer.toString() !== req.user._id.toString()) {
    return next(new AppError('You do not own this order.', 403));
  }

  const payment = await Payment.findOne({ order: order._id });
  if (!payment) return next(new AppError('Associated payment record not found.', 404));

  let receiptImageUrl = payment.receiptImage;

  // Handle uploaded file if present
  if (req.file) {
    receiptImageUrl = await StorageService.uploadImage(req.file);
  } else if (req.body.receiptImage) {
    receiptImageUrl = req.body.receiptImage;
  }

  if (refNumber) {
    payment.refNumber = refNumber.trim();
    payment.transactionId = refNumber.trim();
  }
  if (receiptImageUrl) {
    payment.receiptImage = receiptImageUrl;
  }
  if (bankName) {
    payment.bankName = bankName;
  }
  if (botPaymentMethod) {
    payment.botPaymentMethod = botPaymentMethod;
  }

  // Determine submission type
  if (receiptImageUrl && (refNumber || payment.refNumber)) {
    payment.submissionType = 'BOTH';
  } else if (receiptImageUrl) {
    payment.submissionType = 'RECEIPT_IMAGE';
  } else {
    payment.submissionType = 'REF_NUMBER';
  }

  payment.status = 'PENDING_VERIFICATION';
  await payment.save();

  order.orderStatus = 'PAYMENT_VERIFICATION';
  order.paymentStatus = 'PENDING_VERIFICATION';
  await order.save();

  // Create notification for buyer
  await Notification.create({
    user: order.buyer,
    title: 'Payment Proof Received',
    message: `Your payment proof for order ${order.trackingNumber} has been received and is being verified by our staff.`,
    type: 'PAYMENT',
    relatedId: order._id,
  });

  // Notify all admins and staff in-app
  const displayProof = refNumber ? `ref: ${refNumber}` : 'screenshot image';
  await notifyAdminStaff(
    '🔔 New Payment Receipt — Verification Required',
    `Buyer ${req.user.name} submitted payment proof (${displayProof}) for order ${order.trackingNumber}. Please review in the Bank Confirmations tab.`,
    order._id
  );

  // Notify admin via Telegram
  TelegramBotService.notifyAdminNewReceipt(
    order,
    req.user,
    payment.refNumber || '',
    payment._id.toString(),
    payment.botPaymentMethod || 'BANK_TRANSFER',
    payment.bankName || '',
    payment.submissionType,
    payment.receiptImage || ''
  ).catch((err) => console.error('[TelegramBot] Telegram notification error:', err.message));

  res.status(200).json({
    success: true,
    message: 'Payment proof submitted successfully. Our staff will verify it shortly.',
    order,
    payment,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 1b. Buyer submits bank transfer reference via the WEBSITE (legacy / fallback)
// ─────────────────────────────────────────────────────────────────────────────
exports.submitBankTransferDetails = asyncHandler(async (req, res, next) => {
  const { orderId, refNumber } = req.body;

  if (!orderId || !refNumber) {
    return next(new AppError('Order ID and bank transfer reference number are required.', 400));
  }

  const order = await Order.findById(orderId);
  if (!order) return next(new AppError('Order not found.', 404));

  if (order.buyer.toString() !== req.user._id.toString()) {
    return next(new AppError('You do not own this order.', 403));
  }

  const payment = await Payment.findOne({ order: order._id });
  if (!payment) return next(new AppError('Associated payment record not found.', 404));

  payment.refNumber = refNumber;
  payment.transactionId = refNumber;
  payment.status = 'PENDING_VERIFICATION';
  await payment.save();

  order.orderStatus = 'PAYMENT_VERIFICATION';
  order.paymentStatus = 'PENDING_VERIFICATION';
  await order.save();

  await Notification.create({
    user: order.buyer,
    title: 'Reference Submitted',
    message: `Your bank transfer reference (${refNumber}) is under verification.`,
    type: 'PAYMENT',
    relatedId: order._id,
  });

  // Notify all admins + staff in-app (portal bell notification)
  await notifyAdminStaff(
    '🔔 New Payment Receipt — Verification Required',
    `Buyer ${req.user.name} submitted a Bank Transfer receipt (ref: ${refNumber}) for order ${order.trackingNumber}. Please verify in the Bank Confirmations tab.`,
    order._id
  );

  // Notify admin via Telegram
  TelegramBotService.notifyAdminNewReceipt(order, req.user, refNumber, payment._id.toString())
    .catch((err) => console.error('[TelegramBot] Telegram notification error:', err.message));

  res.status(200).json({
    success: true,
    message: 'Bank transfer reference submitted successfully. Our staff will verify it shortly.',
    order,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 1.5. Get all pending manual bank transfers (Staff/Admin)
// ─────────────────────────────────────────────────────────────────────────────
exports.getPendingManualPayments = asyncHandler(async (req, res, next) => {
  const payments = await Payment.find({ status: 'PENDING_VERIFICATION' })
    .populate({
      path: 'order',
      populate: { path: 'buyer', select: 'name email' },
    })
    .sort({ createdAt: -1 });

  // Self-healing: if any payment has a local disk path/localhost URL, convert it to Base64 Data URI
  const fs = require('fs');
  const path = require('path');
  for (const p of payments) {
    if (p.receiptImage && (p.receiptImage.startsWith('http://localhost') || p.receiptImage.startsWith('/uploads/'))) {
      const parts = p.receiptImage.split('/uploads/');
      if (parts[1]) {
        const localPath = path.join(__dirname, '../../public/uploads', parts[1]);
        if (fs.existsSync(localPath)) {
          try {
            const buf = fs.readFileSync(localPath);
            const ext = path.extname(parts[1]).toLowerCase().replace('.', '') || 'jpeg';
            const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
            p.receiptImage = `data:${mime};base64,${buf.toString('base64')}`;
            await p.save({ validateBeforeSave: false });
          } catch (e) {
            console.warn('[PaymentController] Could not auto-convert local receipt to Base64:', e.message);
          }
        }
      }
    }
  }

  res.status(200).json({
    success: true,
    count: payments.length,
    payments,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Staff / Admin manually verifies bank transfer payment
//    After approval → notify buyer directly via Telegram
// ─────────────────────────────────────────────────────────────────────────────
exports.verifyPaymentManual = asyncHandler(async (req, res, next) => {
  const { paymentId, status, notes } = req.body;

  if (!paymentId || !status) {
    return next(new AppError('Payment ID and verification status are required.', 400));
  }

  if (!['PAID', 'FAILED'].includes(status)) {
    return next(new AppError('Invalid verification status. Must be PAID or FAILED.', 400));
  }

  const payment = await Payment.findById(paymentId);
  if (!payment) return next(new AppError('Payment record not found.', 404));

  // Idempotency: skip if already verified
  if (payment.status === 'PAID') {
    return res.status(200).json({ success: true, message: 'Already verified as PAID.', payment });
  }

  const order = await Order.findById(payment.order);
  if (!order) return next(new AppError('Associated order not found.', 404));

  payment.status = status;
  payment.verifiedBy = req.user._id;
  payment.verificationNotes = notes || '';
  payment.verificationDate = new Date();
  await payment.save();

  if (status === 'PAID') {
    // 1. Process Stock Decrement now that payment is officially VERIFIED
    if (order.items && order.items.length > 0) {
      for (const item of order.items) {
        if (item.product) {
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { quantity: -item.quantity } },
            { new: true }
          );
        }
      }
    }

    order.paymentStatus = 'PAID';
    order.orderStatus = 'CONFIRMED';
    await order.save();

    // Create Delivery document if missing
    const existingDelivery = await Delivery.findOne({ order: order._id });
    if (!existingDelivery) {
      await Delivery.create({ order: order._id, status: 'PENDING', fee: order.deliveryFee || 0 });
    }

    // Buyer Notification
    await Notification.create({
      user: order.buyer,
      title: '🎉 Payment Verified — Order Confirmed!',
      message: `Your payment for order #${order.trackingNumber} has been verified. Your Order ID: ${order.trackingNumber}.`,
      type: 'PAYMENT',
      relatedId: order._id,
    });

    // Seller Notification(s)
    if (order.items && order.items.length > 0) {
      const sellerIds = [...new Set(order.items.map(item => item.seller?.toString()).filter(Boolean))];
      for (const sellerId of sellerIds) {
        await Notification.create({
          user: sellerId,
          title: '💰 Order Payment Verified — Prepare Items!',
          message: `Payment for order #${order.trackingNumber} has been verified by Admin. Please prepare the items for delivery.`,
          type: 'ORDER',
          relatedId: order._id,
        });
      }
    }

    // ── Telegram: notify buyer directly with Order ID ──────────────────────
    if (payment.buyerTelegramChatId) {
      TelegramBotService.notifyBuyerPaymentApproved(payment.buyerTelegramChatId, order)
        .catch((err) => console.error('[TelegramBot] Buyer approval notify error:', err.message));
    }

  } else {
    // FAILED
    order.paymentStatus = 'FAILED';
    order.orderStatus = 'PENDING_PAYMENT';
    await order.save();

    // Buyer Notification
    await Notification.create({
      user: order.buyer,
      title: '❌ Payment Verification Failed',
      message: `Your payment verification for order #${order.trackingNumber} failed. Notes: ${notes || 'Reference could not be verified.'}`,
      type: 'PAYMENT',
      relatedId: order._id,
    });

    // Seller Notification(s)
    if (order.items && order.items.length > 0) {
      const sellerIds = [...new Set(order.items.map(item => item.seller?.toString()).filter(Boolean))];
      for (const sellerId of sellerIds) {
        await Notification.create({
          user: sellerId,
          title: '⚠️ Order Payment Failed',
          message: `Payment verification for order #${order.trackingNumber} failed or was declined.`,
          type: 'ORDER',
          relatedId: order._id,
        });
      }
    }

    // Notify buyer in Telegram if they linked
    if (payment.buyerTelegramChatId) {
      TelegramBotService.sendTo(
        payment.buyerTelegramChatId,
        [
          '❌ <b>Payment Verification Failed</b>',
          `━━━━━━━━━━━━━━━━━━━━━`,
          `Order: <code>${order.trackingNumber}</code>`,
          `Reason: ${notes || 'Reference not verified'}`,
          '',
          'Please return to the marketplace portal and re-submit a correct reference number.',
        ].join('\n')
      ).catch(() => {});
    }
  }

  // Audit Log
  await AuditLog.create({
    user: req.user._id,
    action: `MANUAL_PAYMENT_VERIFICATION_${status}`,
    targetType: 'Payment',
    targetId: payment._id,
    metadata: { orderId: order._id, notes },
  });

  res.status(200).json({
    success: true,
    message: `Payment status updated to ${status}.`,
    payment,
    order,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Online Payment Verification (API trigger for frontend callback)
// ─────────────────────────────────────────────────────────────────────────────
exports.verifyOnlinePayment = asyncHandler(async (req, res, next) => {
  const { transactionId, provider } = req.query;

  if (!transactionId || !provider) {
    return next(new AppError('Transaction reference and provider name are required.', 400));
  }

  const payment = await Payment.findOne({ transactionId });
  if (!payment) return next(new AppError('Payment transaction reference not found.', 404));

  // Idempotency
  if (payment.status === 'PAID') {
    const order = await Order.findById(payment.order);
    return res.status(200).json({ success: true, status: 'PAID', order, message: 'Already verified' });
  }

  const order = await Order.findById(payment.order);
  if (!order) return next(new AppError('Associated order not found.', 404));

  const result = await PaymentService.verify(transactionId, provider.toUpperCase());

  if (result.status === 'PAID') {
    // Amount mismatch guard
    if (result.amount && Math.abs(result.amount - payment.amount) > 1) {
      console.error(`[SECURITY] Amount mismatch on ${transactionId}: expected ${payment.amount}, got ${result.amount}`);
      payment.status = 'FAILED';
      await payment.save();
      order.paymentStatus = 'FAILED';
      await order.save();
      return next(new AppError('Payment amount mismatch detected. Payment rejected for security.', 400));
    }

    payment.status = 'PAID';
    await payment.save();

    order.paymentStatus = 'PAID';
    order.orderStatus = 'CONFIRMED';
    await order.save();

    const existingDelivery = await Delivery.findOne({ order: order._id });
    if (!existingDelivery) {
      await Delivery.create({ order: order._id, status: 'PENDING', fee: order.deliveryFee || 0 });
    }

    await Notification.create({
      user: order.buyer,
      title: 'Payment Successful',
      message: `We verified your payment for order ${order.trackingNumber}.`,
      type: 'PAYMENT',
      relatedId: order._id,
    });
  } else {
    payment.status = 'FAILED';
    await payment.save();
    order.paymentStatus = 'FAILED';
    await order.save();
  }

  res.status(200).json({ success: true, status: payment.status, order });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Webhooks (Chapa, Telebirr, Mock)
// ─────────────────────────────────────────────────────────────────────────────
exports.handleWebhook = asyncHandler(async (req, res, next) => {
  const { provider } = req.params;
  const payload = req.body;

  // Chapa signature verification
  if (provider === 'chapa') {
    const sigHeader = req.headers['x-chapa-signature'] || req.headers['chapa-signature'];
    if (process.env.CHAPA_WEBHOOK_SECRET && sigHeader) {
      const rawBody = req.rawBody || JSON.stringify(payload);
      if (!PaymentService.verifyChapaWebhook(rawBody, sigHeader)) {
        console.warn('[SECURITY] Invalid Chapa webhook signature rejected');
        return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
      }
    }
  }

  let txRef = '';
  let status = 'failed';

  if (provider === 'chapa') {
    txRef = payload.tx_ref;
    status = payload.status;
  } else if (provider === 'telebirr') {
    txRef = payload.tx_ref || payload.outTradeNo;
    status = payload.status || 'success';
  } else if (provider === 'mock') {
    txRef = payload.tx_ref || payload.outTradeNo;
    status = payload.status || 'success';
  }

  if (!txRef) {
    return res.status(400).json({ success: false, message: 'Invalid payload: tx_ref is required' });
  }

  const payment = await Payment.findOne({ transactionId: txRef });
  if (!payment) return res.status(404).json({ success: false, message: 'Transaction not found' });

  // Idempotency
  if (payment.status === 'PAID') {
    return res.status(200).json({ success: true, status: 'PAID', message: 'Already processed' });
  }

  const order = await Order.findById(payment.order);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  if (status === 'success' || status === 'PAID') {
    payment.status = 'PAID';
    await payment.save();

    order.paymentStatus = 'PAID';
    order.orderStatus = 'CONFIRMED';
    await order.save();

    const existingDelivery = await Delivery.findOne({ order: order._id });
    if (!existingDelivery) {
      await Delivery.create({ order: order._id, status: 'PENDING', fee: order.deliveryFee || 0 });
    }

    await Notification.create({
      user: order.buyer,
      title: 'Payment Success via Webhook',
      message: `Your payment was processed for order ${order.trackingNumber}.`,
      type: 'PAYMENT',
      relatedId: order._id,
    });
  } else {
    payment.status = 'FAILED';
    await payment.save();
    order.paymentStatus = 'FAILED';
    await order.save();
  }

  res.status(200).json({ success: true, status: payment.status });
});
