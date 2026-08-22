const axios = require('axios');
const crypto = require('crypto');

// ─────────────────────────────────────────────────────────────────────────────
// Base class
// ─────────────────────────────────────────────────────────────────────────────
class PaymentProvider {
  async initializePayment(order, callbackUrl) {
    throw new Error('initializePayment not implemented');
  }
  async verifyPayment(transactionId) {
    throw new Error('verifyPayment not implemented');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. DEVELOPMENT ONLY — Mock Payment Provider
//    ⚠️  This provider MUST NEVER be used in production.
// ─────────────────────────────────────────────────────────────────────────────
class MockProvider extends PaymentProvider {
  _guardProduction() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('MockProvider is disabled in production. Configure real payment keys.');
    }
  }

  async initializePayment(order, callbackUrl) {
    this._guardProduction();
    const txRef = `TX-MOCK-${Date.now()}-${order._id}`;
    const paymentUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/mock-payment/${txRef}?amount=${order.total}`;
    return { success: true, transactionId: txRef, paymentUrl };
  }

  async verifyPayment(transactionId) {
    this._guardProduction();
    if (transactionId.startsWith('TX-MOCK-')) {
      return { status: 'PAID', transactionId, amount: 0 };
    }
    return { status: 'FAILED', transactionId };
  }
}

/**
 * Safely extract a human-readable message from any Chapa error response
 * without converting nested objects to [object Object].
 */
function extractChapaErrorMessage(error) {
  if (!error) return 'Unknown Chapa Gateway Error';
  const respData = error.response?.data;

  if (respData) {
    // 1. If message is a clean string
    if (typeof respData.message === 'string' && respData.message.trim()) {
      return respData.message.trim();
    }
    // 2. If message is an object containing validation field errors (e.g. { amount: ['...'], email: ['...'] })
    if (respData.message && typeof respData.message === 'object') {
      const fieldErrors = [];
      for (const [field, msgs] of Object.entries(respData.message)) {
        if (Array.isArray(msgs)) {
          fieldErrors.push(`${field}: ${msgs.join(', ')}`);
        } else if (typeof msgs === 'string') {
          fieldErrors.push(`${field}: ${msgs}`);
        } else {
          fieldErrors.push(`${field}: ${JSON.stringify(msgs)}`);
        }
      }
      if (fieldErrors.length > 0) return fieldErrors.join(' | ');
    }
    // 3. If errors dictionary exists (e.g. { errors: { phone: [...] } })
    if (respData.errors && typeof respData.errors === 'object') {
      const fieldErrors = [];
      for (const [field, msgs] of Object.entries(respData.errors)) {
        if (Array.isArray(msgs)) {
          fieldErrors.push(`${field}: ${msgs.join(', ')}`);
        } else if (typeof msgs === 'string') {
          fieldErrors.push(`${field}: ${msgs}`);
        } else {
          fieldErrors.push(`${field}: ${JSON.stringify(msgs)}`);
        }
      }
      if (fieldErrors.length > 0) return fieldErrors.join(' | ');
    }
    // 4. Other string error fields
    if (typeof respData.error === 'string' && respData.error.trim()) return respData.error.trim();
    if (typeof respData.data === 'string' && respData.data.trim()) return respData.data.trim();
  }

  // 5. Fallback to standard Error.message
  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }

  return 'Chapa Payment Gateway Initialization Failed';
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Chapa Provider (Ethiopian Payment Gateway)
//    Docs: https://developer.chapa.co/
// ─────────────────────────────────────────────────────────────────────────────
class ChapaProvider extends PaymentProvider {
  constructor() {
    super();
    this.secretKey = process.env.CHAPA_SECRET_KEY;
    this.baseUrl = 'https://api.chapa.co/v1';
  }

  async initializePayment(order, callbackUrl) {
    const key = process.env.CHAPA_SECRET_KEY;
    if (!key) {
      throw new Error('CHAPA_SECRET_KEY is missing in server/.env. Please configure your Chapa API Key (e.g. CHASECK_TEST-...).');
    }

    const txRef = `TX-CHAPA-${Date.now()}-${order._id}`;
    let phone = order.deliveryAddress?.phoneNumber || order.buyer?.phoneNumber || '0911000000';
    let formattedPhone = String(phone).replace(/[^0-9+]/g, '');
    if (formattedPhone.startsWith('+251')) formattedPhone = '0' + formattedPhone.substring(4);
    else if (formattedPhone.startsWith('251')) formattedPhone = '0' + formattedPhone.substring(3);
    if (!formattedPhone || formattedPhone.length < 9) formattedPhone = '0911000000';

    const clientUrl =
      process.env.CLIENT_URL ||
      (process.env.NODE_ENV === 'production'
        ? 'https://adama-materials-e-commerce.vercel.app'
        : 'http://localhost:5173');

    const backendUrl =
      process.env.BACKEND_URL ||
      (process.env.NODE_ENV === 'production'
        ? 'https://adamamaterials-e-commerce.onrender.com'
        : 'http://localhost:5000');

    const returnUrl = `${clientUrl}/payment/callback?tx_ref=${txRef}&provider=chapa`;
    const defaultCallback = `${backendUrl}/api/v1/payments/webhook/chapa`;

    const fullName = (order.buyer?.name || 'Buyer Customer').trim();
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || 'Buyer';
    const lastName = nameParts.slice(1).join(' ') || 'Customer';
    const email = order.buyer?.email || 'buyer@adama-materials.com';

    const payload = {
      amount: String(order.total),
      currency: 'ETB',
      email: email,
      first_name: firstName,
      last_name: lastName,
      phone_number: formattedPhone,
      tx_ref: txRef,
      callback_url: callbackUrl || defaultCallback,
      return_url: returnUrl,
      customization: {
        title: 'AdaMeeshaa',
        description: `Order ${order.trackingNumber || txRef}`.substring(0, 80),
      },
    };

    try {
      const response = await axios.post(`${this.baseUrl}/transaction/initialize`, payload, {
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      if (response.data?.status === 'success' && response.data?.data?.checkout_url) {
        return {
          success: true,
          transactionId: txRef,
          paymentUrl: response.data.data.checkout_url,
        };
      }
      
      const errMsg = extractChapaErrorMessage({ response });
      throw new Error(errMsg);
    } catch (error) {
      const respData = error.response?.data;
      console.error('[Chapa API Error Details]:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: respData,
        message: error.message,
      });
      const errMsg = extractChapaErrorMessage(error);
      throw new Error(`Chapa Gateway Error: ${errMsg}`);
    }
  }

  async verifyPayment(transactionId) {
    const key = process.env.CHAPA_SECRET_KEY;
    if (!key) {
      throw new Error('CHAPA_SECRET_KEY is missing in server/.env.');
    }
    try {
      const response = await axios.get(`${this.baseUrl}/transaction/verify/${transactionId}`, {
        headers: { Authorization: `Bearer ${key}` },
        timeout: 15000,
      });
      if (response.data?.status === 'success') {
        const d = response.data.data;
        if (d.status === 'success') {
          return { status: 'PAID', transactionId: d.tx_ref, amount: parseFloat(d.amount), rawData: d };
        }
      }
      return { status: 'FAILED', transactionId, message: response.data?.message || 'Payment verification failed on Chapa' };
    } catch (error) {
      console.error('[Chapa Verify Error]:', error.response?.data || error.message);
      return { status: 'FAILED', transactionId, message: error.response?.data?.message || error.message };
    }
  }

  /**
   * Verify that a webhook payload came from Chapa using HMAC-SHA256.
   * @param {string} rawBody - The raw request body string (before JSON.parse)
   * @param {string} signatureHeader - Value of the x-chapa-signature header
   * @returns {boolean}
   */
  verifyWebhookSignature(rawBody, signatureHeader) {
    const secret = process.env.CHAPA_WEBHOOK_SECRET;
    if (!secret || !signatureHeader) return false;
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signatureHeader, 'hex'), Buffer.from(expected, 'hex'));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Telebirr Provider
// ─────────────────────────────────────────────────────────────────────────────
class TelebirrProvider extends PaymentProvider {
  constructor() {
    super();
    this.apiKey = process.env.TELEBIRR_API_KEY;
    this.secret = process.env.TELEBIRR_SECRET;
  }

  async initializePayment(order, callbackUrl) {
    const txRef = `TX-TELEBIRR-${Date.now()}-${order._id}`;
    return { success: true, transactionId: txRef, paymentUrl: '' };
  }

  async verifyPayment(transactionId) {
    return { status: 'PENDING_VERIFICATION', transactionId };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Bank Transfer Provider — Always requires manual staff verification
// ─────────────────────────────────────────────────────────────────────────────
class BankTransferProvider extends PaymentProvider {
  async initializePayment(order, callbackUrl) {
    const txRef = `TX-BANK-${Date.now()}-${order._id}`;
    return { 
        success: true, 
        transactionId: txRef, 
        paymentUrl: '',
        instructions: 'Please transfer to Commercial Bank of Ethiopia and upload receipt.'
    };
  }

  async verifyPayment(transactionId) {
    return { status: 'PENDING_VERIFICATION', transactionId };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PaymentService — selects the correct provider per environment
// ─────────────────────────────────────────────────────────────────────────────
class PaymentService {
  constructor() {
    this.mock = new MockProvider();
    this.chapa = new ChapaProvider();
    this.telebirr = new TelebirrProvider();
    this.bankTransfer = new BankTransferProvider();
  }

  /**
   * Get configurable marketplace commission rate.
   * Reads MARKETPLACE_COMMISSION_RATE env var; defaults to 0.10 (10%).
   */
  static getCommissionRate() {
    const rate = parseFloat(process.env.MARKETPLACE_COMMISSION_RATE);
    return isNaN(rate) || rate <= 0 || rate >= 1 ? 0.10 : rate;
  }

  getProvider(method) {
    if (method === 'BANK_TRANSFER') return this.bankTransfer;

    // Isolate MockProvider strictly to automated unit/integration test runs (NODE_ENV === 'test')
    if (process.env.NODE_ENV === 'test') {
      return this.mock;
    }

    if (method === 'CHAPA') {
      return this.chapa;
    }

    if (method === 'TELEBIRR') return this.telebirr;

    throw new Error(`Unknown payment method: ${method}`);
  }

  async initialize(order, method, callbackUrl) {
    return this.getProvider(method).initializePayment(order, callbackUrl);
  }

  async verify(transactionId, method) {
    return this.getProvider(method).verifyPayment(transactionId);
  }

  /**
   * Verify Chapa webhook signature.
   * @param {string} rawBody - Raw request body string
   * @param {string} signatureHeader - x-chapa-signature header value
   */
  verifyChapaWebhook(rawBody, signatureHeader) {
    return this.chapa.verifyWebhookSignature(rawBody, signatureHeader);
  }
}

module.exports = new PaymentService();
