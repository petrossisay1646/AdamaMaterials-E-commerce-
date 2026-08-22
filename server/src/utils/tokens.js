const jwt = require('jsonwebtoken');

// Create short-lived access token
const signAccessToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      permissions: user.staffPermissions || [],
    },
    process.env.JWT_SECRET || 'adama_marketplace_jwt_secret_dev_key_2026_secure',
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    }
  );
};

// Create long-lived refresh token
const signRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
    },
    process.env.JWT_REFRESH_SECRET || 'adama_marketplace_jwt_refresh_secret_dev_key_2026_secure',
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    }
  );
};

// Send authentication cookies
const sendTokenCookies = (user, res) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  const isProduction = process.env.NODE_ENV === 'production';

  /*
   * Production:
   * Frontend = Vercel
   * Backend  = Render
   *
   * Because they are separate sites, cross-site cookies
   * require:
   *   SameSite=None
   *   Secure=true
   *
   * Development:
   * localhost can use SameSite=Lax.
   */

  const accessTokenCookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: '/',
  };

  const refreshTokenCookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  };

  res.cookie(
    'accessToken',
    accessToken,
    accessTokenCookieOptions
  );

  res.cookie(
    'refreshToken',
    refreshToken,
    refreshTokenCookieOptions
  );

  return {
    accessToken,
    refreshToken,
  };
};

// Clear authentication cookies
const clearTokenCookies = (res) => {
  const isProduction = process.env.NODE_ENV === 'production';

  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  };

  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  sendTokenCookies,
  clearTokenCookies,
};