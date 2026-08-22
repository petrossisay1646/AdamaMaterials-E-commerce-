const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      required: true, // e.g. 'PRODUCT_APPROVED', 'USER_SUSPENDED', 'PAYMENT_VERIFIED'
    },
    targetType: {
      type: String, // e.g. 'Product', 'User', 'Payment', 'Order', 'Payout', 'Dispute'
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed, // Stores contextual info (e.g. { rejectionReason: '...' })
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Only log creation time
  }
);

// Indexes for auditing
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ user: 1, action: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
