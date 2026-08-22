const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['ORDER', 'PAYMENT', 'PAYOUT', 'DISPUTE', 'PRODUCT', 'SYSTEM'],
      required: true,
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId, // Can refer to OrderId, ProductId, DisputeId, etc.
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast loading user notifications
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
