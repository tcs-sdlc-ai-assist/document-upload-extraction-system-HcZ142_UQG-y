const TokenManager = require('../services/TokenManager');
const logger = require('../utils/logger');
const { AppError } = require('./errorHandler');
const { ERROR_MESSAGES } = require('../config/constants');

const extractBearerToken = (req) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
};

const authenticate = (req, _res, next) => {
  const token = extractBearerToken(req);

  if (!token) {
    logger.warn('Authentication failed: no token provided', {
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
    });
    return next(new AppError(ERROR_MESSAGES.TOKEN_MISSING, 401));
  }

  const decoded = TokenManager.verifyAccessToken(token);

  if (!decoded) {
    logger.warn('Authentication failed: invalid or expired token', {
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
    });
    return next(new AppError(ERROR_MESSAGES.TOKEN_INVALID, 401));
  }

  req.user = {
    id: decoded.id,
    username: decoded.username,
    role: decoded.role,
  };

  logger.debug('Authentication successful', {
    userId: decoded.id,
    username: decoded.username,
    role: decoded.role,
    method: req.method,
    path: req.originalUrl,
  });

  return next();
};

const optionalAuth = (req, _res, next) => {
  const token = extractBearerToken(req);

  if (!token) {
    req.user = null;
    return next();
  }

  const decoded = TokenManager.verifyAccessToken(token);

  if (!decoded) {
    req.user = null;
    return next();
  }

  req.user = {
    id: decoded.id,
    username: decoded.username,
    role: decoded.role,
  };

  logger.debug('Optional authentication resolved', {
    userId: decoded.id,
    username: decoded.username,
    role: decoded.role,
    method: req.method,
    path: req.originalUrl,
  });

  return next();
};

module.exports = {
  authenticate,
  optionalAuth,
};