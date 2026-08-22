const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    provider: {
      type: String,
      enum: ['TELEBIRR', 'CHAPA', 'BANK_TRANSFER', 'MOCK'],
      required: true,
    },
    transactionId: {
      type: String,
      sparse: true,
    },
    refNumber: {
      type: String, // Bank transfer transaction reference number
      sparse: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
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
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Staff or Admin who verified a manual payment
    },
    verificationNotes: {
      type: String,
      default: '',
    },
    verificationDate: {
      type: Date,
    },

    // ── Telegram Bot Integration ──────────────────────────────────────────────
    // One-time secure token for the checkout → bot deep link.
    // Stored as a SHA-256 hash; the raw token is sent to the buyer only once.
    botToken: {
      type: String,
      sparse: true,
      select: false, // Never returned in normal queries
    },
    botTokenExpiry: {
      type: Date, // Token expires after 24 hours
    },
    // The buyer's Telegram chat_id, recorded when they open the bot via the deep link.
    // Used to send direct notifications (payment approved, order delivered).
    buyerTelegramChatId: {
      type: String,
      sparse: true,
    },
    // Payment method chosen inside the bot (TELEBIRR or BANK_TRANSFER)
    botPaymentMethod: {
      type: String,
      enum: ['TELEBIRR', 'BANK_TRANSFER'],
    },
    // Bank name chosen inside the bot (e.g. CBE, Awash, CBO, Dashen, BoA, Zemen, Other)
    bankName: {
      type: String,
    },
    // Submission method chosen (REF_NUMBER, RECEIPT_IMAGE, or BOTH)
    submissionType: {
      type: String,
      enum: ['REF_NUMBER', 'RECEIPT_IMAGE', 'BOTH'],
      default: 'REF_NUMBER',
    },
    // Receipt screenshot / photo URL or Telegram file reference
    receiptImage: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Payment', paymentSchema);
