const mongoose = require('mongoose');

const pointSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  },
  { _id: false }
);

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
});

const orderSchema = new mongoose.Schema(
  {
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: [orderItemSchema],
    subtotal: {
      type: Number,
      required: true,
    },
    deliveryFee: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['CHAPA', 'MOCK', 'TELEBIRR', 'BANK_TRANSFER'],
      required: true,
      default: 'CHAPA',
    },
    orderStatus: {
      type: String,
      enum: [
        'PENDING_PAYMENT',
        'PAYMENT_VERIFICATION',
        'CONFIRMED',
        'PROCESSING',
        'READY_FOR_DELIVERY',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'CANCELLED',
        'DISPUTED',
        'REFUNDED',
        'COMPLETED',
      ],
      default: 'PENDING_PAYMENT',
    },
    paymentStatus: {
      type: String,
      enum: [
        'PENDING',
        'PROCESSING',
        'PAID',
        'FAILED',
        'REFUNDED',
        'PENDING_VERIFICATION',
      ],
      default: 'PENDING',
    },
    deliveryStatus: {
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
    deliveryAddress: {
      streetAddress: { type: String, required: true },
      subCity: { type: String, required: true },
      city: { type: String, required: true },
      phoneNumber: { type: String, required: true },
      latitude: { type: Number },
      longitude: { type: Number },
    },
    deliveryLocation: {
      type: pointSchema,
      default: undefined,
    },
    trackingNumber: {
      type: String,
      unique: true,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ deliveryLocation: '2dsphere' }, { sparse: true });


module.exports = mongoose.model('Order', orderSchema);