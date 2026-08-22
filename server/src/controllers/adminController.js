const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Category = require('../models/Category');
const MaterialType = require('../models/MaterialType');
const Dispute = require('../models/Dispute');
const Payout = require('../models/Payout');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const MapPlace = require('../models/MapPlace');
const AppError = require('../utils/appError');
const asyncHandler = require('../utils/asyncHandler');

// 1. User Management
exports.getUsers = asyncHandler(async (req, res, next) => {
  const { role, approvalStatus } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (approvalStatus) filter['sellerProfile.approvalStatus'] = approvalStatus;

  const users = await User.find(filter)
    .populate('sellerProfile.categoriesSold', 'name')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: users.length,
    users,
  });
});

// 1b. Review Seller Application (Approve / Reject)
exports.reviewSellerApplication = asyncHandler(async (req, res, next) => {
  const { sellerId, decision, rejectionReason } = req.body;

  if (!sellerId || !decision) {
    return next(new AppError('Seller ID and decision (APPROVE or REJECT) are required.', 400));
  }

  const seller = await User.findOne({ _id: sellerId, role: 'SELLER' });
  if (!seller) {
    return next(new AppError('Seller not found.', 404));
  }

  if (!seller.sellerProfile) seller.sellerProfile = {};

  const normalizedDecision = decision?.toUpperCase();
  if (normalizedDecision === 'APPROVE' || normalizedDecision === 'APPROVED') {
    seller.sellerProfile.approvalStatus = 'APPROVED';
    seller.isSellerApproved = true;
    seller.sellerProfile.rejectionReason = '';

    await Notification.create({
      user: seller._id,
      title: 'Seller Application Approved! 🎉',
      message: 'Congratulations! Your shop application has been approved by the administration. You can now publish usable materials to the marketplace.',
      type: 'SYSTEM',
    });
  } else if (normalizedDecision === 'REJECT' || normalizedDecision === 'REJECTED') {
    seller.sellerProfile.approvalStatus = 'REJECTED';
    seller.isSellerApproved = false;
    seller.sellerProfile.rejectionReason = rejectionReason || 'Information provided did not meet marketplace criteria.';

    await Notification.create({
      user: seller._id,
      title: 'Seller Application Update',
      message: `Your seller application was not approved: ${seller.sellerProfile.rejectionReason}`,
      type: 'SYSTEM',
    });
  } else {
    return next(new AppError('Invalid decision. Must be APPROVE or REJECT.', 400));
  }

  await seller.save({ validateBeforeSave: false });

  await AuditLog.create({
    user: req.user._id,
    action: `REVIEW_SELLER_${decision}`,
    targetType: 'User',
    targetId: seller._id,
    metadata: { decision, rejectionReason },
  });

  res.status(200).json({
    success: true,
    message: `Seller application ${decision === 'APPROVE' ? 'approved' : 'rejected'} successfully.`,
    seller,
  });
});

// 1c. Get Seller Private Bank Details (Strictly Admin Access with Audit Log)
exports.getSellerBankDetails = asyncHandler(async (req, res, next) => {
  const { sellerId } = req.params;

  const seller = await User.findById(sellerId).select(
    '+sellerProfile.bankName +sellerProfile.bankAccountHolder +sellerProfile.bankAccountNumber'
  );

  if (!seller || seller.role !== 'SELLER') {
    return next(new AppError('Seller not found.', 404));
  }

  await AuditLog.create({
    user: req.user._id,
    action: 'VIEW_SELLER_BANK_DETAILS',
    targetType: 'User',
    targetId: seller._id,
  });

  res.status(200).json({
    success: true,
    bankDetails: {
      bankName: seller.sellerProfile?.bankName || 'Not Provided',
      bankAccountHolder: seller.sellerProfile?.bankAccountHolder || 'Not Provided',
      bankAccountNumber: seller.sellerProfile?.bankAccountNumber || 'Not Provided',
    },
  });
});

