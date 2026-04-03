const { query } = require('../config/db');
const logger = require('../utils/logger');

const create = async (uploadData) => {
  const {
    user_id,
    filename,
    filetype,
    size,
    file_path = null,
    status = 'pending',
  } = uploadData;

  logger.info('Creating new document upload', { user_id, filename, filetype, size });

  const result = await query(
    `INSERT INTO document_uploads (user_id, filename, filetype, size, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, filename, filetype, size, status, error_message, created_at, updated_at`,
    [user_id, filename, filetype, size, status]
  );

  return result.rows[0];
};

const findById = async (id) => {
  const result = await query(
    `SELECT id, user_id, filename, filetype, size, status, error_message, created_at, updated_at
     FROM document_uploads
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const findByUserId = async (userId) => {
  const result = await query(
    `SELECT id, user_id, filename, filetype, size, status, error_message, created_at, updated_at
     FROM document_uploads
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
};

const updateStatus = async (id, status, errorMessage = null) => {
  logger.info('Updating document upload status', { id, status, errorMessage });

  const result = await query(
    `UPDATE document_uploads
     SET status = $1, error_message = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING id, user_id, filename, filetype, size, status, error_message, created_at, updated_at`,
    [status, errorMessage, id]
  );

  if (result.rows[0]) {
    logger.info('Document upload status updated', { id, status });
  } else {
    logger.warn('Document upload not found for status update', { id });
  }

  return result.rows[0] || null;
};

const list = async (userId, filters = {}) => {
  const {
    status,
    filetype,
    start_date,
    end_date,
    page = 1,
    page_size = 50,
    sort_by = 'created_at',
    sort_order = 'DESC',
  } = filters;

  const conditions = ['user_id = $1'];
  const params = [userId];
  let paramIndex = 2;

  if (status) {
    conditions.push(`status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  if (filetype) {
    conditions.push(`filetype = $${paramIndex}`);
    params.push(filetype);
    paramIndex++;
  }

  if (start_date) {
    conditions.push(`created_at >= $${paramIndex}`);
    params.push(start_date);
    paramIndex++;
  }

  if (end_date) {
    conditions.push(`created_at <= $${paramIndex}`);
    params.push(end_date);
    paramIndex++;
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  // Whitelist allowed sort columns to prevent SQL injection
  const allowedSortColumns = ['created_at', 'updated_at', 'filename', 'filetype', 'size', 'status'];
  const safeSortBy = allowedSortColumns.includes(sort_by) ? sort_by : 'created_at';
  const safeSortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // Get total count
  const countSql = `SELECT COUNT(*) AS total FROM document_uploads ${whereClause}`;
  const countResult = await query(countSql, params);
  const total = parseInt(countResult.rows[0].total, 10);

  // Clamp page size and page
  const clampedPageSize = Math.min(Math.max(1, page_size), 500);
  const clampedPage = Math.max(1, page);
  const offset = (clampedPage - 1) * clampedPageSize;

  // Get paginated results
  const dataSql = `SELECT id, user_id, filename, filetype, size, status, error_message, created_at, updated_at
     FROM document_uploads
     ${whereClause}
     ORDER BY ${safeSortBy} ${safeSortOrder}
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;

  const dataParams = [...params, clampedPageSize, offset];
  const dataResult = await query(dataSql, dataParams);

  logger.info('Document uploads listed', {
    userId,
    filters,
    page: clampedPage,
    pageSize: clampedPageSize,
    total,
    returned: dataResult.rowCount,
  });

  return {
    uploads: dataResult.rows,
    page: clampedPage,
    page_size: clampedPageSize,
    total,
  };
};

const deleteById = async (id) => {
  logger.info('Deleting document upload', { id });

  const result = await query(
    'DELETE FROM document_uploads WHERE id = $1 RETURNING id',
    [id]
  );

  if (result.rowCount > 0) {
    logger.info('Document upload deleted', { id });
  } else {
    logger.warn('Document upload not found for deletion', { id });
  }

  return result.rowCount > 0;
};

const findByIdAndUserId = async (id, userId) => {
  const result = await query(
    `SELECT id, user_id, filename, filetype, size, status, error_message, created_at, updated_at
     FROM document_uploads
     WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return result.rows[0] || null;
};

const countByUserId = async (userId) => {
  const result = await query(
    'SELECT COUNT(*) AS total FROM document_uploads WHERE user_id = $1',
    [userId]
  );
  return parseInt(result.rows[0].total, 10);
};

const countByStatus = async (status) => {
  const result = await query(
    'SELECT COUNT(*) AS total FROM document_uploads WHERE status = $1',
    [status]
  );
  return parseInt(result.rows[0].total, 10);
};

module.exports = {
  create,
  findById,
  findByUserId,
  updateStatus,
  list,
  deleteById,
  findByIdAndUserId,
  countByUserId,
  countByStatus,
};