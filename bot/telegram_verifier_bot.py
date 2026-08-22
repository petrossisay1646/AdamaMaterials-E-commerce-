#!/usr/bin/env python3
"""
Adama Materials Marketplace - Telegram Admin & Buyer Bot
=========================================================

PAGES / ROLES:
  1. ADMIN PAGE/PANEL (Role-restricted):
     Accessible only to registered admins/staff after `/login email password`.
     Persistent keyboard with buttons:
       • 📋 Pending Receipts — Approve/Reject receipts with inline buttons
       • 📊 Dashboard Stats — Live revenue and product metrics
       • ✅ Pending Orders — Orders awaiting verification
       • 🔄 Refresh / ❓ Help
  
  2. BUYER PAGE/WIZARD (Token-secured):
     Accessible only through one-time link redirect from checkout (/start TOKEN).
     Wizard step flow:
       Step 1: Welcome and select payment method (Telebirr or Bank Transfer)
       Step 2: If Bank Transfer, select Bank (CBE, CBO, Awash, Dashen, BoA, Birhan, Other)
       Step 3: Prompt and submit transfer reference number
       Step 4: Pending verification screen until Admin approves/rejects

Requirements:
    pip install requests
"""

import os
import sys
import time
import json
import logging
import requests

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────
MARKETPLACE_API_URL = os.getenv("MARKETPLACE_API_URL", "http://localhost:5000/api/v1")
STAFF_EMAIL         = os.getenv("STAFF_EMAIL",         "staff.finance@marketplace.com")
STAFF_PASSWORD      = os.getenv("STAFF_PASSWORD",      "StaffPass123")
BOT_TOKEN           = os.getenv("TELEGRAM_BOT_TOKEN",  "8327143273:AAFyMD05C35sLQomemy7eh8Yrv7rnUas4jk")
TELEGRAM_API        = f"https://api.telegram.org/bot{BOT_TOKEN}"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(
        stream=open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1, closefd=False)
    )]
)

admin_session = requests.Session()

# ─────────────────────────────────────────────────────────────────────────────
# Persistent Admin Chats Storage
# ─────────────────────────────────────────────────────────────────────────────
ADMIN_CHATS_FILE = os.path.join(os.path.dirname(__file__), "admin_chats.json")
AUTHORIZED_ADMIN_CHATS = set()

# Initialize or load admin chats
if os.path.exists(ADMIN_CHATS_FILE):
    try:
        with open(ADMIN_CHATS_FILE, "r") as f:
            data = json.load(f)
            if isinstance(data, list):
                AUTHORIZED_ADMIN_CHATS = set(str(c) for c in data)
    except Exception as e:
        logging.error(f"Error loading admin chats: {e}")

def save_admin_chats():
    try:
        with open(ADMIN_CHATS_FILE, "w") as f:
            json.dump(list(AUTHORIZED_ADMIN_CHATS), f)
    except Exception as e:
        logging.error(f"Error saving admin chats: {e}")

def is_chat_admin(chat_id):
    chat_str = str(chat_id)
    # Check environment override
    env_admin_chat = os.getenv("TELEGRAM_CHAT_ID")
    if env_admin_chat and chat_str == env_admin_chat:
        return True
    return chat_str in AUTHORIZED_ADMIN_CHATS

# ─────────────────────────────────────────────────────────────────────────────
# Per-chat state machine for Buyers (Persisted to chat_state.json)
# ─────────────────────────────────────────────────────────────────────────────
CHAT_STATE_FILE = os.path.join(os.path.dirname(__file__), "chat_state.json")
CHAT_STATE = {}

if os.path.exists(CHAT_STATE_FILE):
    try:
        with open(CHAT_STATE_FILE, "r") as f:
            CHAT_STATE = json.load(f)
    except Exception as e:
        logging.error(f"Error loading chat state: {e}")

def save_chat_state():
    try:
        with open(CHAT_STATE_FILE, "w") as f:
            json.dump(CHAT_STATE, f)
    except Exception as e:
        logging.error(f"Error saving chat state: {e}")


def get_chat_state(chat_id):
    """Retrieve active session from memory, persistent disk file, or backend API."""
    if not chat_id:
        return None
    key = str(chat_id)
    # 1. Check in-memory dictionary
    if key in CHAT_STATE and isinstance(CHAT_STATE[key], dict):
        return CHAT_STATE[key]

    # 2. Check persistent disk file
    if os.path.exists(CHAT_STATE_FILE):
        try:
            with open(CHAT_STATE_FILE, "r") as f:
                data = json.load(f)
                if isinstance(data, dict) and key in data:
                    CHAT_STATE[key] = data[key]
                    return CHAT_STATE[key]
        except Exception as e:
            logging.error(f"Error reading chat_state.json: {e}")

    # 3. Fallback: Query backend for active pending order for this Telegram user
    try:
        r = requests.get(f"{MARKETPLACE_API_URL}/payments/bot-active-session/{key}", timeout=5)
        if r.status_code == 200 and r.json().get("success"):
            data = r.json()
            restored_state = {
                "state": "choosing_method",
                "token": None,
                "paymentId": data.get("paymentId"),
                "orderTracking": data.get("orderTracking"),
                "orderTotal": data.get("orderTotal"),
                "botPaymentMethod": data.get("botPaymentMethod"),
                "bankName": data.get("bankName")
            }
            CHAT_STATE[key] = restored_state
            save_chat_state()
            logging.info(f"Automatically restored active buyer session for chat_id={key} from backend database.")
            return restored_state
    except Exception as e:
        logging.error(f"Error querying active session from backend: {e}")

    return None