exports.approveSeller = asyncHandler(async (req, res, next) => {
  const { sellerId } = req.body;

  const seller = await User.findOne({ _id: sellerId, role: 'SELLER' });
  if (!seller) {
    return next(new AppError('Seller not found.', 404));
  }

  if (!seller.sellerProfile) seller.sellerProfile = {};
  seller.sellerProfile.approvalStatus = 'APPROVED';
  seller.isSellerApproved = true;
  await seller.save({ validateBeforeSave: false });

  // Notify seller
  await Notification.create({
    user: seller._id,
    title: 'Seller Approved!',
    message: 'Your seller account has been approved. You can now list materials.',
    type: 'SYSTEM',
  });

  // Audit Log
  await AuditLog.create({
    user: req.user._id,
    action: 'APPROVE_SELLER',
    targetType: 'User',
    targetId: seller._id,
  });

  res.status(200).json({
    success: true,
    message: 'Seller approved successfully.',
    seller,
  });
});

exports.suspendUser = asyncHandler(async (req, res, next) => {
  const { userId } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    return next(new AppError('User not found.', 404));
  }

  if (user.role === 'ADMIN') {
    return next(new AppError('Administrators cannot be suspended.', 400));
  }

  user.isActive = false;
  await user.save({ validateBeforeSave: false });

  // Audit Log
  await AuditLog.create({
    user: req.user._id,
    action: 'SUSPEND_USER',
    targetType: 'User',
    targetId: user._id,
  });

  res.status(200).json({
    success: true,
    message: 'User account suspended.',
    user,
  });
});

exports.activateUser = asyncHandler(async (req, res, next) => {
  const { userId } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    return next(new AppError('User not found.', 404));
  }

  user.isActive = true;
  await user.save({ validateBeforeSave: false });

  // Audit Log
  await AuditLog.create({
    user: req.user._id,
    action: 'ACTIVATE_USER',
    targetType: 'User',
    targetId: user._id,
  });

  res.status(200).json({
    success: true,
    message: 'User account activated.',
    user,
  });
});

exports.createStaffAccount = asyncHandler(async (req, res, next) => {
  const { name, email, password, permissions } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new AppError('Email already in use.', 400));
  }

  const newStaff = await User.create({
    name,
    email,
    password,
    role: 'STAFF',
    staffPermissions: permissions || [],
  });

  // Audit Log
  await AuditLog.create({
    user: req.user._id,
    action: 'CREATE_STAFF_ACCOUNT',
    targetType: 'User',
    targetId: newStaff._id,
    metadata: { permissions },
  });

  res.status(201).json({
    success: true,
    staff: newStaff,
  });
});

exports.updateStaffPermissions = asyncHandler(async (req, res, next) => {
  const { staffId, permissions } = req.body;

  const staff = await User.findOne({ _id: staffId, role: 'STAFF' });
  if (!staff) {
    return next(new AppError('Staff member not found.', 404));
  }

  staff.staffPermissions = permissions || [];
  await staff.save({ validateBeforeSave: false });

  // Audit Log
  await AuditLog.create({
    user: req.user._id,
    action: 'UPDATE_STAFF_PERMISSIONS',
    targetType: 'User',
    targetId: staff._id,
    metadata: { permissions },
  });

  res.status(200).json({
    success: true,
    staff,
  });
});

// 2. Product Management
exports.reviewProduct = asyncHandler(async (req, res, next) => {
  const { productId, status, rejectionReason } = req.body;

  if (!productId || !status) {
    return next(new AppError('Product ID and status are required.', 400));
  }

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return next(new AppError('Status must be APPROVED or REJECTED.', 400));
  }

  const product = await Product.findById(productId);
  if (!product) {
    return next(new AppError('Product not found.', 404));
  }

  // Rule 2: Sellers cannot approve their own products
  if (product.seller.toString() === req.user._id.toString()) {
    return next(new AppError('You cannot approve your own product.', 400));
  }

  product.approvalStatus = status;
  if (status === 'REJECTED') {
    product.rejectionReason = rejectionReason || 'Does not meet our standards.';
  } else {
    product.rejectionReason = '';
  }
  await product.save();

  // Notify Seller
  await Notification.create({
    user: product.seller,
    title: status === 'APPROVED' ? 'Product Approved! 🎉' : 'Product Rejected ⚠️',
    message: status === 'APPROVED' 
      ? `Your product "${product.name}" has been approved and is now public.`
      : `Your product "${product.name}" was rejected. Reason: ${product.rejectionReason}`,
    type: 'PRODUCT',
    relatedId: product._id,
  });

  // Audit Log
  await AuditLog.create({
    user: req.user._id,
    action: `PRODUCT_REVIEW_${status}`,
    targetType: 'Product',
    targetId: product._id,
    metadata: { rejectionReason },
  });

  res.status(200).json({
    success: true,
    message: `Product has been ${status.toLowerCase()}.`,
    product,
  });
});

