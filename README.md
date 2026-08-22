# 🏗️ AdaMaterials — Managed Marketplace

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**AdaMaterials** is a digital managed marketplace designed for **Adama City, Oromia, Ethiopia**. It connects local businesses, contractors, fabricators, and residents to safely buy, sell, and recycle pre-owned and secondary materials — including used furniture, electronics, construction steel, plastics, tools, and industrial equipment.

---

## 🌟 Key Features

### 🛍️ 1. Buyer Experience
* **Rich Categorized Catalog**: Search and filter by category (Used Furniture, Electronics, Scrap Metals, Plastics, Tools), condition (`Brand New`, `Like New`, `Good`, `Fair`, `Scrap`), price, and sub-city location.
* **Smart Cart & Multi-Seller Orders**: Add items from multiple local sellers into a unified cart. Order subtotal, dynamic delivery fees, and per-seller payouts are calculated automatically.
* **Dual Payment Proof Submission**:
  * **Direct Website Upload**: Upload payment receipt screenshots (PNG/JPG/WEBP) with instant live preview and enter transaction reference IDs (CBE / Telebirr).
  * **Telegram Bot Companion**: Use deep-linked interactive Telegram verification with inline button flows.
* **Live Order Tracking**: Real-time status updates (`PENDING_PAYMENT` ➔ `CONFIRMED` ➔ `IN_TRANSIT` ➔ `DELIVERED`).
* **Ratings & Dispute Resolution**: Submit verified product reviews or raise delivery/quality disputes with admin arbitration.

### 📦 2. Seller Portal
* **Inventory & Listing Management**: List new and used materials with multi-photo uploads, stock tracking, and pricing.
* **Sales Analytics**: View order volume, gross sales, platform commission deductions, and pending balance.
* **Automated Payout Tracking**: Escrow-backed payout records generated automatically for each order line upon delivery confirmation.

### 🚚 3. Logistics & Delivery Management
* **Dynamic Delivery Fee Engine**: Automatically calculates delivery charges based on:
  * Destination sub-city distance in Adama (Bole, Kebele 01–08, Industry Zone, Melka Adama, etc.).
  * Total items and weight volume in the cart.
  * Day-of-week and peak-time logistics multipliers.
* **Fleet Dispatch**: Staff logistics portal to assign drivers, update delivery tracking milestones, and confirm drop-offs.

### 💳 4. Finance & Admin Verification
* **Proof Inspection Panel**: Staff and Admins review submitted bank transfer references and inspect high-resolution receipt screenshots via a built-in zoom modal.
* **One-Click Approval / Rejection**: Approving a payment automatically triggers order confirmation, reserves stock, generates courier tasks, and sends in-app notifications.
* **Role-Based Access Control (RBAC)**: Fine-grained permissions for Admins, Staff Finance (`VERIFY_PAYMENTS`, `PROCESS_PAYOUTS`), and Staff Logistics (`MANAGE_DELIVERIES`, `SET_DELIVERY_FEES`).
* **Audit Trail**: Detailed audit logging for all critical financial and administrative operations.

---

## 🏛️ System Architecture

```
                               ┌────────────────────────┐
                               │   Vercel Deployment    │
                               │  (React 18 + TS + Vite)│
                               └───────────┬────────────┘
                                           │ HTTPS / REST
                                           ▼
┌────────────────────────┐     ┌────────────────────────┐     ┌────────────────────────┐
│   Railway Deployment   │────▶│   Render Web Service   │◀────│   MongoDB Atlas Cloud  │
│  (Python Telegram Bot) │     │ (Node.js + Express.js) │     │   (Mongoose ODM DB)    │
└────────────────────────┘     └────────────────────────┘     └────────────────────────┘
```

---

## 📁 Repository Structure

```
AdaMaterials-E-commerce/
├── client/                     # Frontend Application
│   ├── src/
│   │   ├── components/         # Reusable UI components & ProtectedRoute
│   │   ├── context/            # Auth, Cart, and Toast Context Providers
│   │   ├── layouts/            # MainLayout (Navbar, Footer, Notifications)
│   │   ├── pages/              # Landing, Catalog, Checkout, Dashboards
│   │   └── services/           # Axios API configuration & token handlers
│   ├── index.html              # HTML entry point
│   ├── package.json
│   └── vite.config.ts          # Vite build configuration
│
├── server/                     # Backend API Service
│   ├── src/
│   │   ├── controllers/        # Auth, Products, Orders, Payments, Deliveries
│   │   ├── middleware/         # JWT Auth, Role Guard, Multer Image Upload
│   │   ├── models/             # User, Product, Order, Payment, Delivery, Payout
│   │   ├── routes/             # RESTful API routing definitions
│   │   ├── services/           # PaymentService, StorageService, TelegramService
│   │   ├── utils/              # Fee calculators, async handler, error utility
│   │   ├── jobs/seed.js        # Catalog seeder with realistic pre-owned goods
│   │   └── app.js              # Express application entry
│   ├── tests/                  # Automated integration test suite (32 tests)
│   └── package.json
│
├── bot/                        # Telegram Verification Bot
│   └── telegram_verifier_bot.py # Python Telegram Bot service
└── README.md
```

---

## ⚙️ Environment Variables Configuration

> 🔒 **Security Notice**: Never commit real production secrets, API keys, or database credentials to version control. Use `.env` files locally and environment configuration panels in production.

### 🖥️ Backend Server (`server/.env`)

