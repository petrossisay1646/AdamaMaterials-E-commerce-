const Notification = require('../models/Notification');
const AppError = require('../utils/appError');
const asyncHandler = require('../utils/asyncHandler');

// 1. Get user notifications
exports.getMyNotifications = asyncHandler(async (req, res, next) => {
  const notifications = await Notification.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50); // limit to recent 50

  const unreadCount = await Notification.countDocuments({ user: req.user._id, read: false });

  res.status(200).json({
    success: true,
    count: notifications.length,
    unreadCount,
    notifications,
  });
});

// 2. Mark notification as read
exports.markNotificationRead = asyncHandler(async (req, res, next) => {
  const notification = await Notification.findById(req.params.id);

  if (!notification) {
    return next(new AppError('Notification not found.', 404));
  }

  // Ownership check
  if (notification.user.toString() !== req.user._id.toString()) {
    return next(new AppError('Unauthorized.', 403));
  }

  notification.read = true;
  await notification.save();

  res.status(200).json({
    success: true,
    notification,
  });
});

// 3. Mark all notifications as read
exports.markAllNotificationsRead = asyncHandler(async (req, res, next) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { $set: { read: true } });

  res.status(200).json({
    success: true,
    message: 'All notifications marked as read.',
  });
});
