const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const STAFF_PERMISSIONS = [
  'VIEW_ORDERS',
  'VERIFY_PAYMENTS',
  'MANAGE_DELIVERIES',
  'SET_DELIVERY_FEES',
  'UPDATE_ORDER_STATUS',
  'VIEW_SELLER_PAYOUTS',
  'PROCESS_PAYOUTS',
  'VIEW_DISPUTES',
];

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
    address: { type: String, default: '' },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: function () {
        return !this.googleId; // Password required for email/password users, optional for Google users
      },
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Don't return password by default
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    phoneNumber: {
      type: String,
      default: '',
      trim: true,
    },
    role: {
      type: String,
      enum: ['BUYER', 'SELLER', 'STAFF', 'ADMIN'],
      default: 'BUYER',
    },
    roles: {
      type: [
        {
          type: String,
          enum: ['BUYER', 'SELLER', 'STAFF', 'ADMIN'],
        },
      ],
      default: function () {
        return this.role ? [this.role] : ['BUYER'];
      },
    },
    isSellerApproved: {
      type: Boolean,
      default: false,
    },
    staffPermissions: {
      type: [
        {
          type: String,
          enum: STAFF_PERMISSIONS,
        },
      ],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    refreshToken: {
      type: String,
      select: false, // Keep it private
    },

    // ── Structured Seller Profile ─────────────────────────────────────────────
    sellerProfile: {
      shopName: {
        type: String,
        default: '',
        trim: true,
      },
      shopDescription: {
        type: String,
        default: '',
        trim: true,
      },
      shopAddress: {
        type: String,
        default: '',
        trim: true,
      },
      categoriesSold: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Category',
        },
      ],
      shopLocation: {
        type: pointSchema,
        default: undefined,
      },
      // PRIVATE Banking Information — never sent in public queries or serialized JSON
      bankName: {
        type: String,
        default: '',
        select: false,
      },
      bankAccountHolder: {
        type: String,
        default: '',
        select: false,
      },
      bankAccountNumber: {
        type: String,
        default: '',
        select: false,
      },
      approvalStatus: {
        type: String,
        enum: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SUSPENDED'],
        default: 'PENDING_APPROVAL',
      },
      rejectionReason: {
        type: String,
        default: '',
      },
    },

    // ── Structured Buyer Profile ──────────────────────────────────────────────
    buyerProfile: {
      preferredContact: {
        type: String,
        default: 'PHONE',
        enum: ['PHONE', 'EMAIL'],
      },
      defaultDeliveryNotes: {
        type: String,
        default: '',
      },
    },
  },
  {
    timestamps: true,
  }
);

// 2dsphere sparse index for location-based spatial queries on approved seller shops
userSchema.index({ 'sellerProfile.shopLocation': '2dsphere' }, { sparse: true });

// Keep isSellerApproved in sync with sellerProfile.approvalStatus
userSchema.pre('save', function (next) {
  if (this.sellerProfile && this.sellerProfile.approvalStatus) {
    this.isSellerApproved = this.sellerProfile.approvalStatus === 'APPROVED';
  } else if (this.isSellerApproved) {
    if (!this.sellerProfile) this.sellerProfile = {};
    this.sellerProfile.approvalStatus = 'APPROVED';
  }

  // Ensure role is reflected in roles array
  if (this.role && !this.roles.includes(this.role)) {
    this.roles.push(this.role);
  }
  next();
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.password || !this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
module.exports.STAFF_PERMISSIONS = STAFF_PERMISSIONS;