// 3. Category Management
exports.createCategory = asyncHandler(async (req, res, next) => {
  const { name, description } = req.body;
  const category = await Category.create({ name, description });

  await AuditLog.create({
    user: req.user._id,
    action: 'CREATE_CATEGORY',
    targetType: 'Category',
    targetId: category._id,
  });

  res.status(201).json({ success: true, category });
});

exports.updateCategory = asyncHandler(async (req, res, next) => {
  const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!category) return next(new AppError('Category not found.', 404));

  res.status(200).json({ success: true, category });
});

exports.deleteCategory = asyncHandler(async (req, res, next) => {
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) return next(new AppError('Category not found.', 404));

  res.status(200).json({ success: true, message: 'Category deleted.' });
});

// 4. Material Type Management
exports.createMaterialType = asyncHandler(async (req, res, next) => {
  const { name, description } = req.body;
  const materialType = await MaterialType.create({ name, description });

  await AuditLog.create({
    user: req.user._id,
    action: 'CREATE_MATERIAL_TYPE',
    targetType: 'MaterialType',
    targetId: materialType._id,
  });

  res.status(201).json({ success: true, materialType });
});

exports.updateMaterialType = asyncHandler(async (req, res, next) => {
  const materialType = await MaterialType.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!materialType) return next(new AppError('Material type not found.', 404));

  res.status(200).json({ success: true, materialType });
});

exports.deleteMaterialType = asyncHandler(async (req, res, next) => {
  const materialType = await MaterialType.findByIdAndDelete(req.params.id);
  if (!materialType) return next(new AppError('Material type not found.', 404));

  res.status(200).json({ success: true, message: 'Material type deleted.' });
});

// 5. System Audit Logs
exports.getAuditLogs = asyncHandler(async (req, res, next) => {
  const logs = await AuditLog.find()
    .populate('user', 'name email role')
    .sort({ createdAt: -1 })
    .limit(100);

  res.status(200).json({
    success: true,
    logs,
  });
});

// 6. Reports & Analytics Dashboards
exports.getDashboardStats = asyncHandler(async (req, res, next) => {
  const buyerCount = await User.countDocuments({ role: 'BUYER' });
  const sellerCount = await User.countDocuments({ role: 'SELLER' });
  const staffCount = await User.countDocuments({ role: 'STAFF' });
  const productCount = await Product.countDocuments();
  const pendingProductCount = await Product.countDocuments({ approvalStatus: 'PENDING_APPROVAL' });

  const totalOrders = await Order.countDocuments();
  const completedOrders = await Order.countDocuments({ orderStatus: 'COMPLETED' });

  // Sum of Revenue (subtotal of all confirmed/completed/delivered orders)
  const revenueStats = await Order.aggregate([
    {
      $match: {
        orderStatus: { $in: ['CONFIRMED', 'PROCESSING', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'] },
      },
    },
    {
      $group: {
        _id: null,
        totalSubtotal: { $sum: '$subtotal' },
        totalDeliveryFees: { $sum: '$deliveryFee' },
        totalAmount: { $sum: '$total' },
      },
    },
  ]);

  const revenue = revenueStats[0]?.totalSubtotal || 0;
  const deliveryFees = revenueStats[0]?.totalDeliveryFees || 0;

  // Seller payouts stats
  const payoutStats = await Payout.aggregate([
    {
      $group: {
        _id: '$status',
        total: { $sum: '$payoutAmount' },
        count: { $sum: 1 },
      },
    },
  ]);

  const payoutsSummary = {
    PAID: 0,
    ELIGIBLE: 0,
    PENDING: 0,
  };

  payoutStats.forEach(stat => {
    if (payoutsSummary[stat._id] !== undefined) {
      payoutsSummary[stat._id] = stat.total;
    }
  });

  const pendingDisputes = await Dispute.countDocuments({ status: { $in: ['OPEN', 'UNDER_REVIEW'] } });

  res.status(200).json({
    success: true,
    stats: {
      users: {
        buyers: buyerCount,
        sellers: sellerCount,
        staff: staffCount,
        total: buyerCount + sellerCount + staffCount + 1, // +1 for Admin
      },
      products: {
        total: productCount,
        pending: pendingProductCount,
      },
      orders: {
        total: totalOrders,
        completed: completedOrders,
      },
      finance: {
        revenue,
        deliveryFees,
        totalTransacted: revenue + deliveryFees,
        payouts: payoutsSummary,
      },
      disputes: {
        pending: pendingDisputes,
      },
    },
  });
});

// 7. Get all products for administrator audit
exports.getAdminProducts = asyncHandler(async (req, res, next) => {
  const products = await Product.find()
    .populate('category', 'name')
    .populate('materialType', 'name')
    .populate('seller', 'name email')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: products.length,
    products,
  });
});