# ─────────────────────────────────────────────────────────────────────────────
# Admin keyboard
# ─────────────────────────────────────────────────────────────────────────────
ADMIN_MENU = {
    "keyboard": [
        [{"text": "📋 Pending Receipts"}, {"text": "📊 Dashboard Stats"}],
        [{"text": "✅ Pending Orders"},   {"text": "🔄 Refresh"}],
        [{"text": "❓ Help"}]
    ],
    "resize_keyboard": True,
    "persistent": True
}

# ─────────────────────────────────────────────────────────────────────────────
# Marketplace API helpers
# ─────────────────────────────────────────────────────────────────────────────
def admin_login():
    try:
        r = admin_session.post(
            f"{MARKETPLACE_API_URL}/auth/login",
            json={"email": STAFF_EMAIL, "password": STAFF_PASSWORD},
            timeout=10
        )
        if r.status_code == 200 and r.json().get("success"):
            u = r.json().get("user", {})
            logging.info(f"[OK] Admin authenticated: {u.get('name')} ({u.get('email')})")
            return True
        logging.error(f"Admin login failed: {r.text[:200]}")
        return False
    except Exception as e:
        logging.error(f"Admin login error: {e}")
        return False


def api_admin_get(path):
    try:
        r = admin_session.get(f"{MARKETPLACE_API_URL}{path}", timeout=10)
        if r.status_code == 401:
            admin_login()
            r = admin_session.get(f"{MARKETPLACE_API_URL}{path}", timeout=10)
        return r.json() if r.ok else {}
    except Exception as e:
        logging.error(f"Admin GET {path}: {e}")
        return {}


def api_admin_post(path, payload):
    try:
        r = admin_session.post(f"{MARKETPLACE_API_URL}{path}", json=payload, timeout=10)
        if r.status_code == 401:
            admin_login()
            r = admin_session.post(f"{MARKETPLACE_API_URL}{path}", json=payload, timeout=10)
        return r.json() if r.headers.get("content-type", "").startswith("application/json") else {"success": False, "message": r.text}
    except Exception as e:
        return {"success": False, "message": str(e)}


def api_public_post(path, payload):
    try:
        r = requests.post(f"{MARKETPLACE_API_URL}{path}", json=payload, timeout=10)
        return r.json() if r.headers.get("content-type", "").startswith("application/json") else {"success": False, "message": r.text}
    except Exception as e:
        return {"success": False, "message": str(e)}


def get_pending_payments():
    data = api_admin_get("/payments/pending")
    return data.get("payments", [])


def admin_verify_payment(payment_id, status):
    return api_admin_post("/payments/verify-manual", {
        "paymentId": payment_id,
        "status": status,
        "notes": f"Verified via Telegram Admin Bot ({status})"
    })


def get_dashboard_stats():
    return api_admin_get("/admin/dashboard-stats").get("stats", {})


# ─────────────────────────────────────────────────────────────────────────────
# Telegram API helpers
# ─────────────────────────────────────────────────────────────────────────────
def tg(method, payload):
    try:
        r = requests.post(f"{TELEGRAM_API}/{method}", json=payload, timeout=10)
        return r.json()
    except Exception as e:
        logging.error(f"Telegram {method}: {e}")
        return {}


def send(chat_id, text, reply_markup=None, parse_mode="HTML"):
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": True
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup
    tg("sendMessage", payload)


def edit_msg(chat_id, msg_id, text, reply_markup=None):
    payload = {
        "chat_id": chat_id,
        "message_id": msg_id,
        "text": text,
        "parse_mode": "HTML"
    }
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup
    tg("editMessageText", payload)


def answer_cb(cb_id, text, alert=False):
    tg("answerCallbackQuery", {
        "callback_query_id": cb_id,
        "text": text,
        "show_alert": alert
    })


# ─────────────────────────────────────────────────────────────────────────────
# BUYER FLOW — Wizard handlers
# ─────────────────────────────────────────────────────────────────────────────

