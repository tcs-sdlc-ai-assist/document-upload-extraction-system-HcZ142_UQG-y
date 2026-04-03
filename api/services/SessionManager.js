const SessionRepository = require('../repositories/SessionRepository');
const TokenManager = require('./TokenManager');
const logger = require('../utils/logger');
const { ERROR_MESSAGES } = require('../config/constants');

const createSession = async (userId, refreshToken) => {
  const expiresAt = TokenManager.getRefreshTokenExpiryDate();

  logger.info('Creating session', { userId });

  const session = await SessionRepository.create({
    user_id: userId,
    refresh_token: refreshToken,
    expires_at: expiresAt,
  });

  logger.info('Session created successfully', { userId, sessionId: session.id });

  return session;
};

const validateSession = async (refreshToken) => {
  if (!refreshToken) {
    logger.warn('Session validation failed: no refresh token provided');
    return null;
  }

  const session = await SessionRepository.findByToken(refreshToken);

  if (!session) {
    logger.warn('Session validation failed: session not found');
    return null;
  }

  const now = new Date();
  const expiresAt = new Date(session.expires_at);

  if (expiresAt <= now) {
    logger.warn('Session validation failed: session expired', {
      sessionId: session.id,
      userId: session.user_id,
      expiredAt: session.expires_at,
    });

    await SessionRepository.deleteByToken(refreshToken);
    return null;
  }

  const decoded = TokenManager.verifyRefreshToken(refreshToken);

  if (!decoded) {
    logger.warn('Session validation failed: invalid refresh token', {
      sessionId: session.id,
      userId: session.user_id,
    });

    await SessionRepository.deleteByToken(refreshToken);
    return null;
  }

  logger.info('Session validated successfully', {
    sessionId: session.id,
    userId: session.user_id,
  });

  return {
    session,
    decoded,
  };
};

const invalidateSession = async (refreshToken) => {
  if (!refreshToken) {
    logger.warn('Session invalidation failed: no refresh token provided');
    return false;
  }

  logger.info('Invalidating session');

  const deleted = await SessionRepository.deleteByToken(refreshToken);

  if (deleted) {
    logger.info('Session invalidated successfully');
  } else {
    logger.warn('Session invalidation: session not found');
  }

  return deleted;
};

const invalidateAllUserSessions = async (userId) => {
  if (!userId) {
    logger.warn('Session invalidation failed: no user ID provided');
    return 0;
  }

  logger.info('Invalidating all sessions for user', { userId });

  const count = await SessionRepository.deleteByUserId(userId);

  logger.info('All user sessions invalidated', { userId, count });

  return count;
};

const cleanupExpired = async () => {
  logger.info('Starting expired session cleanup');

  const count = await SessionRepository.deleteExpired();

  logger.info('Expired session cleanup completed', { removedCount: count });

  return count;
};

const getActiveSessionsByUserId = async (userId) => {
  if (!userId) {
    logger.warn('Get active sessions failed: no user ID provided');
    return [];
  }

  const sessions = await SessionRepository.findByUserId(userId);

  const now = new Date();
  const activeSessions = sessions.filter((session) => {
    const expiresAt = new Date(session.expires_at);
    return expiresAt > now;
  });

  logger.info('Retrieved active sessions for user', {
    userId,
    totalSessions: sessions.length,
    activeSessions: activeSessions.length,
  });

  return activeSessions;
};

module.exports = {
  createSession,
  validateSession,
  invalidateSession,
  invalidateAllUserSessions,
  cleanupExpired,
  getActiveSessionsByUserId,
};