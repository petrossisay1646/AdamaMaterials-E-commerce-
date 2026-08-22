process.env.NODE_ENV = 'test';
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../../.env.example') }); // Use example defaults

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const crypto = require('crypto');
const app = require('../src/app');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');
const Payout = require('../src/models/Payout');
const Delivery = require('../src/models/Delivery');
const Category = require('../src/models/Category');
const MaterialType = require('../src/models/MaterialType');
const Cart = require('../src/models/Cart');
const { MongoMemoryServer } = require('mongodb-memory-server');

let server, serverUrl, mongoServer;

const startServer = () =>
  new Promise((resolve) => {
    server = app.listen(0, () => {
      serverUrl = `http://localhost:${server.address().port}/api/v1`;
      resolve();
    });
  });

const closeAll = async () => {
  if (server) server.close();
  await mongoose.connection.close();
  if (mongoServer) await mongoServer.stop();
};

const api = async (method, path, body, cookie) => {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie && { Cookie: cookie }) },
    ...(body && { body: JSON.stringify(body) }),
  };
  const res = await fetch(`${serverUrl}${path}`, opts);
  let data;
  try { data = await res.json(); } catch { data = {}; }
  return { status: res.status, data, headers: res.headers };
};

const login = async (email, password = 'Password123') => {
  const res = await api('POST', '/auth/login', { email, password });
  assert.strictEqual(res.status, 200, `Login failed for ${email}: ${JSON.stringify(res.data)}`);
  return res.headers.get('set-cookie')?.split(';')[0] || '';
};

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Full Integration Test Suite', () => {
  // Cookies
  let adminCookie, buyerCookie, buyer2Cookie, sellerCookie, seller2Cookie;
  let staffFinanceCookie, staffLogisticsCookie;

  // IDs
  let categoryId, materialTypeId;
  let seller1Id, seller2Id, buyerId;
  let product1Id, product2Id; // product1 = seller1, product2 = seller2
  let orderId, paymentId, deliveryId;
  let payout1Id, payout2Id;

  test.before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    // Clear all collections
    await Promise.all([
      User.deleteMany({}), Product.deleteMany({}), Order.deleteMany({}),
      Payment.deleteMany({}), Payout.deleteMany({}), Delivery.deleteMany({}),
      Cart.deleteMany({}), Category.deleteMany({}), MaterialType.deleteMany({}),
    ]);

    await startServer();

    // Seed reference data
    const cat = await Category.create({ name: 'Test Category', description: 'Test' });
    categoryId = cat._id.toString();
    const mat = await MaterialType.create({ name: 'Test Material', description: 'Test' });
    materialTypeId = mat._id.toString();

    // Create users
    const admin = await User.create({ name: 'Test Admin', email: 'admin@test.com', password: 'Password123', role: 'ADMIN', isActive: true });
    const buyer = await User.create({ name: 'Test Buyer', email: 'buyer@test.com', password: 'Password123', role: 'BUYER', isActive: true });
    const buyer2 = await User.create({ name: 'Buyer Two', email: 'buyer2@test.com', password: 'Password123', role: 'BUYER', isActive: true });
    const seller = await User.create({ name: 'Test Seller 1', email: 'seller1@test.com', password: 'Password123', role: 'SELLER', isSellerApproved: true, isActive: true });
    const seller2 = await User.create({ name: 'Test Seller 2', email: 'seller2@test.com', password: 'Password123', role: 'SELLER', isSellerApproved: true, isActive: true });
    const staffFin = await User.create({ name: 'Staff Finance', email: 'stafff@test.com', password: 'Password123', role: 'STAFF', staffPermissions: ['VIEW_ORDERS', 'VERIFY_PAYMENTS', 'VIEW_SELLER_PAYOUTS', 'PROCESS_PAYOUTS'], isActive: true });
    const staffLog = await User.create({ name: 'Staff Logistics', email: 'staffl@test.com', password: 'Password123', role: 'STAFF', staffPermissions: ['MANAGE_DELIVERIES', 'SET_DELIVERY_FEES', 'VIEW_ORDERS'], isActive: true });

    buyerId = buyer._id.toString();
    seller1Id = seller._id.toString();
    seller2Id = seller2._id.toString();

    // Login all users
    adminCookie        = await login('admin@test.com');
    buyerCookie        = await login('buyer@test.com');
    buyer2Cookie       = await login('buyer2@test.com');
    sellerCookie       = await login('seller1@test.com');
    seller2Cookie      = await login('seller2@test.com');
    staffFinanceCookie = await login('stafff@test.com');
    staffLogisticsCookie = await login('staffl@test.com');

    // Create two products by two different sellers
    const p1 = await Product.create({
      name: 'Copper Wire Scrap', description: 'Reusable copper', price: 500, quantity: 10,
      category: categoryId, materialType: materialTypeId, condition: 'Good',
      seller: seller._id, approvalStatus: 'APPROVED', status: 'ACTIVE',
      images: ['http://localhost:5000/uploads/test1.jpg'],
    });
    const p2 = await Product.create({
      name: 'Plastic Sheets', description: 'Recyclable plastic', price: 300, quantity: 5,
      category: categoryId, materialType: materialTypeId, condition: 'Fair',
      seller: seller2._id, approvalStatus: 'APPROVED', status: 'ACTIVE',
      images: ['http://localhost:5000/uploads/test2.jpg'],
    });
    product1Id = p1._id.toString();
    product2Id = p2._id.toString();
  });

  test.after(closeAll);

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION 1: Ownership & Authorization
  // ────────────────────────────────────────────────────────────────────────────

  test('Auth: Unauthenticated request is rejected', async () => {
    const res = await api('GET', '/admin/dashboard-stats');
    assert.strictEqual(res.status, 401);
  });

  test('Auth: Buyer cannot access admin dashboard', async () => {
    const res = await api('GET', '/admin/dashboard-stats', null, buyerCookie);
    assert.strictEqual(res.status, 403);
  });

  test('Auth: Staff cannot access admin-only audit logs', async () => {
    const res = await api('GET', '/admin/audit-logs', null, staffFinanceCookie);
    assert.strictEqual(res.status, 403);
  });

  test('Auth: Staff with wrong permission cannot verify payments', async () => {
    // staffLogisticsCookie has MANAGE_DELIVERIES but NOT VERIFY_PAYMENTS
    const res = await api('POST', '/payments/verify-manual', { paymentId: 'fake', status: 'PAID' }, staffLogisticsCookie);
    assert.strictEqual(res.status, 403, 'Staff without VERIFY_PAYMENTS must be blocked');
  });

  test('Auth: Staff with wrong permission cannot set delivery fees', async () => {
    // staffFinanceCookie does not have SET_DELIVERY_FEES
    const res = await api('POST', '/deliveries/set-fee', { deliveryId: 'fake', fee: 100 }, staffFinanceCookie);
    assert.strictEqual(res.status, 403, 'Staff without SET_DELIVERY_FEES must be blocked');
  });

  test('Auth: Admin can access admin dashboard', async () => {
    const res = await api('GET', '/admin/dashboard-stats', null, adminCookie);
    assert.strictEqual(res.status, 200);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION 2: Product Approval & Catalog Visibility
  // ────────────────────────────────────────────────────────────────────────────

  test('Products: Draft products are hidden from public catalog', async () => {
    const createRes = await api('POST', '/products', {
      name: 'Draft Product', description: 'Should not appear publicly', price: 100,
      quantity: 1, category: categoryId, materialType: materialTypeId, condition: 'Good',
      images: ['http://localhost:5000/uploads/draft.jpg'],
    }, sellerCookie);
    assert.strictEqual(createRes.status, 201);
    const draftId = createRes.data.product._id;

    const catalog = await api('GET', '/products');
    const found = catalog.data.products?.some(p => p._id === draftId);
    assert.strictEqual(found, false, 'Draft product must not appear in public catalog');
  });

  test('Products: Seller cannot approve their own product', async () => {
    const createRes = await api('POST', '/products', {
      name: 'Self-Approve Test', description: 'Attempt', price: 50,
      quantity: 1, category: categoryId, materialType: materialTypeId, condition: 'Good',
      images: ['http://localhost:5000/uploads/self.jpg'],
    }, sellerCookie);
    const pid = createRes.data.product._id;
    await api('POST', `/products/${pid}/submit`, null, sellerCookie);

    const res = await api('POST', '/admin/products/review', { productId: pid, status: 'APPROVED' }, sellerCookie);
    assert.strictEqual(res.status, 403);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION 3: Checkout — Inventory & Multi-Seller Order
  // ────────────────────────────────────────────────────────────────────────────

  test('Checkout: Non-CHAPA payment methods (MOCK, BANK_TRANSFER, TELEBIRR, INVALID) are rejected', async () => {
    // Clear any leftover cart items
    await api('POST', '/cart/clear', null, buyerCookie);
    await api('POST', '/cart/add', { productId: product1Id, quantity: 1 }, buyerCookie);

    for (const invalidMethod of ['INVALID_GATEWAY', 'MOCK', 'BANK_TRANSFER', 'TELEBIRR']) {
      const res = await api('POST', '/orders/checkout', {
        paymentMethod: invalidMethod,
        deliveryAddress: { streetAddress: '1 Test St', city: 'Adama', subCity: 'Test', phoneNumber: '0911000000', latitude: 8.541, longitude: 39.271 },
      }, buyerCookie);
      assert.strictEqual(res.status, 400, `Payment method ${invalidMethod} must be rejected`);
      assert.ok(res.data.message.toLowerCase().includes('invalid payment method'), `Message should mention invalid method for ${invalidMethod}`);
    }
  });

  test('Checkout: Creates multi-seller order with per-seller payouts using CHAPA', async () => {
    // Clear cart and add items from two different sellers
    await api('POST', '/cart/clear', null, buyerCookie);
    await api('POST', '/cart/add', { productId: product1Id, quantity: 2 }, buyerCookie);
    await api('POST', '/cart/add', { productId: product2Id, quantity: 1 }, buyerCookie);

    const res = await api('POST', '/orders/checkout', {
      paymentMethod: 'CHAPA',
      deliveryAddress: { streetAddress: '1 Test St', city: 'Adama', subCity: 'Bole', phoneNumber: '0911000000', latitude: 8.541, longitude: 39.271 },
    }, buyerCookie);

    assert.strictEqual(res.status, 201, `Checkout failed: ${JSON.stringify(res.data)}`);
    assert.ok(res.data.order, 'Order must be in response');
    orderId = res.data.order._id;

    // Verify per-seller payouts were created
    const payouts = await Payout.find({ order: orderId });
    assert.strictEqual(payouts.length, 2, 'Two payouts must be created — one per seller');

    const sellerIds = payouts.map(p => p.seller.toString());
    assert.ok(sellerIds.includes(seller1Id), 'Payout for seller1 must exist');
    assert.ok(sellerIds.includes(seller2Id), 'Payout for seller2 must exist');

    // All payouts must start as PENDING (not ELIGIBLE yet)
    payouts.forEach(p => {
      assert.strictEqual(p.status, 'PENDING', 'Payout must be PENDING at checkout');
    });

    payout1Id = payouts.find(p => p.seller.toString() === seller1Id)?._id.toString();
    payout2Id = payouts.find(p => p.seller.toString() === seller2Id)?._id.toString();
  });

  test('Checkout: Stock is decremented after checkout', async () => {
    const p1 = await Product.findById(product1Id);
    const p2 = await Product.findById(product2Id);
    assert.strictEqual(p1.quantity, 8, 'product1 stock must decrease by 2');
    assert.strictEqual(p2.quantity, 4, 'product2 stock must decrease by 1');
  });

  test('Checkout: Buyer cannot exceed available stock', async () => {
    await api('POST', '/cart/clear', null, buyer2Cookie);
    // Try to buy more than available (product2 has 4 left)
    await api('POST', '/cart/add', { productId: product2Id, quantity: 5 }, buyer2Cookie);
    const res = await api('POST', '/orders/checkout', {
      paymentMethod: 'CHAPA',
      deliveryAddress: { streetAddress: '2 Test Ave', city: 'Adama', subCity: 'Test', phoneNumber: '0911000000', latitude: 8.541, longitude: 39.271 },
    }, buyer2Cookie);
    assert.strictEqual(res.status, 400, 'Overselling must be prevented');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION 4: Ownership Authorization on Orders
  // ────────────────────────────────────────────────────────────────────────────

  test('Orders: Buyer cannot view another buyer\'s order', async () => {
    const res = await api('GET', `/orders/${orderId}`, null, buyer2Cookie);
    assert.strictEqual(res.status, 403);
  });

  test('Orders: Seller can view order containing their product', async () => {
    const res = await api('GET', `/orders/${orderId}`, null, sellerCookie);
    assert.strictEqual(res.status, 200);
  });

  test('Orders: Staff can view any order', async () => {
    const res = await api('GET', `/orders/${orderId}`, null, staffFinanceCookie);
    assert.strictEqual(res.status, 200);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION 5: Payment Processing
  // ────────────────────────────────────────────────────────────────────────────

  test('Payment: Mock webhook processes payment and confirms order', async () => {
    // Find the payment record
    const payment = await Payment.findOne({ order: orderId });
    assert.ok(payment, 'Payment record must exist');
    paymentId = payment._id.toString();

    const res = await api('POST', `/payments/webhook/mock`, {
      tx_ref: payment.transactionId,
      status: 'success',
    });
    assert.strictEqual(res.status, 200, `Webhook failed: ${JSON.stringify(res.data)}`);

    const updated = await Payment.findById(paymentId);
    assert.strictEqual(updated.status, 'PAID', 'Payment must be marked PAID after webhook');

    const order = await Order.findById(orderId);
    assert.strictEqual(order.orderStatus, 'CONFIRMED', 'Order must be CONFIRMED after payment');
  });

  test('Payment: Webhook is idempotent (duplicate call is ignored)', async () => {
    const payment = await Payment.findById(paymentId);
    const res = await api('POST', `/payments/webhook/mock`, {
      tx_ref: payment.transactionId,
      status: 'success',
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.message?.includes('Already processed'), 'Duplicate webhook must be idempotent');
  });

  test('Payment: Payouts remain PENDING (not eligible) before delivery', async () => {
    const payouts = await Payout.find({ order: orderId });
    payouts.forEach(p => {
      assert.strictEqual(p.status, 'PENDING', 'Payouts must stay PENDING until delivery');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION 6: Delivery Workflow
  // ────────────────────────────────────────────────────────────────────────────

  test('Delivery: Record is created after payment confirmation', async () => {
    const delivery = await Delivery.findOne({ order: orderId });
    assert.ok(delivery, 'Delivery record must be auto-created after payment');
    deliveryId = delivery._id.toString();
  });

  test('Delivery: Staff with SET_DELIVERY_FEES can set delivery fee', async () => {
    const res = await api('POST', '/deliveries/set-fee', {
      deliveryId,
      fee: 150,
    }, staffLogisticsCookie);
    assert.strictEqual(res.status, 200, `Set fee failed: ${JSON.stringify(res.data)}`);

    const order = await Order.findById(orderId);
    assert.strictEqual(order.deliveryFee, 150, 'Delivery fee must update order');
  });

  test('Delivery: Staff updates status to DELIVERED — payouts become ELIGIBLE', async () => {
    // Assign delivery first
    await api('POST', '/deliveries/assign', {
      deliveryId,
      staffId: (await User.findOne({ email: 'staffl@test.com' }))._id.toString(),
    }, staffLogisticsCookie);

    const res = await api('PUT', '/deliveries/status', {
      deliveryId,
      status: 'DELIVERED',
      note: 'Delivered to customer',
    }, staffLogisticsCookie);
    assert.strictEqual(res.status, 200, `Update delivery status failed: ${JSON.stringify(res.data)}`);

    // Both payouts must now be ELIGIBLE
    const payouts = await Payout.find({ order: orderId });
    payouts.forEach(p => {
      assert.strictEqual(p.status, 'ELIGIBLE', 'Payout must become ELIGIBLE after delivery');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION 7: Payout Processing
  // ────────────────────────────────────────────────────────────────────────────

  test('Payout: Seller can see their own payouts', async () => {
    const res = await api('GET', '/payouts/my/listings', null, sellerCookie);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.payouts?.length > 0, 'Seller must see their payouts');
  });

  test('Payout: Seller cannot process another seller\'s payout', async () => {
    const res = await api('POST', '/payouts/process', {
      payoutId: payout2Id,
      transactionRef: 'BANK-REF-123',
    }, sellerCookie);
    assert.strictEqual(res.status, 403, 'Sellers must not process payouts');
  });

  test('Payout: Staff can process ELIGIBLE payout', async () => {
    const res = await api('POST', '/payouts/process', {
      payoutId: payout1Id,
      transactionRef: 'BANK-REF-TEST-001',
    }, staffFinanceCookie);
    assert.strictEqual(res.status, 200, `Process payout failed: ${JSON.stringify(res.data)}`);

    const payout = await Payout.findById(payout1Id);
    assert.strictEqual(payout.status, 'PAID', 'Payout must be PAID after processing');
  });

  test('Payout: Cannot process already-PAID payout (invalid state transition)', async () => {
    const res = await api('POST', '/payouts/process', {
      payoutId: payout1Id,
      transactionRef: 'BANK-REF-DUPLICATE',
    }, staffFinanceCookie);
    assert.strictEqual(res.status, 400, 'Duplicate payout processing must be rejected');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION 8: Order State Machine — Invalid Transitions
  // ────────────────────────────────────────────────────────────────────────────

  test('State machine: Cannot change status of a DELIVERED order to PENDING_PAYMENT', async () => {
    const order = await Order.findById(orderId);
    // Order should be DELIVERED by now
    assert.strictEqual(order.orderStatus, 'DELIVERED');

    const res = await api('PUT', `/orders/${orderId}/status`, {
      status: 'PENDING_PAYMENT',
      note: 'Trying to regress state',
    }, adminCookie);
    assert.strictEqual(res.status, 400, 'Invalid state regression must be rejected');
  });

  test('State machine: Cannot cancel a DELIVERED order', async () => {
    const res = await api('PUT', `/orders/${orderId}/status`, {
      status: 'CANCELLED',
    }, adminCookie);
    assert.strictEqual(res.status, 400, 'Cannot cancel delivered order');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION 9: Webhook Security
  // ────────────────────────────────────────────────────────────────────────────

  test('Webhook: Missing tx_ref returns 400', async () => {
    const res = await api('POST', '/payments/webhook/chapa', { status: 'success' });
    assert.strictEqual(res.status, 400);
  });

  test('Webhook: Unknown transaction returns 404', async () => {
    const res = await api('POST', '/payments/webhook/mock', {
      tx_ref: 'TX-MOCK-NONEXISTENT-000',
      status: 'success',
    });
    assert.strictEqual(res.status, 404);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION 10: Commission Rate Calculation
  // ────────────────────────────────────────────────────────────────────────────

  test('Commission: Per-seller payout amount correctly deducts commission', async () => {
    const payouts = await Payout.find({ order: orderId });

    for (const p of payouts) {
      const expectedCommission = parseFloat((p.amount * p.commissionRate).toFixed(10));
      const expectedPayout = p.amount - expectedCommission;
      assert.ok(
        Math.abs(p.payoutAmount - expectedPayout) < 0.01,
        `Payout amount mismatch: got ${p.payoutAmount}, expected ~${expectedPayout}`
      );
    }
  });

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION 11: Legacy Security Tests (retained)
  // ────────────────────────────────────────────────────────────────────────────

  test('Legacy Rule 3: Buyers cannot access admin analytics', async () => {
    const res = await api('GET', '/admin/dashboard-stats', null, buyerCookie);
    assert.strictEqual(res.status, 403);
  });

  test('Legacy Rule 4: Staff cannot access admin audit logs', async () => {
    const res = await api('GET', '/admin/audit-logs', null, staffFinanceCookie);
    assert.strictEqual(res.status, 403);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION 12: Role Permissions (Buyer vs Seller vs Admin vs Staff)
  // ────────────────────────────────────────────────────────────────────────────

  test('Role Permission: Seller cannot add items to cart or checkout (HTTP 403)', async () => {
    const cartRes = await api('POST', '/cart/add', { productId: product1Id, quantity: 1 }, sellerCookie);
    assert.strictEqual(cartRes.status, 403, 'Seller must not be allowed to add items to cart');

    const checkoutRes = await api('POST', '/orders/checkout', {
      paymentMethod: 'CHAPA',
      deliveryAddress: { streetAddress: '1 Seller St', city: 'Adama', subCity: 'Bole', phoneNumber: '0911000000', latitude: 8.541, longitude: 39.271 },
    }, sellerCookie);
    assert.strictEqual(checkoutRes.status, 403, 'Seller must not be allowed to checkout');
  });

  test('Role Permission: Admin cannot add items to cart or checkout (HTTP 403)', async () => {
    const cartRes = await api('POST', '/cart/add', { productId: product1Id, quantity: 1 }, adminCookie);
    assert.strictEqual(cartRes.status, 403, 'Admin must not be allowed to add items to cart');

    const checkoutRes = await api('POST', '/orders/checkout', {
      paymentMethod: 'CHAPA',
      deliveryAddress: { streetAddress: '1 Admin St', city: 'Adama', subCity: 'Bole', phoneNumber: '0911000000', latitude: 8.541, longitude: 39.271 },
    }, adminCookie);
    assert.strictEqual(checkoutRes.status, 403, 'Admin must not be allowed to checkout');
  });

  test('Role Permission: Buyer cannot create seller product listings (HTTP 403)', async () => {
    const res = await api('POST', '/products', {
      name: 'Unauthorized Listing', description: 'Attempted by Buyer', price: 100,
      quantity: 1, category: categoryId, materialType: materialTypeId, condition: 'Good',
      images: ['http://localhost:5000/uploads/unauthorized.jpg'],
    }, buyerCookie);
    assert.strictEqual(res.status, 403, 'Buyer must be forbidden from creating seller listings');
  });
});
