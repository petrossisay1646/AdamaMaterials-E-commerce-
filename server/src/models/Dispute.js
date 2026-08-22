const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product', // The specific product in the order being disputed
    },
    reason: {
      type: String,
      required: true,
      enum: [
        'ITEM_NOT_RECEIVED',
        'ITEM_NOT_AS_DESCRIBED',
        'DAMAGED_ITEM',
        'INCORRECT_QUANTITY',
        'OTHER',
      ],
    },
    description: {
      type: String,
      required: true,
    },
    evidence: {
      type: [String], // Evidence image URLs
      default: [],
    },
    status: {
      type: String,
      enum: ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED', 'CLOSED'],
      default: 'OPEN',
    },
    adminDecision: {
      type: String,
      enum: [
        'PENDING',
        'BUYER_REFUND',
        'SELLER_PAYOUT_RELEASED',
        'PARTIAL_REFUND',
        'NO_ACTION',
      ],
      default: 'PENDING',
    },
    adminNotes: {
      type: String,
      default: '',
    },
    resolvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Dispute', disputeSchema);
