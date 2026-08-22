const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/appError');
const asyncHandler = require('../utils/asyncHandler');

// 1. Protect routes (JWT verification)
const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Extract from cookie or authorization header
  if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('You are not logged in. Please log in to gain access.', 401));
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'adama_marketplace_jwt_secret_dev_key_2026_secure');

    // Fetch user and check if still active
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    if (!currentUser.isActive) {
      return next(new AppError('This user account has been suspended.', 403));
    }

    // Grant access
    req.user = currentUser;
    next();
  } catch (error) {
    return next(new AppError('Invalid or expired access token. Please authenticate.', 401));
  }
});

// 2. Restrict to specific roles
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
};

// 3. Restrict to specific staff permission (Admins bypass permission checks)
const hasPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }

    // Admins have override access for all staff permissions
    if (req.user.role === 'ADMIN') {
      return next();
    }

    if (req.user.role === 'STAFF' && req.user.staffPermissions.includes(permission)) {
      return next();
    }

    return next(new AppError(`Forbidden. Requires permission: ${permission}`, 403));
  };
};

module.exports = {
  protect,
  restrictTo,
  hasPermission,
};