```env
# Server Runtime
NODE_ENV=development
PORT=5000

# Database
MONGO_URI=mongodb+srv://<DB_USER>:<DB_PASSWORD>@<CLUSTER_URL>/<DB_NAME>?retryWrites=true&w=majority

# Authentication Secrets
JWT_SECRET=<YOUR_LONG_RANDOM_JWT_SECRET_KEY>
JWT_EXPIRES_IN=30d

# Cross-Origin Allowed Client URL
CLIENT_URL=http://localhost:5173

# Telegram Bot Integration (Optional for local dev)
TELEGRAM_BOT_TOKEN=<YOUR_TELEGRAM_BOT_TOKEN>
TELEGRAM_ADMIN_CHAT_ID=<YOUR_TELEGRAM_ADMIN_CHAT_ID>

# Marketplace Commission Rate (e.g., 0.10 = 10%)
MARKETPLACE_COMMISSION_RATE=0.10
```

### 🌐 Frontend Client (`client/.env`)

```env
# API Backend Base URL
VITE_API_URL=http://localhost:5000/api/v1
```

### 🤖 Telegram Bot (`bot/.env`)

```env
TELEGRAM_BOT_TOKEN=<YOUR_TELEGRAM_BOT_TOKEN>
MARKETPLACE_API_URL=http://localhost:5000/api/v1
STAFF_EMAIL=staff.finance@marketplace.com
STAFF_PASSWORD=<YOUR_STAFF_ACCOUNT_PASSWORD>
```

---

## 🚀 Local Development Quickstart

### Prerequisites
* **Node.js** v18.0.0 or higher
* **npm** v9.0.0 or higher
* **Python** 3.10+ (for running the Telegram bot)
* **MongoDB** (Local instance or free MongoDB Atlas cluster)

---

### Step 1: Clone Repository
```bash
git clone https://github.com/petrossisay1646/AdamaMaterials-E-commerce-.git
cd AdamaMaterials-E-commerce-
```

### Step 2: Set Up Backend
```bash
cd server
npm install
cp .env.example .env   # Configure your environment variables

# Seed sample categories, realistic used materials, and demo accounts
npm run seed

# Run automated tests
npm test

# Start development server
npm run dev
```
The backend server will run on `http://localhost:5000`.

---

### Step 3: Set Up Frontend
```bash
cd ../client
npm install

# Start Vite development server
npm run dev
```
The client application will run on `http://localhost:5173`.

---

### Step 4: (Optional) Run Telegram Bot
```bash
cd ../bot
pip install requests
python telegram_verifier_bot.py
```

---

## 🧪 Automated Testing

The backend includes a comprehensive integration test suite verifying auth boundaries, multi-seller payouts, payment idempotency, state transitions, and role protections.

```bash
cd server
npm test
```

```
▶ Full Integration Test Suite
  ✔ Auth: Unauthenticated request is rejected
  ✔ Auth: Buyer cannot access admin dashboard
  ✔ Auth: Staff cannot access admin-only audit logs
  ✔ Products: Draft products are hidden from public catalog
  ✔ Checkout: Creates multi-seller order with per-seller payouts
  ✔ Checkout: Stock is decremented after checkout
  ✔ Payment: Mock webhook processes payment and confirms order
  ✔ Payment: Webhook is idempotent (duplicate call is ignored)
  ✔ Delivery: Record is created after payment confirmation
  ✔ Delivery: Staff updates status to DELIVERED — payouts become ELIGIBLE
  ✔ Payout: Seller can see their own payouts
  ✔ State machine: Cannot cancel a DELIVERED order
...
ℹ tests 32 | pass 32 | fail 0 (100% passing)
```

---

## 👥 Default Demo Credentials (from Seed)

| Role | Email | Default Password | Permissions |
|---|---|---|---|
| **Admin** | `admin@marketplace.com` | `AdminPass123` | Full Administrative & Finance Access |
| **Staff (Finance)** | `staff.finance@marketplace.com` | `StaffPass123` | `VIEW_ORDERS`, `VERIFY_PAYMENTS`, `PROCESS_PAYOUTS` |
| **Staff (Logistics)** | `staff.logistics@marketplace.com` | `StaffPass123` | `VIEW_ORDERS`, `MANAGE_DELIVERIES`, `SET_DELIVERY_FEES` |
| **Seller** | `seller1@marketplace.com` | `SellerPass123` | Product Management, Payouts |
| **Buyer** | `buyer1@marketplace.com` | `BuyerPass123` | Cart, Checkout, Order Tracking |

---

## 🌐 Production Deployment Overview

### 1. Backend on Render
* **Root Directory**: `server`
* **Build Command**: `npm install`
* **Start Command**: `node src/server.js`
* Add required environment variables (`NODE_ENV=production`, `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`).

### 2. Frontend on Vercel
* **Root Directory**: `client`
* **Framework Preset**: `Vite`
* Set `VITE_API_URL` to your live Render backend URL (`https://<your-backend>.onrender.com/api/v1`).

### 3. Telegram Bot on Railway / VPS
* **Root Directory**: `bot`
* **Start Command**: `python telegram_verifier_bot.py`
* Set `TELEGRAM_BOT_TOKEN`, `MARKETPLACE_API_URL`, and staff credentials.

---

## 📜 License
This project is licensed under the **MIT License**.
Distributed with love for the local circular economy in Adama City, Ethiopia. 🇪🇹