// 8. Reset All Database Statistics & Test Data
exports.resetStats = asyncHandler(async (req, res, next) => {
  const seedData = require('../jobs/seed');
  await seedData(true);

  res.status(200).json({
    success: true,
    message: 'All marketplace statistics, orders, payments, payouts, and notifications have been reset to zero for clean testing!',
  });
});

// 9. Map Places Management (Admin-managed local material hubs / scrap depots)
exports.getMapPlaces = asyncHandler(async (req, res, next) => {
  const { source, isActive } = req.query;
  const filter = {};
  if (source) filter.source = source;
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const places = await MapPlace.find(filter).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: places.length,
    places,
  });
});

exports.createMapPlace = asyncHandler(async (req, res, next) => {
  const { name, category, materials, description, address, phone, latitude, longitude, isVerified } = req.body;

  if (!name || !category || !address || latitude === undefined || longitude === undefined) {
    return next(new AppError('Place name, category, address, latitude, and longitude are required.', 400));
  }

  const newPlace = await MapPlace.create({
    name: name.trim(),
    category: category.trim(),
    materials: Array.isArray(materials) ? materials : (materials ? [materials] : []),
    description: description || '',
    address: address.trim(),
    phone: phone || '',
    location: {
      type: 'Point',
      coordinates: [Number(longitude), Number(latitude)],
    },
    source: 'ADMIN_MANAGED',
    isVerified: isVerified !== undefined ? isVerified : true,
    addedBy: req.user._id,
  });

  await AuditLog.create({
    user: req.user._id,
    action: 'CREATE_MAP_PLACE',
    targetType: 'MapPlace',
    targetId: newPlace._id,
    metadata: { name: newPlace.name },
  });

  res.status(201).json({
    success: true,
    message: 'Local map place created successfully.',
    place: newPlace,
  });
});

exports.updateMapPlace = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { name, category, materials, description, address, phone, latitude, longitude, isVerified, isActive } = req.body;

  const place = await MapPlace.findById(id);
  if (!place) {
    return next(new AppError('Map place not found.', 404));
  }

  if (name) place.name = name.trim();
  if (category) place.category = category.trim();
  if (materials) place.materials = Array.isArray(materials) ? materials : [materials];
  if (description !== undefined) place.description = description;
  if (address) place.address = address.trim();
  if (phone !== undefined) place.phone = phone.trim();
  if (isVerified !== undefined) place.isVerified = isVerified;
  if (isActive !== undefined) place.isActive = isActive;
  if (latitude !== undefined && longitude !== undefined) {
    place.location = {
      type: 'Point',
      coordinates: [Number(longitude), Number(latitude)],
    };
  }

  await place.save();

  res.status(200).json({
    success: true,
    message: 'Map place updated successfully.',
    place,
  });
});

exports.deleteMapPlace = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const place = await MapPlace.findById(id);
  if (!place) {
    return next(new AppError('Map place not found.', 404));
  }

  await place.deleteOne();

  await AuditLog.create({
    user: req.user._id,
    action: 'DELETE_MAP_PLACE',
    targetType: 'MapPlace',
    targetId: id,
  });

  res.status(200).json({
    success: true,
    message: 'Map place deleted successfully.',
  });
});
