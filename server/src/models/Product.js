const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price must be non-negative'],
    },
    quantity: {
      type: Number,
      required: [true, 'Product quantity is required'],
      min: [0, 'Quantity cannot be negative'],
      default: 1,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Product category is required'],
    },
    materialType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MaterialType',
      required: [true, 'Material type is required'],
    },
    condition: {
      type: String,
      enum: ['New', 'Like New', 'Good', 'Fair', 'Used'],
      required: [true, 'Product condition is required'],
    },
    images: {
      type: [String],
      validate: [
        {
          validator: function (val) {
            return val.length > 0;
          },
          message: 'At least one product image is required',
        },
      ],
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvalStatus: {
      type: String,
      enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SUSPENDED'],
      default: 'DRAFT',
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    location: {
      subCity: {
        type: String,
        required: true,
        default: 'Adama Kebele 04',
      },
      city: {
        type: String,
        required: true,
        default: 'Adama',
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for searching and filtering
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ approvalStatus: 1, category: 1, materialType: 1, price: 1 });

module.exports = mongoose.model('Product', productSchema);
