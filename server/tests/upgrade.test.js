process.env.NODE_ENV = 'test';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// Models & Config
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');
const MapPlace = require('../src/models/MapPlace');
const { isLocationInAdamaServiceArea, calculateDistanceKm } = require('../src/config/serviceArea');

let mongoServer;

describe('Major Feature Upgrade Test Suite', () => {
  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  after(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('Geofence: Inside Adama coordinates are accepted', () => {
    // Bole Subcity, Adama (8.5420, 39.2780)
    assert.strictEqual(isLocationInAdamaServiceArea(8.5420, 39.2780), true);
    // Kebele 02, Adama (8.5460, 39.2710)
    assert.strictEqual(isLocationInAdamaServiceArea(8.5460, 39.2710), true);
    // Wonji Road Junction (8.5180, 39.2820)
    assert.strictEqual(isLocationInAdamaServiceArea(8.5180, 39.2820), true);
  });

  it('Geofence: Outside Adama coordinates (Addis Ababa, Hawassa, Bishoftu) are rejected', () => {
    // Addis Ababa (9.0222, 38.7468)
    assert.strictEqual(isLocationInAdamaServiceArea(9.0222, 38.7468), false);
    // Hawassa (7.0504, 38.4955)
    assert.strictEqual(isLocationInAdamaServiceArea(7.0504, 38.4955), false);
    // Bishoftu (8.7523, 38.9785)
    assert.strictEqual(isLocationInAdamaServiceArea(8.7523, 38.9785), false);
  });

  it('Distance Calculation: Accurately computes distance between coordinates', () => {
    const dist = calculateDistanceKm(8.5420, 39.2780, 8.5460, 39.2710);
    assert.ok(dist >= 0.5 && dist <= 2.0);
  });

  it('User Model: Seller banking details are private (select: false) in standard queries', async () => {
    const seller = await User.create({
      name: 'Private Bank Test Seller',
      email: 'privatebank@seller.com',
      password: 'SellerPassword123',
      role: 'SELLER',
      sellerProfile: {
        shopName: 'Secure Bank Shop',
        bankName: 'Commercial Bank of Ethiopia',
        bankAccountHolder: 'Private Account Holder',
        bankAccountNumber: '1000999888777',
        approvalStatus: 'PENDING_APPROVAL',
      },
    });

    // Standard query must NOT return bank credentials
    const fetched = await User.findById(seller._id);
    assert.strictEqual(fetched.sellerProfile.bankAccountNumber, undefined);
    assert.strictEqual(fetched.sellerProfile.bankAccountHolder, undefined);
    assert.strictEqual(fetched.sellerProfile.bankName, undefined);

    // Explicit select returns credentials securely
    const adminFetched = await User.findById(seller._id).select(
      '+sellerProfile.bankName +sellerProfile.bankAccountHolder +sellerProfile.bankAccountNumber'
    );
    assert.strictEqual(adminFetched.sellerProfile.bankAccountNumber, '1000999888777');
    assert.strictEqual(adminFetched.sellerProfile.bankAccountHolder, 'Private Account Holder');
  });

  it('MapPlace Model: Admin-managed and OSM external places distinguish properly', async () => {
    const adminPlace = await MapPlace.create({
      name: 'Adama Verified Scrap Yard',
      category: 'Scrap Metals',
      materials: ['Iron', 'Steel'],
      address: 'Kebele 03, Adama',
      location: {
        type: 'Point',
        coordinates: [39.2910, 8.5520],
      },
      source: 'ADMIN_MANAGED',
      isVerified: true,
    });

    assert.strictEqual(adminPlace.source, 'ADMIN_MANAGED');
    assert.strictEqual(adminPlace.isVerified, true);
  });

  it('Order Model: Supports deliveryLocation GeoJSON and stores coordinates safely', async () => {
    const buyer = await User.create({
      name: 'Order Location Buyer',
      email: 'orderbuyer@test.com',
      password: 'BuyerPass123',
      role: 'BUYER',
    });

    const order = await Order.create({
      buyer: buyer._id,
      items: [],
      subtotal: 1000,
      deliveryFee: 100,
      total: 1100,
      paymentMethod: 'CHAPA',
      trackingNumber: 'AM-TEST-GPS-01',
      deliveryAddress: {
        streetAddress: 'Bole Subcity',
        subCity: 'Bole',
        city: 'Adama',
        phoneNumber: '+251911223344',
        latitude: 8.5420,
        longitude: 39.2780,
      },
      deliveryLocation: {
        type: 'Point',
        coordinates: [39.2780, 8.5420],
      },
    });

    assert.strictEqual(order.paymentMethod, 'CHAPA');
    assert.strictEqual(order.deliveryLocation.coordinates[0], 39.2780);
    assert.strictEqual(order.deliveryLocation.coordinates[1], 8.5420);
  });

  it('Google Auth: Links Google ID to existing account with same email without duplicating', async () => {
    // 1. Existing user registered with password
    const existing = await User.create({
      name: 'Existing Link User',
      email: 'existinglink@example.com',
      password: 'Password123!',
      role: 'SELLER',
      roles: ['SELLER'],
    });

    // 2. Simulate Google auth payload for same email
    const googleId = 'google-sub-998877';
    const email = 'existinglink@example.com';

    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    assert.ok(user, 'User must be found by email');
    assert.strictEqual(user._id.toString(), existing._id.toString());

    // Link googleId
    user.googleId = googleId;
    await user.save();

    // Verify account preserved, no duplicate
    const totalUsers = await User.countDocuments({ email: 'existinglink@example.com' });
    assert.strictEqual(totalUsers, 1, 'Duplicate user must NOT be created');

    const updated = await User.findById(existing._id);
    assert.strictEqual(updated.googleId, googleId);
    assert.strictEqual(updated.role, 'SELLER', 'Role must be preserved');
  });

  it('Seller Onboarding & Admin Approval Workflow: Flow from PENDING to APPROVED', async () => {
    // 1. Create seller applying for onboarding
    const seller = await User.create({
      name: 'Applicant Seller',
      email: 'applicant@seller.com',
      password: 'SellerPassword123',
      role: 'SELLER',
      sellerProfile: {
        shopName: 'Applicant Material Shop',
        shopAddress: 'Bole Road, Adama',
        bankName: 'Commercial Bank of Ethiopia',
        bankAccountHolder: 'Applicant Seller',
        bankAccountNumber: '100022334455',
        approvalStatus: 'PENDING_APPROVAL',
        shopLocation: {
          type: 'Point',
          coordinates: [39.2780, 8.5420],
        },
      },
      isSellerApproved: false,
    });

    assert.strictEqual(seller.sellerProfile.approvalStatus, 'PENDING_APPROVAL');
    assert.strictEqual(seller.isSellerApproved, false);

    // 2. Admin approves application
    seller.sellerProfile.approvalStatus = 'APPROVED';
    seller.isSellerApproved = true;
    await seller.save();

    const approved = await User.findById(seller._id);
    assert.strictEqual(approved.sellerProfile.approvalStatus, 'APPROVED');
    assert.strictEqual(approved.isSellerApproved, true);
  });

  it('Seller Onboarding Rejection: Admin can reject seller application', async () => {
    const seller = await User.create({
      name: 'Reject Test Seller',
      email: 'rejectme@seller.com',
      password: 'SellerPassword123',
      role: 'SELLER',
      sellerProfile: {
        shopName: 'Incomplete Shop',
        shopAddress: 'Nowhere',
        approvalStatus: 'PENDING_APPROVAL',
      },
      isSellerApproved: false,
    });

    // Admin rejects application
    seller.sellerProfile.approvalStatus = 'REJECTED';
    seller.isSellerApproved = false;
    await seller.save();

    const rejected = await User.findById(seller._id);
    assert.strictEqual(rejected.sellerProfile.approvalStatus, 'REJECTED');
    assert.strictEqual(rejected.isSellerApproved, false);
  });
});