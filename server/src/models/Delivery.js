const mongoose = require('mongoose');

const deliveryHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    required: true,
  },
  note: {
    type: String,
    default: '',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const deliverySchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    assignedStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Staff assigned for the physical delivery
    },
    fee: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: [
        'PENDING',
        'ASSIGNED',
        'PICKED_UP',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'FAILED',
      ],
      default: 'PENDING',
    },
    notes: {
      type: String,
      default: '',
    },
    currentLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
      updatedAt: { type: Date },
    },
    trackingActive: {
      type: Boolean,
      default: false,
    },
    routePolyline: {
      type: String,
      default: '',
    },
    history: [deliveryHistorySchema],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Delivery', deliverySchema);