def handle_buyer_start(chat_id, token, buyer_name):
    """
    Step 1: Check token validity and show payment method options.
    """
    send(chat_id, "⏳ <b>Verifying your order session...</b>")

    result = api_public_post("/payments/bot-link-validate", {
        "token": token,
        "telegramChatId": str(chat_id)
    })

    if not result.get("success"):
        send(
            chat_id,
            "❌ <b>Order Session Not Found or Expired</b>\n\n"
            "This link is from a previous session that has timed out (or the server was restarted).\n\n"
            "👉 <b>How to verify your order:</b>\n"
            "1. Open <a href='http://localhost:5173'>http://localhost:5173</a> in your browser\n"
            "2. Sign in as <code>buyer1@marketplace.com</code> (Password: <code>BuyerPass123</code>)\n"
            "3. Place an order and click <b>'Submit Receipt via Telegram Bot'</b>\n\n"
            "A fresh verification session will open automatically!"
        )
        return

    buyer = result.get("buyer", {})
    order = result.get("order", {})
    payment_id = result.get("paymentId")
    already_submitted = result.get("alreadySubmitted", False)

    if already_submitted:
        send(
            chat_id,
            f"👋 Hi <b>{buyer.get('name', buyer_name)}</b>!\n\n"
            f"📋 <b>Your receipt has already been submitted.</b>\n\n"
            f"📦 <b>Order Status:</b> <code>{order.get('status', 'PENDING_VERIFICATION')}</code>\n"
            f"📌 <b>Payment Status:</b> {order.get('paymentStatus', 'PENDING_VERIFICATION')}\n\n"
            f"Please wait. We will notify you here as soon as the admin verifies your payment."
        )
        return

    # Initialize state
    CHAT_STATE[str(chat_id)] = {
        "state": "choosing_method",
        "token": token,
        "paymentId": payment_id,
        "orderTracking": order.get("trackingNumber"),
        "orderTotal": order.get("total"),
        "botPaymentMethod": None,
        "bankName": None
    }
    save_chat_state()

    text = (
        f"👋 Welcome <b>{buyer.get('name', buyer_name)}</b>!\n\n"
        f"📦 <b>Order Tracking:</b> <code>{order.get('trackingNumber', 'N/A')}</code>\n"
        f"💰 <b>Total Amount:</b> <b>{order.get('total', 0):,} ETB</b>\n\n"
        f"<b>Step 1/3: Please select your payment method:</b>"
    )

    buttons = {
        "inline_keyboard": [
            [
                {"text": "📱 Telebirr", "callback_data": "buyer_pay:TELEBIRR"},
                {"text": "🏦 Bank Transfer", "callback_data": "buyer_pay:BANK_TRANSFER"}
            ]
        ]
    }
    send(chat_id, text, reply_markup=buttons)


def resume_buyer_session(chat_id, state, name="there"):
    """Re-send the current step's buttons/prompts if user has an active session."""
    current_state = state.get("state", "choosing_method")
    order_tracking = state.get("orderTracking", "N/A")
    order_total = state.get("orderTotal", 0)

    if current_state == "choosing_method":
        text = (
            f"👋 Welcome back <b>{name}</b>!\n\n"
            f"📦 <b>Order Tracking:</b> <code>{order_tracking}</code>\n"
            f"💰 <b>Total Amount:</b> <b>{order_total:,} ETB</b>\n\n"
            f"<b>Step 1/3: Please select your payment method:</b>"
        )
        buttons = {
            "inline_keyboard": [
                [
                    {"text": "📱 Telebirr", "callback_data": "buyer_pay:TELEBIRR"},
                    {"text": "🏦 Bank Transfer", "callback_data": "buyer_pay:BANK_TRANSFER"}
                ]
            ]
        }
        send(chat_id, text, reply_markup=buttons)

    elif current_state == "choosing_bank":
        text = (
            f"🏦 <b>Order Tracking:</b> <code>{order_tracking}</code>\n"
            f"💰 <b>Amount:</b> {order_total:,} ETB\n\n"
            f"<b>Step 2/3: Please select the bank you transferred to:</b>"
        )
        buttons = {
            "inline_keyboard": [
                [
                    {"text": "CBE", "callback_data": "buyer_bank:CBE"},
                    {"text": "CBO (Coop)", "callback_data": "buyer_bank:CBO"}
                ],
                [
                    {"text": "Awash Bank", "callback_data": "buyer_bank:Awash"},
                    {"text": "Dashen Bank", "callback_data": "buyer_bank:Dashen"}
                ],
                [
                    {"text": "Abyssinia (BoA)", "callback_data": "buyer_bank:BoA"},
                    {"text": "Birhan Bank", "callback_data": "buyer_bank:Birhan"}
                ],
                [
                    {"text": "Other Bank", "callback_data": "buyer_bank:Other"}
                ]
            ]
        }
        send(chat_id, text, reply_markup=buttons)

    elif current_state == "choosing_verification_type":
        method = state.get("botPaymentMethod", "Payment")
        bank = state.get("bankName", "")
        method_str = f"Bank Transfer ({bank})" if bank else ("Telebirr" if method == "TELEBIRR" else method)
        text = (
            f"💳 <b>Selected: {method_str}</b>\n"
            f"💰 <b>Amount:</b> {order_total:,} ETB\n\n"
            f"<b>How would you like to submit your receipt for verification?</b>"
        )
        buttons = {
            "inline_keyboard": [
                [
                    {"text": "🔢 Transaction ID / Ref Number", "callback_data": "buyer_verif_type:REF_NUMBER"},
                ],
                [
                    {"text": "📷 Upload Screenshot / Photo", "callback_data": "buyer_verif_type:RECEIPT_IMAGE"},
                ]
            ]
        }
        send(chat_id, text, reply_markup=buttons)

    elif current_state == "awaiting_ref":
        method = state.get("botPaymentMethod", "")
        bank = state.get("bankName", "")
        if method == "TELEBIRR":
            prompt = "Please type and send the <b>10-digit Transaction ID / Reference Number</b> from your Telebirr receipt."
        elif bank:
            prompt = f"Please type and send the <b>Bank Transfer Reference Number</b> from your {bank} receipt or SMS."
        else:
            prompt = "Please type and send the <b>Reference Number</b> from your receipt."
        send(chat_id, f"🔢 <b>Awaiting Reference Number</b>\n\n{prompt}")

    elif current_state == "awaiting_photo":
        send(chat_id, "📷 <b>Awaiting Receipt Screenshot</b>\n\nPlease send a photo or screenshot of your payment receipt.")


