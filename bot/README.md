# 🤖 Telegram Payment Receipt Verifier Bot

A standalone Python Telegram Bot for **Marketplace Staff & Admins** to verify bank transfer receipts directly inside Telegram.

---

## 🌟 Key Capabilities

1. **Instant Alerts**: Notifies staff in Telegram whenever a buyer submits a bank transfer reference number.
2. **Interactive Inline Buttons**: Staff can click `[ ✅ Approve (PAID) ]` or `[ ❌ Reject (FAILED) ]` directly on Telegram message cards to update payment status instantly!
3. **Command Support**:
   - `/pending` — Fetches all pending manual bank transfer receipts.
   - `/verify <payment_id> <PAID|FAILED>` — Manually verifies a payment by ID.
   - `/start` or `/help` — Displays guidance.

---

## 🚀 How to Setup & Run

### Prerequisites
- Python 3.8 or higher installed on your system.
- `requests` library installed:
  ```bash
  pip install requests
  ```

### 1. Get a Telegram Bot Token
1. Open Telegram and search for `@BotFather`.
2. Send `/newbot` and follow instructions to get your **Bot API Token** (e.g. `123456789:ABCdefGHIjklMNO...`).

### 2. Configuration & Execution

**Windows (PowerShell):**
```powershell
$env:TELEGRAM_BOT_TOKEN="YOUR_TELEGRAM_BOT_TOKEN_HERE"
$env:MARKETPLACE_API_URL="http://localhost:5000/api/v1"
$env:STAFF_EMAIL="staff.finance@marketplace.com"
$env:STAFF_PASSWORD="StaffPass123"

python bot/telegram_verifier_bot.py
```

**macOS / Linux:**
```bash
export TELEGRAM_BOT_TOKEN="YOUR_TELEGRAM_BOT_TOKEN_HERE"
export MARKETPLACE_API_URL="http://localhost:5000/api/v1"
export STAFF_EMAIL="staff.finance@marketplace.com"
export STAFF_PASSWORD="StaffPass123"

python bot/telegram_verifier_bot.py
```

---

## 🔄 How Verification Works

1. **Buyer Submits Receipt**: Buyer enters bank transfer reference on the website (`AM-XXXX-XXXX`).
2. **Alert Sent**: Node.js backend notifies the Telegram channel via `TelegramBotService`.
3. **Staff Approves in Telegram**: Staff clicks `[ ✅ Approve (PAID) ]` button in Telegram.
4. **Backend Sync**: The Python Bot calls `POST /api/v1/payments/verify-manual` on the Node.js server.
5. **State Progression**: Order transitions to `CONFIRMED`, `Delivery` is initialized, and `Payout` becomes `ELIGIBLE` upon delivery!
