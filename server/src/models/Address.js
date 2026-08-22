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

const addressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      default: 'Home', // e.g., Home, Work, Shop
    },
    streetAddress: {
      type: String,
      required: true,
    },
    subCity: {
      type: String,
      required: true,
      default: 'Adama', // e.g. Kebele 01, Kebele 02, Bole Subcity
    },
    city: {
      type: String,
      required: true,
      default: 'Adama',
    },
    state: {
      type: String,
      default: 'Oromia',
    },
    postalCode: {
      type: String,
      default: '1000',
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    location: {
      type: pointSchema,
      default: undefined,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one default address per user
addressSchema.pre('save', async function (next) {
  if (this.isDefault) {
    await this.constructor.updateMany(
      { user: this.user, _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }
  next();
});

module.exports = mongoose.model('Address', addressSchema);