def handle_buyer_pay_callback(chat_id, msg_id, method, state):
    state["botPaymentMethod"] = method
    save_chat_state()

    if method == "TELEBIRR":
        # Ask how they want to verify
        state["state"] = "choosing_verification_type"
        save_chat_state()
        order_total = state.get('orderTotal') or 0
        text = (
            f"📱 <b>Selected: Telebirr</b>\n"
            f"💰 <b>Amount:</b> {order_total:,} ETB\n\n"
            f"Please make the transfer to our Telebirr account, then:\n\n"
            f"<b>Step 2/3: How would you like to submit your receipt for verification?</b>"
        )
        buttons = {
            "inline_keyboard": [
                [
                    {"text": "🔢 Transaction ID / Ref Number", "callback_data": "buyer_verif_type:REF_NUMBER"},
                ],
                [
                    {"text": "📷 Upload Screenshot / Photo", "callback_data": "buyer_verif_type:RECEIPT_IMAGE"},
                ]
            ]
        }
        edit_msg(chat_id, msg_id, text, reply_markup=buttons)
    
    elif method == "BANK_TRANSFER":
        state["state"] = "choosing_bank"
        save_chat_state()
        order_total = state.get('orderTotal') or 0
        text = (
            f"🏦 <b>Selected: Bank Transfer</b>\n"
            f"💰 <b>Amount:</b> {order_total:,} ETB\n\n"
            f"<b>Step 2/3: Please select the bank you transferred to:</b>"
        )
        buttons = {
            "inline_keyboard": [
                [
                    {"text": "CBE", "callback_data": "buyer_bank:CBE"},
                    {"text": "CBO (Coop)", "callback_data": "buyer_bank:CBO"}
                ],
                [
                    {"text": "Awash Bank", "callback_data": "buyer_bank:Awash"},
                    {"text": "Dashen Bank", "callback_data": "buyer_bank:Dashen"}
                ],
                [
                    {"text": "Abyssinia (BoA)", "callback_data": "buyer_bank:BoA"},
                    {"text": "Birhan Bank", "callback_data": "buyer_bank:Birhan"}
                ],
                [
                    {"text": "Other Bank", "callback_data": "buyer_bank:Other"}
                ]
            ]
        }
        edit_msg(chat_id, msg_id, text, reply_markup=buttons)


def handle_buyer_bank_callback(chat_id, msg_id, bank_name, state):
    state["bankName"] = bank_name
    state["state"] = "choosing_verification_type"
    save_chat_state()

    order_total = state.get('orderTotal') or 0
    text = (
        f"🏦 <b>Selected: Bank Transfer ({bank_name})</b>\n"
        f"💰 <b>Amount:</b> {order_total:,} ETB\n\n"
        f"Please perform the transfer to our <b>{bank_name}</b> account, then:\n\n"
        f"<b>Step 3/4: How would you like to submit your receipt for verification?</b>"
    )
    buttons = {
        "inline_keyboard": [
            [
                {"text": "🔢 Transaction ID / Ref Number", "callback_data": "buyer_verif_type:REF_NUMBER"},
            ],
            [
                {"text": "📷 Upload Screenshot / Photo", "callback_data": "buyer_verif_type:RECEIPT_IMAGE"},
            ]
        ]
    }
    edit_msg(chat_id, msg_id, text, reply_markup=buttons)


def handle_buyer_verification_type_callback(chat_id, msg_id, verif_type, state):
    """Buyer chose REF_NUMBER or RECEIPT_IMAGE as their verification method."""
    state["submissionType"] = verif_type

    if verif_type == "REF_NUMBER":
        state["state"] = "awaiting_ref"
        save_chat_state()
        method = state.get("botPaymentMethod", "")
        bank = state.get("bankName", "")
        if method == "TELEBIRR":
            prompt = "<b>Please type and send the 10-digit Transaction ID / Reference Number</b> from your Telebirr receipt."
        elif bank:
            prompt = f"<b>Please type and send the Bank Transfer Reference Number</b> from your {bank} receipt or SMS confirmation."
        else:
            prompt = "<b>Please type and send the Reference Number</b> from your payment receipt."
        text_out = (
            f"🔢 <b>Verification via Reference Number</b>\n\n"
            + prompt
        )
        edit_msg(chat_id, msg_id, text_out, reply_markup={"inline_keyboard": []})

    elif verif_type == "RECEIPT_IMAGE":
        state["state"] = "awaiting_photo"
        save_chat_state()
        text_out = (
            "📷 <b>Verification via Screenshot</b>\n\n"
            "Please send a <b>photo or screenshot</b> of your payment receipt.\n"
            "Make sure the Transaction ID / Reference Number is clearly visible."
        )
        edit_msg(chat_id, msg_id, text_out, reply_markup={"inline_keyboard": []})


