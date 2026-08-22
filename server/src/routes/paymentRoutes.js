const express = require('express');
const multer = require('multer');
const paymentController = require('../controllers/paymentController');
const { protect, restrictTo, hasPermission } = require('../middleware/auth');

// Configure multer memory storage for receipt images
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (PNG, JPG, JPEG, WEBP) are allowed.'), false);
    }
  },
});

const router = express.Router();

// ── Public webhook (originates from payment gateways, no JWT) ─────────────
router.post('/webhook/:provider', paymentController.handleWebhook);

// ── Public bot routes (authenticated by one-time token or chat_id, not JWT) ──
// Called by the Telegram bot on behalf of the buyer
router.post('/bot-link-validate', paymentController.botLinkValidate);
router.post('/bot-submit-receipt', paymentController.botSubmitReceipt);
router.get('/bot-active-session/:telegramChatId', paymentController.botGetActiveSession);

// ── JWT-protected routes ──────────────────────────────────────────────────
router.use(protect);

// Buyer: generate a secure Telegram deep link after checkout
router.get('/generate-bot-link/:orderId', restrictTo('BUYER'), paymentController.generateBotLink);

// Buyer: website receipt submission with optional screenshot upload & transaction ID
router.post('/submit-receipt', restrictTo('BUYER'), upload.single('receiptImage'), paymentController.submitReceiptWithProof);

// Buyer: website-based bank transfer reference submission (backward compatibility)
router.post('/submit-reference', restrictTo('BUYER'), paymentController.submitBankTransferDetails);

// Staff/Admin: verify manual bank transfer
router.post(
  '/verify-manual',
  restrictTo('ADMIN', 'STAFF'),
  hasPermission('VERIFY_PAYMENTS'),
  paymentController.verifyPaymentManual
);

// Staff/Admin: list all pending manual bank transfers
router.get(
  '/pending',
  restrictTo('ADMIN', 'STAFF'),
  hasPermission('VERIFY_PAYMENTS'),
  paymentController.getPendingManualPayments
);

// Frontend callback after online payment gateway redirect
router.get('/verify-online', paymentController.verifyOnlinePayment);

module.exports = router;
