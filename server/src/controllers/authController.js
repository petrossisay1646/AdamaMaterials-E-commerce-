const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Address = require('../models/Address');
const AppError = require('../utils/appError');
const asyncHandler = require('../utils/asyncHandler');
const { sendTokenCookies, clearTokenCookies } = require('../utils/tokens');
const { isLocationInAdamaServiceArea } = require('../config/serviceArea');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Helper to verify Google ID token
async function verifyGoogleToken(idToken) {
  try {
    if (process.env.GOOGLE_CLIENT_ID) {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      return ticket.getPayload();
    }
  } catch (err) {
    console.warn('[Google Auth] google-auth-library verification failed, trying tokeninfo endpoint:', err.message);
  }

  // Fallback to Google's public tokeninfo endpoint
  const response = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`, {
    timeout: 10000,
  });
  if (response.data && response.data.email) {
    return response.data;
  }
  throw new Error('Invalid Google credential.');
}

// 1. Register Buyer or Seller
exports.register = asyncHandler(async (req, res, next) => {
  const { name, email, password, role } = req.body;

  // Basic check on roles
  if (role && !['BUYER', 'SELLER'].includes(role)) {
    return next(new AppError('You can only register as a BUYER or SELLER.', 400));
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new AppError('Email address is already in use.', 400));
  }

  // Create new user
  const newUser = await User.create({
    name,
    email,
    password,
    role: role || 'BUYER',
    roles: [role || 'BUYER'],
    isActive: true, // Default active
  });

  // Generate tokens & set cookies
  const tokens = sendTokenCookies(newUser, res);

  // Save refresh token in DB
  newUser.refreshToken = tokens.refreshToken;
  await newUser.save({ validateBeforeSave: false });

  // Hide password
  newUser.password = undefined;

  res.status(201).json({
    success: true,
    user: newUser,
  });
});

// 2. Login User
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('Please provide both email and password.', 400));
  }

  // Find user and select password
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError('Incorrect email or password.', 401));
  }

  if (!user.isActive) {
    return next(new AppError('Your account has been suspended.', 403));
  }

  // Generate tokens & set cookies
  const tokens = sendTokenCookies(user, res);

  // Save refresh token in DB
  user.refreshToken = tokens.refreshToken;
  await user.save({ validateBeforeSave: false });

  user.password = undefined;

  res.status(200).json({
    success: true,
    user,
  });
});

// 2b. Google Sign-In / OAuth
exports.googleAuth = asyncHandler(async (req, res, next) => {
  const { credential, accessToken } = req.body;

  if (!credential && !accessToken) {
    return next(new AppError('Google credential is required.', 400));
  }

  let payload = null;

  if (credential) {
    try {
      payload = await verifyGoogleToken(credential);
    } catch (err) {
      return next(new AppError(`Google authentication failed: ${err.message}`, 401));
    }
  } else if (accessToken) {
    try {
      const response = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      });
      payload = response.data;
    } catch (err) {
      return next(new AppError('Failed to fetch user info from Google.', 401));
    }
  }

  if (!payload || !payload.email) {
    return next(new AppError('Could not retrieve email from Google.', 400));
  }

  const email = payload.email.toLowerCase().trim();
  const name = payload.name || payload.given_name || 'Google User';
  const googleId = payload.sub || payload.id;
  const avatar = payload.picture || '';

  // Safe Account Linking: Look up by googleId first, then by verified email
  let user = await User.findOne({ $or: [{ googleId }, { email }] });
  let isNewUser = false;

  if (user) {
    if (!user.googleId) {
      user.googleId = googleId;
    }
    if (!user.avatar && avatar) {
      user.avatar = avatar;
    }
    await user.save({ validateBeforeSave: false });
  } else {
    isNewUser = true;
    user = await User.create({
      name,
      email,
      googleId,
      avatar,
      role: 'BUYER',
      roles: ['BUYER'],
      isActive: true,
    });
  }

  if (!user.isActive) {
    return next(new AppError('Your account has been suspended.', 403));
  }

  const tokens = sendTokenCookies(user, res);
  user.refreshToken = tokens.refreshToken;
  await user.save({ validateBeforeSave: false });

  user.password = undefined;

  const needsRoleSelection = isNewUser || (!user.phoneNumber && user.role === 'BUYER');

  res.status(200).json({
    success: true,
    user,
    isNewUser,
    needsRoleSelection,
    accessToken: tokens.accessToken,
  });
});

// 3. Refresh Access Token
exports.refresh = asyncHandler(async (req, res, next) => {
  let rToken;

  if (req.cookies && req.cookies.refreshToken) {
    rToken = req.cookies.refreshToken;
  }

  if (!rToken) {
    return next(new AppError('Refresh token is missing. Please log in again.', 401));
  }

  try {
    const decoded = jwt.verify(rToken, process.env.JWT_REFRESH_SECRET);

    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || !user.isActive || user.refreshToken !== rToken) {
      return next(new AppError('Invalid refresh session. Please authenticate again.', 401));
    }

    // Refresh cookies
    const tokens = sendTokenCookies(user, res);
    user.refreshToken = tokens.refreshToken;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      accessToken: tokens.accessToken,
    });
  } catch (error) {
    return next(new AppError('Expired or invalid refresh token.', 401));
  }
});

// 4. Logout User
exports.logout = asyncHandler(async (req, res, next) => {
  let rToken;

  if (req.cookies && req.cookies.refreshToken) {
    rToken = req.cookies.refreshToken;
  }

  if (rToken) {
    // Clear in database
    const decoded = jwt.decode(rToken);
    if (decoded && decoded.id) {
      await User.findByIdAndUpdate(decoded.id, { $unset: { refreshToken: 1 } });
    }
  }

  clearTokenCookies(res);

  res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
});

// 4. Role Selection & Profile Onboarding
exports.completeOnboarding = asyncHandler(async (req, res, next) => {
  const {
    role,
    phoneNumber,
    shopName,
    shopDescription,
    shopAddress,
    categoriesSold,
    latitude,
    longitude,
    bankName,
    bankAccountHolder,
    bankAccountNumber,
    preferredContact,
  } = req.body;

  const user = await User.findById(req.user._id);
  if (!user) return next(new AppError('User not found.', 404));

  if (phoneNumber) user.phoneNumber = phoneNumber.trim();

  if (role === 'SELLER') {
    if (!shopName || !shopAddress) {
      return next(new AppError('Shop name and shop address are required for sellers.', 400));
    }
    if (!bankName || !bankAccountHolder || !bankAccountNumber) {
      return next(new AppError('Bank name, account holder, and account number are required for seller payouts.', 400));
    }

    user.role = 'SELLER';
    if (!user.roles.includes('SELLER')) {
      user.roles.push('SELLER');
    }

    if (!user.sellerProfile) user.sellerProfile = {};
    user.sellerProfile.shopName = shopName.trim();
    user.sellerProfile.shopDescription = shopDescription || '';
    user.sellerProfile.shopAddress = shopAddress.trim();
    user.sellerProfile.bankName = bankName.trim();
    user.sellerProfile.bankAccountHolder = bankAccountHolder.trim();
    user.sellerProfile.bankAccountNumber = bankAccountNumber.trim();
    user.sellerProfile.approvalStatus = 'PENDING_APPROVAL';
    user.isSellerApproved = false;

    if (Array.isArray(categoriesSold)) {
      user.sellerProfile.categoriesSold = categoriesSold;
    }

    if (latitude !== undefined && longitude !== undefined) {
      const numLat = Number(latitude);
      const numLng = Number(longitude);
      if (!isLocationInAdamaServiceArea(numLat, numLng)) {
        return next(
          new AppError(
            'The selected shop location is outside the Adama City service area. Sellers must operate within Adama.',
            400
          )
        );
      }
      user.sellerProfile.shopLocation = {
        type: 'Point',
        coordinates: [numLng, numLat],
        address: shopAddress,
      };
    }
  } else if (role === 'BUYER') {
    user.role = 'BUYER';
    if (!user.roles.includes('BUYER')) {
      user.roles.push('BUYER');
    }
    if (!user.buyerProfile) user.buyerProfile = {};
    if (preferredContact) user.buyerProfile.preferredContact = preferredContact;

    // Save initial delivery address if provided
    const { streetAddress, subCity, city = 'Adama' } = req.body;
    if (streetAddress || subCity || (latitude !== undefined && longitude !== undefined)) {
      const addrData = {
        user: user._id,
        title: 'Primary Delivery Location',
        streetAddress: streetAddress || subCity || 'Adama',
        subCity: subCity || 'Adama',
        city: city || 'Adama',
        phoneNumber: phoneNumber || user.phoneNumber || '',
        isDefault: true,
      };
      if (latitude !== undefined && longitude !== undefined) {
        const numLat = Number(latitude);
        const numLng = Number(longitude);
        if (isLocationInAdamaServiceArea(numLat, numLng)) {
          addrData.location = {
            type: 'Point',
            coordinates: [numLng, numLat],
          };
        }
      }
      await Address.findOneAndUpdate(
        { user: user._id, isDefault: true },
        addrData,
        { upsert: true, new: true }
      );
    }
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Profile onboarding completed successfully.',
    user,
  });
});

// 5. Update Seller Shop Location
exports.updateSellerLocation = asyncHandler(async (req, res, next) => {
  const { latitude, longitude, address } = req.body;

  if (latitude === undefined || longitude === undefined) {
    return next(new AppError('Latitude and longitude coordinates are required.', 400));
  }

  const numLat = Number(latitude);
  const numLng = Number(longitude);

  if (!isLocationInAdamaServiceArea(numLat, numLng)) {
    return next(
      new AppError(
        'The selected shop location is outside the Adama City service area. Sellers must operate within Adama.',
        400
      )
    );
  }

  const user = await User.findById(req.user._id);
  if (!user) return next(new AppError('User not found.', 404));

  if (!user.sellerProfile) user.sellerProfile = {};
  user.sellerProfile.shopLocation = {
    type: 'Point',
    coordinates: [numLng, numLat],
    address: address || user.sellerProfile.shopAddress || 'Adama Shop Location',
  };

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Shop location updated successfully.',
    shopLocation: user.sellerProfile.shopLocation,
  });
});

// 6. Get current authenticated user details
exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id).populate('sellerProfile.categoriesSold');
  res.status(200).json({
    success: true,
    user: user || req.user,
  });
});

// 7. Update user profile details
exports.updateMe = asyncHandler(async (req, res, next) => {
  const { name, email, phoneNumber } = req.body;

  const updates = {};
  if (name) updates.name = name;
  if (phoneNumber) updates.phoneNumber = phoneNumber;
  if (email) {
    const existing = await User.findOne({ email, _id: { $ne: req.user._id } });
    if (existing) {
      return next(new AppError('Email already in use.', 400));
    }
    updates.email = email;
  }

  const updatedUser = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    user: updatedUser,
  });
});

// ================= ADDRESS MANAGEMENT =================

// Add new address
exports.addAddress = asyncHandler(async (req, res, next) => {
  const { title, streetAddress, subCity, city, state, postalCode, phoneNumber, isDefault, latitude, longitude } = req.body;

  let location = undefined;
  if (latitude !== undefined && longitude !== undefined) {
    location = {
      type: 'Point',
      coordinates: [Number(longitude), Number(latitude)],
    };
  }

  const newAddress = await Address.create({
    user: req.user._id,
    title,
    streetAddress,
    subCity,
    city,
    state,
    postalCode,
    phoneNumber,
    location,
    isDefault: !!isDefault,
  });

  res.status(201).json({
    success: true,
    address: newAddress,
  });
});

// Get user addresses
exports.getMyAddresses = asyncHandler(async (req, res, next) => {
  const addresses = await Address.find({ user: req.user._id }).sort({ isDefault: -1, createdAt: -1 });

  res.status(200).json({
    success: true,
    addresses,
  });
});

// Update Address
exports.updateAddress = asyncHandler(async (req, res, next) => {
  const { addressId } = req.params;

  const address = await Address.findById(addressId);
  if (!address) {
    return next(new AppError('Address not found.', 404));
  }

  // Strict ownership check
  if (address.user.toString() !== req.user._id.toString()) {
    return next(new AppError('You do not own this address.', 403));
  }

  const updates = { ...req.body, user: req.user._id };
  if (req.body.latitude !== undefined && req.body.longitude !== undefined) {
    updates.location = {
      type: 'Point',
      coordinates: [Number(req.body.longitude), Number(req.body.latitude)],
    };
  }

  const updatedAddress = await Address.findByIdAndUpdate(
    addressId,
    updates,
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    address: updatedAddress,
  });
});

// Delete Address
exports.deleteAddress = asyncHandler(async (req, res, next) => {
  const { addressId } = req.params;

  const address = await Address.findById(addressId);
  if (!address) {
    return next(new AppError('Address not found.', 404));
  }

  // Strict ownership check
  if (address.user.toString() !== req.user._id.toString()) {
    return next(new AppError('You do not own this address.', 403));
  }

  await address.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Address deleted successfully.',
  });
});