def handle_buyer_photo_input(chat_id, message, state):
    """Buyer sent a photo/document while in awaiting_photo state."""
    photo    = message.get("photo")
    document = message.get("document")
    file_id  = None

    if photo:
        # Telegram sends array of photo sizes — use last (highest quality)
        file_id = photo[-1].get("file_id")
    elif document and document.get("mime_type", "").startswith("image/"):
        file_id = document.get("file_id")

    if not file_id:
        send(chat_id, "⚠️ Could not read the image. Please send a <b>photo</b> or screenshot of your receipt.")
        return

    token         = state.get("token")
    method        = state.get("botPaymentMethod")
    bank          = state.get("bankName")
    order_tracking = state.get("orderTracking")

    send(chat_id, "⏳ <b>Submitting your receipt screenshot...</b>")

    payload = {
        "token":           token,
        "telegramChatId":  str(chat_id),
        "refNumber":       "SCREENSHOT_UPLOAD",
        "botPaymentMethod": method,
        "bankName":        bank,
        "submissionType":  "RECEIPT_IMAGE",
        "receiptImage":    file_id,
    }

    logging.info(f"[PHOTO SUBMIT] chat={chat_id} method={method} file_id={file_id[:20]}...")
    result = api_public_post("/payments/bot-submit-receipt", payload)
    logging.info(f"[PHOTO SUBMIT RESULT] {result}")

    if result.get("success"):
        CHAT_STATE.pop(str(chat_id), None)
        save_chat_state()

        if method == "TELEBIRR":
            method_str = "Telebirr"
        elif bank:
            method_str = f"Bank Transfer ({bank})"
        else:
            method_str = "Bank Transfer"

        send(
            chat_id,
            f"✅ <b>Receipt Submitted successfully!</b>\n\n"
            f"📦 <b>Order Tracking:</b> <code>{order_tracking}</code>\n"
            f"💳 <b>Payment Method:</b> {method_str}\n"
            f"📷 <b>Receipt:</b> Screenshot / Photo Uploaded\n\n"
            f"⏳ <b>Verification Status: PENDING</b>\n\n"
            f"Our admin team is verifying your payment. Once approved, the status will change to PAID and we will send you your Order ID here."
        )

    elif result.get("alreadySubmitted"):
        CHAT_STATE.pop(str(chat_id), None)
        save_chat_state()
        send(
            chat_id,
            "ℹ️ <b>Already Submitted</b>\n\n"
            "Your receipt is already pending admin verification. "
            "We will notify you here once it is approved."
        )

    else:
        err = result.get("message", "Submission failed. Please try again.")
        logging.error(f"[PHOTO SUBMIT ERROR] chat={chat_id} error={err}")
        send(
            chat_id,
            f"❌ <b>Submission Failed</b>\n\n"
            f"<i>{err}</i>\n\n"
            f"Please try again or send /start to restart your session."
        )



def handle_buyer_reference_input(chat_id, text, state):
    ref_number = text.strip()
    method = state.get("botPaymentMethod")
    token = state.get("token")
    bank = state.get("bankName")
    order_tracking = state.get("orderTracking")

    if method == "TELEBIRR" and len(ref_number) != 10:
        send(
            chat_id,
            "⚠️ <b>Invalid Telebirr Reference</b>\n\n"
            "Telebirr transaction reference numbers must be exactly <b>10 digits</b>. "
            "Please check your Telebirr receipt or SMS and type the 10-digit code."
        )
        return

    if len(ref_number) < 4:
        send(chat_id, "⚠️ That reference number seems too short. Please type the exact reference number from your receipt.")
        return

    send(chat_id, "⏳ <b>Submitting receipt details...</b>")

    result = api_public_post("/payments/bot-submit-receipt", {
        "token": token,
        "telegramChatId": str(chat_id),
        "refNumber": ref_number,
        "botPaymentMethod": method,
        "bankName": bank
    })

    if result.get("success"):
        CHAT_STATE.pop(str(chat_id), None) # Clear session
        save_chat_state()
        if method == "TELEBIRR":
            method_str = "Telebirr"
        elif bank:
            method_str = f"Bank Transfer ({bank})"
        else:
            method_str = "Bank Transfer"

        send(
            chat_id,
            f"✅ <b>Receipt Submitted successfully!</b>\n\n"
            f"📦 <b>Order Tracking:</b> <code>{order_tracking}</code>\n"
            f"💳 <b>Payment Method:</b> {method_str}\n"
            f"🏦 <b>Ref Number:</b> <code>{ref_number}</code>\n\n"
            f"⏳ <b>Verification Status: PENDING</b>\n\n"
            f"Our admin team is verifying your payment. Once approved, the status "
            f"will change to PAID and we will send you your Order ID here."
        )
    elif result.get("alreadySubmitted"):
        CHAT_STATE.pop(str(chat_id), None)
        save_chat_state()
        send(chat_id, "ℹ️ Receipt already submitted. Pending admin verification.")
    else:
        err = result.get("message", "Submission failed.")
        send(chat_id, f"❌ <b>Error:</b> {err}\nPlease try again.")


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN FLOW — Handlers
# ─────────────────────────────────────────────────────────────────────────────

def admin_show_menu(chat_id, greeting=""):
    text = (
        f"{greeting}\n"
        "🏪 <b>Adama Materials Marketplace</b>\n"
        "👮 <b>Admin Verification Panel</b>\n\n"
        "Use the buttons below to manage payments:"
    ).strip()
    send(chat_id, text, reply_markup=ADMIN_MENU)


