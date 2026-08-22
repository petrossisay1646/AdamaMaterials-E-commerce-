const mongoose = require('mongoose');

const mapPlaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Place name is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    materials: {
      type: [String],
      default: [],
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: [true, 'Coordinates [lng, lat] are required'],
      },
    },
    source: {
      type: String,
      enum: ['ADMIN_MANAGED', 'OSM_EXTERNAL'],
      default: 'ADMIN_MANAGED',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// 2dsphere index for location-based spatial queries
mapPlaceSchema.index({ location: '2dsphere' });
mapPlaceSchema.index({ source: 1, isActive: 1 });

module.exports = mongoose.model('MapPlace', mapPlaceSchema);