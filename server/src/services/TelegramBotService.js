const axios = require('axios');

class TelegramBotService {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN || '8327143273:AAFyMD05C35sLQomemy7eh8Yrv7rnUas4jk';
    this.adminChatId = process.env.TELEGRAM_CHAT_ID; // Admin group/channel chat ID
  }

  /**
   * Returns true only if the admin chat ID is configured.
   */
  isAdminConfigured() {
    return Boolean(this.token && this.adminChatId);
  }

  /**
   * Internal: POST to any Telegram Bot API method.
   */
  async _post(method, payload) {
    try {
      const url = `https://api.telegram.org/bot${this.token}/${method}`;
      const res = await axios.post(url, payload, { timeout: 8000 });
      return { success: true, data: res.data };
    } catch (err) {
      console.error(`[TelegramBot] ${method} error:`, err.response?.data || err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send a plain HTML message to any chat_id (admin group OR buyer).
   */
  async sendTo(chatId, text) {
    if (!chatId) return;
    return this._post('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
  }

  /**
   * Send a message with inline buttons to any chat_id.
   */
  async sendWithButtons(chatId, text, buttons) {
    if (!chatId) return;
    return this._post('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: buttons },
    });
  }

  /**
   * Fetch the bot's own username from Telegram (used for deep link generation).
   * Cached after first call.
   */
  async getBotUsername() {
    if (this._cachedUsername) return this._cachedUsername;
    try {
      const res = await this._post('getMe', {});
      this._cachedUsername = res.data?.result?.username || null;
      return this._cachedUsername;
    } catch {
      return null;
    }
  }

  // ── ADMIN NOTIFICATIONS ───────────────────────────────────────────────────

  /**
   * Alert admins when a buyer submits a bank transfer receipt via the bot.
   * Sends a card with inline [Approve] / [Reject] buttons to the admin chat.
   */
  async getAdminChatIds() {
    const chatIds = new Set();
    if (this.adminChatId) chatIds.add(this.adminChatId);

    try {
      const fs = require('fs');
      const path = require('path');
      const adminChatsFile = path.join(__dirname, '../../../bot/admin_chats.json');
      if (fs.existsSync(adminChatsFile)) {
        const data = JSON.parse(fs.readFileSync(adminChatsFile, 'utf8'));
        if (Array.isArray(data)) {
          data.forEach((c) => chatIds.add(String(c)));
        }
      }
    } catch (err) {
      console.error('[TelegramBot] Could not read admin_chats.json:', err.message);
    }
    return Array.from(chatIds);
  }

  /**
   * Alert admins when a buyer submits a bank transfer receipt via the bot.
   * Sends a card with inline [Approve] / [Reject] buttons to all logged-in admin chats.
   */
  async notifyAdminNewReceipt(order, buyer, refNumber, paymentId, botPaymentMethod, bankName, submissionType, receiptImage) {
    const adminChatIds = await this.getAdminChatIds();
    if (adminChatIds.length === 0) {
      console.log(`[TelegramBot] No admin chats registered — skipping admin alert for payment ${paymentId}`);
      return;
    }

    const amount = order.total || order.amount || 0;
    const methodStr = botPaymentMethod === 'TELEBIRR' ? '📱 Telebirr' : '🏦 Bank Transfer';
    const bankStr = bankName ? ` (${bankName})` : '';
    const isImageSubmission = submissionType === 'RECEIPT_IMAGE' || submissionType === 'BOTH';

    const text = [
      '🚨 <b>New Payment Receipt Submitted</b> 🚨',
      '━━━━━━━━━━━━━━━━━━━━━',
      `📦 <b>Order:</b> <code>${order.trackingNumber || order._id}</code>`,
      `👤 <b>Buyer:</b> ${buyer.name} (${buyer.email})`,
      `💳 <b>Method:</b> ${methodStr}${bankStr}`,
      isImageSubmission
        ? `📷 <b>Submission:</b> Screenshot / Photo attached below`
        : `🔢 <b>Ref No:</b> <code>${refNumber}</code>`,
      `💰 <b>Amount:</b> <b>${Number(amount).toLocaleString()} ETB</b>`,
      `📌 <b>Status:</b> PENDING_VERIFICATION`,
      '',
      '⬇️ <b>Tap a button below to verify this receipt:</b>',
    ].join('\n');

    const buttons = [[
      { text: '✅ Approve (PAID)',  callback_data: `verify:PAID:${paymentId}`  },
      { text: '❌ Reject (FAILED)', callback_data: `verify:FAILED:${paymentId}` },
    ]];

    for (const chatId of adminChatIds) {
      // If buyer submitted a screenshot, send the photo first then the action card
      if (isImageSubmission && receiptImage) {
        await this._post('sendPhoto', {
          chat_id: chatId,
          photo: receiptImage,
          caption: `📷 <b>Payment Receipt Screenshot</b>\nOrder: <code>${order.trackingNumber || order._id}</code>\nBuyer: ${buyer.name}`,
          parse_mode: 'HTML',
        });
      }
      await this.sendWithButtons(chatId, text, buttons);
    }
  }

  /**
   * Legacy alias — used by old submitBankTransferDetails controller.
   * Now just calls notifyAdminNewReceipt.
   */
  async notifyBankTransferReceipt(order, buyer, refNumber, paymentId) {
    return this.notifyAdminNewReceipt(order, buyer, refNumber, paymentId);
  }

  // ── BUYER NOTIFICATIONS ───────────────────────────────────────────────────

  /**
   * Notify the BUYER directly in Telegram that their payment was approved.
   * Called by paymentController.verifyPaymentManual() when status → PAID.
   *
   * @param {string} buyerChatId - Buyer's Telegram chat_id (from Payment.buyerTelegramChatId)
   * @param {Object} order - Order document (trackingNumber, total, _id)
   */
  async notifyBuyerPaymentApproved(buyerChatId, order) {
    if (!buyerChatId) return;

    const text = [
      '✅ <b>Payment Verified — Your Order is Confirmed!</b>',
      '━━━━━━━━━━━━━━━━━━━━━',
      `📦 <b>Order Tracking No:</b>`,
      `<code>${order.trackingNumber}</code>`,
      '',
      '📋 <b>What happens next?</b>',
      '• Your order is now being prepared for delivery.',
      '• You will receive another message here when your order is on its way.',
      '• <b>Show this tracking number when receiving your delivery.</b>',
      '',
      '💬 <b>Need help?</b> Contact us through the marketplace portal.',
    ].join('\n');

    return this.sendTo(buyerChatId, text);
  }

  /**
   * Notify the BUYER directly in Telegram that their order has been delivered.
   * Called by orderController.updateOrderStatus() when status → DELIVERED.
   *
   * @param {string} buyerChatId - Buyer's Telegram chat_id
   * @param {Object} order - Order document
   */
  async notifyBuyerDelivered(buyerChatId, order) {
    if (!buyerChatId) return;

    const text = [
      '📦 <b>Your Order Has Been Delivered!</b>',
      '━━━━━━━━━━━━━━━━━━━━━',
      `🎉 Order <code>${order.trackingNumber}</code> has been marked as delivered.`,
      '',
      'Thank you for shopping with <b>Adama Materials Marketplace</b>!',
      'If you have any issues with your delivery, please contact us through the portal.',
    ].join('\n');

    return this.sendTo(buyerChatId, text);
  }

  /**
   * Notify admin Telegram channel of a delivery status change.
   */
  async notifyDeliveryUpdate(order, status, note) {
    if (!this.isAdminConfigured()) return;

    const statusEmoji = {
      PENDING:          '🕐',
      ASSIGNED:         '📍',
      PICKED_UP:        '🚚',
      OUT_FOR_DELIVERY: '🏃',
      DELIVERED:        '✅',
      FAILED:           '❌',
    }[status] || '📦';

    const text = [
      `${statusEmoji} <b>Delivery Status Updated</b>`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `📦 <b>Order:</b> <code>${order.trackingNumber || order._id}</code>`,
      `📌 <b>New Status:</b> <b>${status}</b>`,
      `📝 <b>Note:</b> ${note || 'N/A'}`,
    ].join('\n');

    return this.sendTo(this.adminChatId, text);
  }
}

module.exports = new TelegramBotService();
