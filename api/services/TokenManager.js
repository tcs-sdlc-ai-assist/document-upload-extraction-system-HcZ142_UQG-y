const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { TOKEN_EXPIRY, ERROR_MESSAGES } = require('../config/constants');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET + '-refresh';

const generateAccessToken = (payload) => {
  const { id, username, role } = payload;

  logger.info('Generating access token', { userId: id, username, role });

  const token = jwt.sign(
    {
      id,
      username,
      role,
      type: 'access',
    },
    JWT_SECRET,
    {
      expiresIn: TOKEN_EXPIRY.ACCESS,
      issuer: 'doc-upload-extraction',
      subject: String(id),
    }
  );

  return token;
};

const generateRefreshToken = (payload) => {
  const { id, username, role } = payload;

  logger.info('Generating refresh token', { userId: id, username });

  const jti = crypto.randomUUID();

  const token = jwt.sign(
    {
      id,
      username,
      role,
      type: 'refresh',
      jti,
    },
    REFRESH_SECRET,
    {
      expiresIn: TOKEN_EXPIRY.REFRESH,
      issuer: 'doc-upload-extraction',
      subject: String(id),
    }
  );

  return token;
};

const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'doc-upload-extraction',
    });

    if (decoded.type !== 'access') {
      logger.warn('Token type mismatch: expected access token', { type: decoded.type });
      return null;
    }

    return decoded;
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      logger.warn('Access token expired', { expiredAt: err.expiredAt });
    } else if (err.name === 'JsonWebTokenError') {
      logger.warn('Invalid access token', { message: err.message });
    } else {
      logger.error('Access token verification error', { error: err.message });
    }
    return null;
  }
};

const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, REFRESH_SECRET, {
      issuer: 'doc-upload-extraction',
    });

    if (decoded.type !== 'refresh') {
      logger.warn('Token type mismatch: expected refresh token', { type: decoded.type });
      return null;
    }

    return decoded;
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      logger.warn('Refresh token expired', { expiredAt: err.expiredAt });
    } else if (err.name === 'JsonWebTokenError') {
      logger.warn('Invalid refresh token', { message: err.message });
    } else {
      logger.error('Refresh token verification error', { error: err.message });
    }
    return null;
  }
};

const getAccessTokenExpiry = () => {
  return TOKEN_EXPIRY.ACCESS;
};

const getRefreshTokenExpiry = () => {
  return TOKEN_EXPIRY.REFRESH;
};

const getRefreshTokenExpiryDate = () => {
  const expiry = TOKEN_EXPIRY.REFRESH;
  const match = expiry.match(/^(\d+)([smhd])$/);

  if (!match) {
    // Default to 7 days if parsing fails
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  const ms = value * (multipliers[unit] || multipliers.d);
  return new Date(Date.now() + ms);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getAccessTokenExpiry,
  getRefreshTokenExpiry,
  getRefreshTokenExpiryDate,
};