def admin_show_pending(chat_id):
    send(chat_id, "⏳ <b>Fetching pending receipts...</b>")
    payments = get_pending_payments()

    if not payments:
        send(chat_id, "✅ <b>All Clear!</b>\nNo pending bank transfer receipts.", reply_markup=ADMIN_MENU)
        return

    send(chat_id, f"🔔 <b>{len(payments)} Pending Receipt(s) Awaiting Review:</b>", reply_markup=ADMIN_MENU)

    for p in payments:
        order = p.get("order", {}) or {}
        buyer = order.get("buyer", {}) or {}
        buyer_name = buyer.get("name", "Unknown") if isinstance(buyer, dict) else "Buyer"
        buyer_email = buyer.get("email", "") if isinstance(buyer, dict) else ""
        
        method_label = "Telebirr" if p.get("botPaymentMethod") == "TELEBIRR" else "Bank Transfer"
        bank_label = f" ({p.get('bankName')})" if p.get("bankName") else ""

        card = (
            f"💳 <b>Payment Receipt</b>\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"📦 <b>Order:</b> <code>{order.get('trackingNumber', 'N/A')}</code>\n"
            f"👤 <b>Buyer:</b> {buyer_name}\n"
            f"📧 <b>Email:</b> {buyer_email}\n"
            f"💳 <b>Payment Select:</b> {method_label}{bank_label}\n"
            f"🏦 <b>Ref No:</b> <code>{p.get('refNumber', 'Not provided')}</code>\n"
            f"💰 <b>Amount:</b> <b>{p.get('amount', 0):,} ETB</b>\n"
            f"📌 <b>Status:</b> {p.get('status', 'PENDING_VERIFICATION')}"
        )
        buttons = {"inline_keyboard": [[
            {"text": "✅ Approve (PAID)",  "callback_data": f"verify:PAID:{p.get('_id')}"},
            {"text": "❌ Reject (FAILED)", "callback_data": f"verify:FAILED:{p.get('_id')}"},
        ]]}
        send(chat_id, card, reply_markup=buttons)


def admin_show_stats(chat_id):
    send(chat_id, "📊 <b>Loading stats...</b>")
    stats = get_dashboard_stats()

    if not stats:
        send(chat_id, "⚠️ Could not load stats. Is the server running?", reply_markup=ADMIN_MENU)
        return

    finance  = stats.get("finance", {})
    orders   = stats.get("orders",  {})
    users    = stats.get("users",   {})
    products = stats.get("products", {})

    send(
        chat_id,
        f"📊 <b>Live Marketplace Dashboard</b>\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"💰 <b>Finance</b>\n"
        f"  Revenue: <b>{finance.get('revenue', 0):,} ETB</b>\n"
        f"  Pending Payouts: <b>{finance.get('pendingPayouts', 0):,} ETB</b>\n\n"
        f"📦 <b>Orders</b>\n"
        f"  Total: {orders.get('total', 0)}\n"
        f"  Pending: {orders.get('pending', 0)}\n"
        f"  Delivered: {orders.get('delivered', 0)}\n\n"
        f"👥 <b>Users</b>\n"
        f"  Total: {users.get('total', 0)}\n"
        f"  Pending Seller Approvals: {users.get('pendingApprovals', 0)}\n\n"
        f"🛍️ <b>Products</b>\n"
        f"  Approved: {products.get('approved', 0)}\n"
        f"  Pending Review: {products.get('pendingReview', 0)}",
        reply_markup=ADMIN_MENU
    )


def admin_show_pending_orders(chat_id):
    send(chat_id, "📦 <b>Loading pending orders...</b>")
    data = api_admin_get("/orders?status=PAYMENT_VERIFICATION&limit=10")
    orders = data.get("orders", [])
    if not orders:
        data = api_admin_get("/orders?status=PENDING_PAYMENT&limit=10")
        orders = data.get("orders", [])

    if not orders:
        send(chat_id, "✅ <b>No orders pending payment verification.</b>", reply_markup=ADMIN_MENU)
        return

    send(chat_id, f"📦 <b>{len(orders)} Order(s) Awaiting Verification:</b>", reply_markup=ADMIN_MENU)
    for o in orders[:8]:
        buyer = o.get("buyer", {}) or {}
        buyer_name = buyer.get("name", "Unknown") if isinstance(buyer, dict) else "Buyer"
        send(
            chat_id,
            f"📦 <code>{o.get('trackingNumber', o.get('_id', 'N/A'))}</code>\n"
            f"👤 {buyer_name} | 💰 {o.get('total', 0):,} ETB\n"
            f"💳 {o.get('paymentMethod', 'N/A')} | 📌 {o.get('orderStatus', 'N/A')}"
        )


def admin_show_help(chat_id):
    send(
        chat_id,
        "❓ <b>Admin Bot Help</b>\n\n"
        "📋 <b>Pending Receipts</b> — Review and approve/reject buyer bank transfer receipts.\n\n"
        "📊 <b>Dashboard Stats</b> — Live revenue, orders, and user counts.\n\n"
        "✅ <b>Pending Orders</b> — Orders awaiting payment verification.\n\n"
        "🔄 <b>Refresh</b> — Re-authenticate and reload the menu.\n\n"
        "🔔 <b>Auto Alerts</b> — When a buyer submits a receipt via the bot, "
        "you automatically receive a card here with Approve/Reject buttons.",
        reply_markup=ADMIN_MENU
    )


