const mongoose = require('mongoose');

const payoutItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
});

const payoutSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    items: [payoutItemSchema],
    amount: {
      type: Number,
      required: true, // Total sale amount for this seller's products in the order
    },
    commissionRate: {
      type: Number,
      required: true, // Configurable commission percentage (e.g. 0.10 for 10%)
    },
    commissionAmount: {
      type: Number,
      required: true, // amount * commissionRate
    },
    payoutAmount: {
      type: Number,
      required: true, // amount - commissionAmount
    },
    status: {
      type: String,
      enum: ['PENDING', 'ELIGIBLE', 'PROCESSING', 'PAID', 'FAILED', 'ON_HOLD'],
      default: 'PENDING',
    },
    transactionRef: {
      type: String, // Bank payout reference
      default: '',
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    processedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Payout', payoutSchema);
