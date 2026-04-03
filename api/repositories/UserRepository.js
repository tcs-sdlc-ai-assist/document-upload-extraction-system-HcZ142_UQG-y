const { query } = require('../config/db');
const logger = require('../utils/logger');

const findById = async (id) => {
  const result = await query(
    'SELECT id, username, email, password_hash, role, created_at, updated_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
};

const findByUsername = async (username) => {
  const result = await query(
    'SELECT id, username, email, password_hash, role, created_at, updated_at FROM users WHERE username = $1',
    [username]
  );
  return result.rows[0] || null;
};

const findByEmail = async (email) => {
  const result = await query(
    'SELECT id, username, email, password_hash, role, created_at, updated_at FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0] || null;
};

const create = async (userData) => {
  const { username, email, password_hash, role = 'user' } = userData;

  logger.info('Creating new user', { username, email, role });

  const result = await query(
    `INSERT INTO users (username, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, username, email, role, created_at, updated_at`,
    [username, email, password_hash, role]
  );

  return result.rows[0];
};

const updateLastLogin = async (id) => {
  const result = await query(
    `UPDATE users SET updated_at = NOW() WHERE id = $1
     RETURNING id, username, email, role, created_at, updated_at`,
    [id]
  );
  return result.rows[0] || null;
};

module.exports = {
  findById,
  findByUsername,
  findByEmail,
  create,
  updateLastLogin,
};