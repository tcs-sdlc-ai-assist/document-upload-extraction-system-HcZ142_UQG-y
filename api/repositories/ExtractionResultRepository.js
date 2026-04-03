const { query } = require('../config/db');
const logger = require('../utils/logger');

const save = async (resultData) => {
  const {
    upload_id,
    extracted_data = {},
  } = resultData;

  logger.info('Saving extraction result', { upload_id });

  const result = await query(
    `INSERT INTO extraction_results (upload_id, extracted_data)
     VALUES ($1, $2)
     RETURNING id, upload_id, extracted_data, processed_at`,
    [upload_id, JSON.stringify(extracted_data)]
  );

  logger.info('Extraction result saved', { upload_id, id: result.rows[0].id });

  return result.rows[0];
};

const findByUploadId = async (uploadId) => {
  const result = await query(
    `SELECT id, upload_id, extracted_data, processed_at
     FROM extraction_results
     WHERE upload_id = $1`,
    [uploadId]
  );
  return result.rows[0] || null;
};

const findById = async (id) => {
  const result = await query(
    `SELECT id, upload_id, extracted_data, processed_at
     FROM extraction_results
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const list = async (filters = {}) => {
  const {
    upload_id,
    start_date,
    end_date,
    page = 1,
    page_size = 50,
    sort_by = 'processed_at',
    sort_order = 'DESC',
  } = filters;

  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (upload_id) {
    conditions.push(`er.upload_id = $${paramIndex}`);
    params.push(upload_id);
    paramIndex++;
  }

  if (start_date) {
    conditions.push(`er.processed_at >= $${paramIndex}`);
    params.push(start_date);
    paramIndex++;
  }

  if (end_date) {
    conditions.push(`er.processed_at <= $${paramIndex}`);
    params.push(end_date);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Whitelist allowed sort columns to prevent SQL injection
  const allowedSortColumns = ['processed_at', 'upload_id'];
  const safeSortBy = allowedSortColumns.includes(sort_by) ? sort_by : 'processed_at';
  const safeSortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // Get total count
  const countSql = `SELECT COUNT(*) AS total FROM extraction_results er ${whereClause}`;
  const countResult = await query(countSql, params);
  const total = parseInt(countResult.rows[0].total, 10);

  // Clamp page size and page
  const clampedPageSize = Math.min(Math.max(1, page_size), 500);
  const clampedPage = Math.max(1, page);
  const offset = (clampedPage - 1) * clampedPageSize;

  // Get paginated results
  const dataSql = `SELECT er.id, er.upload_id, er.extracted_data, er.processed_at
     FROM extraction_results er
     ${whereClause}
     ORDER BY er.${safeSortBy} ${safeSortOrder}
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;

  const dataParams = [...params, clampedPageSize, offset];
  const dataResult = await query(dataSql, dataParams);

  logger.info('Extraction results listed', {
    filters,
    page: clampedPage,
    pageSize: clampedPageSize,
    total,
    returned: dataResult.rowCount,
  });

  return {
    results: dataResult.rows,
    page: clampedPage,
    page_size: clampedPageSize,
    total,
  };
};

const deleteByUploadId = async (uploadId) => {
  logger.info('Deleting extraction result by upload ID', { upload_id: uploadId });

  const result = await query(
    'DELETE FROM extraction_results WHERE upload_id = $1 RETURNING id',
    [uploadId]
  );

  if (result.rowCount > 0) {
    logger.info('Extraction result deleted', { upload_id: uploadId });
  } else {
    logger.warn('Extraction result not found for deletion', { upload_id: uploadId });
  }

  return result.rowCount > 0;
};

const updateExtractedData = async (uploadId, extractedData) => {
  logger.info('Updating extraction result', { upload_id: uploadId });

  const result = await query(
    `UPDATE extraction_results
     SET extracted_data = $1, processed_at = NOW()
     WHERE upload_id = $2
     RETURNING id, upload_id, extracted_data, processed_at`,
    [JSON.stringify(extractedData), uploadId]
  );

  if (result.rows[0]) {
    logger.info('Extraction result updated', { upload_id: uploadId });
  } else {
    logger.warn('Extraction result not found for update', { upload_id: uploadId });
  }

  return result.rows[0] || null;
};

module.exports = {
  save,
  findByUploadId,
  findById,
  list,
  deleteByUploadId,
  updateExtractedData,
};