# ─────────────────────────────────────────────────────────────────────────────
# Admin login command handler
# ─────────────────────────────────────────────────────────────────────────────
def handle_admin_login(chat_id, text):
    parts = text.split()
    if len(parts) < 3:
        send(
            chat_id,
            "⚠️ <b>Usage:</b> <code>/login email password</code>\n"
            "Example: <code>/login staff.finance@marketplace.com StaffPass123</code>"
        )
        return

    email = parts[1].strip()
    password = parts[2].strip()

    send(chat_id, "⏳ <b>Authenticating with marketplace portal...</b>")

    try:
        r = admin_session.post(
            f"{MARKETPLACE_API_URL}/auth/login",
            json={"email": email, "password": password},
            timeout=10
        )
        if r.status_code == 200 and r.json().get("success"):
            user = r.json().get("user", {})
            role = user.get("role")
            if role in ("ADMIN", "STAFF"):
                chat_str = str(chat_id)
                AUTHORIZED_ADMIN_CHATS.add(chat_str)
                save_admin_chats()
                
                logging.info(f"Admin logged in via Telegram: {user.get('email')} (Chat ID: {chat_id})")
                admin_show_menu(chat_id, greeting=f"✅ <b>Welcome, {user.get('name')}!</b>\nAuthorized as {role}.")
            else:
                send(chat_id, "❌ <b>Access Denied:</b> This account is not an Admin or Staff on the platform.")
        else:
            msg = r.json().get("message", "Invalid credentials.") if r.headers.get("content-type", "").startswith("application/json") else "Failed to authenticate."
            send(chat_id, f"❌ <b>Login Failed:</b> {msg}")
    except Exception as e:
        send(chat_id, f"⚠️ <b>Error:</b> Could not reach server: {e}")


def show_unauthorized_message(chat_id, name):
    text = (
        f"👋 Hi <b>{name}</b>!\n\n"
        "❌ <b>Access Restricted</b>\n\n"
        "This bot is only for Adama Materials Marketplace Staff, or Buyers with a valid order link.\n\n"
        "• <b>Buyers:</b> Please complete a purchase on our website and click the Telegram button to link your order.\n"
        "• <b>Staff/Admins:</b> Log in to your panel by sending:\n"
        "<code>/login email password</code>"
    )
    send(chat_id, text)


# ─────────────────────────────────────────────────────────────────────────────
# Telegram Callback Query Router
# ─────────────────────────────────────────────────────────────────────────────
def handle_callback(callback):
    cb_id    = callback.get("id")
    data     = callback.get("data", "")
    from_id  = callback.get("from", {}).get("id")
    chat_id  = callback.get("message", {}).get("chat", {}).get("id") or from_id
    msg_id   = callback.get("message", {}).get("message_id")
    old_text = callback.get("message", {}).get("text", "")

    # Check admin role for admin actions
    is_admin = is_chat_admin(chat_id) or is_chat_admin(from_id)

    # ── Admin verify callbacks ──
    if data.startswith("verify:"):
        if not is_admin:
            answer_cb(cb_id, "Unauthorized.")
            return

        parts = data.split(":", 2)
        if len(parts) != 3:
            answer_cb(cb_id, "Invalid action.")
            return

        _, status, payment_id = parts
        answer_cb(cb_id, f"Processing {status}...")

        result = admin_verify_payment(payment_id, status)

        if result.get("success"):
            icon = "✅" if status == "PAID" else "❌"
            edit_msg(
                chat_id, msg_id,
                f"{old_text}\n\n{icon} <b>Verified as {status} by Admin</b>",
                reply_markup={"inline_keyboard": []}
            )
            send(
                chat_id,
                f"🎉 <b>Done!</b> Marked as <b>{status}</b> successfully.",
                reply_markup=ADMIN_MENU
            )
        else:
            answer_cb(cb_id, f"Error: {result.get('message')}")

    # ── Buyer wizard callbacks ──
    elif data.startswith("buyer_pay:"):
        method = data.split(":")[1]
        state = get_chat_state(chat_id)
        if state:
            answer_cb(cb_id, f"Selected: {method}")
            handle_buyer_pay_callback(chat_id, msg_id, method, state)
        else:
            answer_cb(cb_id, "")
            send(
                chat_id,
                "⚠️ <b>Session Expired or Not Found</b>\n\n"
                "This order session has expired or the server was restarted.\n"
                "Please open the Telegram link from your checkout page on the website to resume."
            )

    elif data.startswith("buyer_bank:"):
        bank = data.split(":")[1]
        state = get_chat_state(chat_id)
        if state:
            answer_cb(cb_id, f"Selected: {bank}")
            handle_buyer_bank_callback(chat_id, msg_id, bank, state)
        else:
            answer_cb(cb_id, "")
            send(
                chat_id,
                "⚠️ <b>Session Expired or Not Found</b>\n\n"
                "This order session has expired or the server was restarted.\n"
                "Please open the Telegram link from your checkout page on the website to resume."
            )

    elif data.startswith("buyer_verif_type:"):
        verif_type = data.split(":")[1]
        state = get_chat_state(chat_id)
        if state:
            answer_cb(cb_id, f"Verification: {verif_type.replace('_', ' ').title()}")
            handle_buyer_verification_type_callback(chat_id, msg_id, verif_type, state)
        else:
            answer_cb(cb_id, "")
            send(
                chat_id,
                "⚠️ <b>Session Expired or Not Found</b>\n\n"
                "This order session has expired or the server was restarted.\n"
                "Please open the Telegram link from your checkout page on the website to resume."
            )


