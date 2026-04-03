const { query } = require('../config/db');
const logger = require('../utils/logger');

const create = async (sessionData) => {
  const { user_id, refresh_token, expires_at } = sessionData;

  logger.info('Creating new session', { user_id });

  const result = await query(
    `INSERT INTO sessions (user_id, refresh_token, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, refresh_token, expires_at, created_at`,
    [user_id, refresh_token, expires_at]
  );

  return result.rows[0];
};

const findByToken = async (refreshToken) => {
  const result = await query(
    `SELECT id, user_id, refresh_token, expires_at, created_at
     FROM sessions
     WHERE refresh_token = $1`,
    [refreshToken]
  );
  return result.rows[0] || null;
};

const findByUserId = async (userId) => {
  const result = await query(
    `SELECT id, user_id, refresh_token, expires_at, created_at
     FROM sessions
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
};

const deleteByToken = async (refreshToken) => {
  logger.info('Deleting session by token');

  const result = await query(
    'DELETE FROM sessions WHERE refresh_token = $1 RETURNING id',
    [refreshToken]
  );
  return result.rowCount > 0;
};

const deleteByUserId = async (userId) => {
  logger.info('Deleting all sessions for user', { user_id: userId });

  const result = await query(
    'DELETE FROM sessions WHERE user_id = $1 RETURNING id',
    [userId]
  );
  return result.rowCount;
};

const deleteExpired = async () => {
  logger.info('Purging expired sessions');

  const result = await query(
    'DELETE FROM sessions WHERE expires_at < NOW() RETURNING id'
  );

  logger.info('Expired sessions purged', { count: result.rowCount });
  return result.rowCount;
};

module.exports = {
  create,
  findByToken,
  findByUserId,
  deleteByToken,
  deleteByUserId,
  deleteExpired,
};