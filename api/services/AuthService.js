const bcrypt = require('bcryptjs');
const UserRepository = require('../repositories/UserRepository');
const TokenManager = require('./TokenManager');
const SessionManager = require('./SessionManager');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const { ERROR_MESSAGES, AUDIT_ACTIONS, AUDIT_STATUS } = require('../config/constants');

const login = async (username, password) => {
  logger.info('Login attempt', { username });

  if (!username || !password) {
    logger.warn('Login failed: missing credentials', { username });
    throw new AppError(ERROR_MESSAGES.INVALID_CREDENTIALS, 401);
  }

  const user = await UserRepository.findByUsername(username);

  if (!user) {
    logger.warn('Login failed: user not found', { username });
    throw new AppError(ERROR_MESSAGES.INVALID_CREDENTIALS, 401);
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordValid) {
    logger.warn('Login failed: invalid password', { username, userId: user.id });
    throw new AppError(ERROR_MESSAGES.INVALID_CREDENTIALS, 401);
  }

  const tokenPayload = {
    id: user.id,
    username: user.username,
    role: user.role,
  };

  const accessToken = TokenManager.generateAccessToken(tokenPayload);
  const refreshToken = TokenManager.generateRefreshToken(tokenPayload);

  await SessionManager.createSession(user.id, refreshToken);

  await UserRepository.updateLastLogin(user.id);

  logger.info('Login successful', { userId: user.id, username: user.username });

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: TokenManager.getAccessTokenExpiry(),
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  };
};

const logout = async (refreshToken) => {
  logger.info('Logout attempt');

  if (!refreshToken) {
    logger.warn('Logout failed: no refresh token provided');
    throw new AppError(ERROR_MESSAGES.REFRESH_TOKEN_INVALID, 400);
  }

  const deleted = await SessionManager.invalidateSession(refreshToken);

  if (!deleted) {
    logger.warn('Logout failed: session not found or already invalidated');
    throw new AppError(ERROR_MESSAGES.REFRESH_TOKEN_INVALID, 400);
  }

  logger.info('Logout successful');

  return { message: 'Logged out successfully.' };
};

const refreshToken = async (token) => {
  logger.info('Token refresh attempt');

  if (!token) {
    logger.warn('Token refresh failed: no refresh token provided');
    throw new AppError(ERROR_MESSAGES.REFRESH_TOKEN_INVALID, 401);
  }

  const sessionData = await SessionManager.validateSession(token);

  if (!sessionData) {
    logger.warn('Token refresh failed: invalid or expired session');
    throw new AppError(ERROR_MESSAGES.REFRESH_TOKEN_INVALID, 401);
  }

  const { decoded } = sessionData;

  const user = await UserRepository.findById(decoded.id);

  if (!user) {
    logger.warn('Token refresh failed: user not found', { userId: decoded.id });
    await SessionManager.invalidateSession(token);
    throw new AppError(ERROR_MESSAGES.USER_NOT_FOUND, 401);
  }

  const tokenPayload = {
    id: user.id,
    username: user.username,
    role: user.role,
  };

  const accessToken = TokenManager.generateAccessToken(tokenPayload);

  logger.info('Token refresh successful', { userId: user.id });

  return {
    access_token: accessToken,
    expires_in: TokenManager.getAccessTokenExpiry(),
  };
};

const getSession = async (accessToken) => {
  logger.info('Session status check');

  if (!accessToken) {
    logger.warn('Session check failed: no access token provided');
    throw new AppError(ERROR_MESSAGES.TOKEN_MISSING, 401);
  }

  const decoded = TokenManager.verifyAccessToken(accessToken);

  if (!decoded) {
    logger.warn('Session check failed: invalid or expired access token');
    throw new AppError(ERROR_MESSAGES.TOKEN_INVALID, 401);
  }

  const user = await UserRepository.findById(decoded.id);

  if (!user) {
    logger.warn('Session check failed: user not found', { userId: decoded.id });
    throw new AppError(ERROR_MESSAGES.USER_NOT_FOUND, 401);
  }

  const expiresIn = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 0;

  logger.info('Session check successful', { userId: user.id });

  return {
    active: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    expires_in: expiresIn > 0 ? expiresIn : 0,
  };
};

module.exports = {
  login,
  logout,
  refreshToken,
  getSession,
};