# ─────────────────────────────────────────────────────────────────────────────
# Telegram Message Router
# ─────────────────────────────────────────────────────────────────────────────
def handle_message(message):
    chat_id   = message["chat"]["id"]
    text      = message.get("text", "").strip()
    from_user = message.get("from", {})
    name      = from_user.get("first_name", "there")

    is_admin = is_chat_admin(chat_id)

    # ── Admin login command ──
    if text.startswith("/login"):
        handle_admin_login(chat_id, text)
        return

    # ── Start command (Buyer with token OR Admin direct start) ──
    if text.startswith("/start"):
        parts = text.split(maxsplit=1)
        token = parts[1].strip() if len(parts) > 1 else None

        if is_admin and not token:
            admin_show_menu(chat_id, greeting=f"👋 Welcome back, <b>{name}</b>!")
            return

        # For buyers (with deep link token OR typing /start), validate/restore their pending order
        handle_buyer_start(chat_id, token, name)
        return

    # ── Buyer wizard text/photo states ──
    state = get_chat_state(chat_id)
    if state:
        buyer_state = state.get("state")

        # Photo message — handle regardless of text content
        if buyer_state == "awaiting_photo" and (message.get("photo") or message.get("document")):
            handle_buyer_photo_input(chat_id, message, state)
            return

        if buyer_state == "awaiting_ref" and text:
            handle_buyer_reference_input(chat_id, text, state)
            return

    # ── Admin menu button commands ──
    if text in ("📋 Pending Receipts", "/pending", "📊 Dashboard Stats", "/stats", "✅ Pending Orders", "/orders", "🔄 Refresh", "/refresh", "❓ Help", "/help"):
        if not is_admin:
            show_unauthorized_message(chat_id, name)
            return

        if text in ("📋 Pending Receipts", "/pending"):
            admin_show_pending(chat_id)
        elif text in ("📊 Dashboard Stats", "/stats"):
            admin_show_stats(chat_id)
        elif text in ("✅ Pending Orders", "/orders"):
            admin_show_pending_orders(chat_id)
        elif text in ("🔄 Refresh", "/refresh"):
            admin_login()
            admin_show_menu(chat_id, greeting="🔄 <b>Session Refreshed!</b>")
        elif text in ("❓ Help", "/help"):
            admin_show_help(chat_id)
        return

    # Fallback response for unrecognized text
    if is_admin:
        admin_show_menu(chat_id, greeting="👋 Use the menu buttons below:")
    else:
        show_unauthorized_message(chat_id, name)


# ─────────────────────────────────────────────────────────────────────────────
# Polling Loop
# ─────────────────────────────────────────────────────────────────────────────
def check_telegram_token():
    try:
        r = requests.get(f"{TELEGRAM_API}/getMe", timeout=10)
        data = r.json()
        if not data.get("ok"):
            logging.error(f"❌ TELEGRAM BOT TOKEN IS INVALID OR REVOKED: {data.get('description')}")
            logging.error("👉 Please generate a new bot token in Telegram @BotFather and update TELEGRAM_BOT_TOKEN in .env or telegram_verifier_bot.py")
            return False
        bot_user = data.get("result", {})
        logging.info(f"✅ Telegram Bot connected as @{bot_user.get('username')} ({bot_user.get('first_name')})")
        return True
    except Exception as e:
        logging.error(f"Telegram token check failed: {e}")
        return False


def main():
    logging.info("Starting Adama Materials Telegram Bot...")

    if not check_telegram_token():
        logging.warning("⚠️ Bot cannot receive messages until a valid Telegram Bot Token is provided.")

    if not admin_login():
        logging.warning("Admin login failed on startup — will retry on requests.")

    offset = 0
    poll_url = f"{TELEGRAM_API}/getUpdates"
    logging.info("[BOT LIVE] Polling for updates...")

    while True:
        try:
            r = requests.get(poll_url, params={"offset": offset, "timeout": 20}, timeout=25)

            if r.status_code == 200:
                for update in r.json().get("result", []):
                    offset = update["update_id"] + 1

                    # Dispatch all message types: text, photo, document, sticker, etc.
                    if "message" in update:
                        msg = update["message"]
                        # Only skip service messages with no user content
                        if any(k in msg for k in ("text", "photo", "document", "sticker", "voice", "video")):
                            handle_message(msg)

                    elif "callback_query" in update:
                        handle_callback(update["callback_query"])

        except KeyboardInterrupt:
            logging.info("Bot stopped by user.")
            break
        except Exception as e:
            logging.error(f"Polling error: {e}")
            time.sleep(3)


if __name__ == "__main__":
    main()
