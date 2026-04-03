const { query } = require('../config/db');
const logger = require('../utils/logger');

const saveLog = async (logEntry) => {
  const {
    user_id = null,
    action,
    details = {},
    status = 'success',
    ip_address = null,
  } = logEntry;

  logger.info('Saving audit log entry', { action, user_id, status });

  const result = await query(
    `INSERT INTO audit_logs (user_id, action, details, status, ip_address)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, timestamp, user_id, action, details, status, ip_address`,
    [user_id, action, JSON.stringify(details), status, ip_address]
  );

  return result.rows[0];
};

const saveBatch = async (logEntries) => {
  if (!logEntries || logEntries.length === 0) {
    logger.warn('saveBatch called with empty entries');
    return [];
  }

  logger.info('Saving batch audit log entries', { count: logEntries.length });

  const values = [];
  const params = [];
  let paramIndex = 1;

  for (const entry of logEntries) {
    const userId = entry.user_id || null;
    const action = entry.action;
    const details = entry.details || {};
    const status = entry.status || 'success';
    const ipAddress = entry.ip_address || null;

    values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4})`);
    params.push(userId, action, JSON.stringify(details), status, ipAddress);
    paramIndex += 5;
  }

  const sql = `INSERT INTO audit_logs (user_id, action, details, status, ip_address)
     VALUES ${values.join(', ')}
     RETURNING id, timestamp, user_id, action, details, status, ip_address`;

  const result = await query(sql, params);

  logger.info('Batch audit log entries saved', { count: result.rowCount });

  return result.rows;
};

const findById = async (id) => {
  const result = await query(
    `SELECT id, timestamp, user_id, action, details, status, ip_address
     FROM audit_logs
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const queryLogs = async (filters = {}, page = 1, pageSize = 50) => {
  const {
    user_id,
    action,
    status,
    start_time,
    end_time,
    ip_address,
  } = filters;

  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (user_id) {
    conditions.push(`user_id = $${paramIndex}`);
    params.push(user_id);
    paramIndex++;
  }

  if (action) {
    conditions.push(`action = $${paramIndex}`);
    params.push(action);
    paramIndex++;
  }

  if (status) {
    conditions.push(`status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  if (ip_address) {
    conditions.push(`ip_address = $${paramIndex}`);
    params.push(ip_address);
    paramIndex++;
  }

  if (start_time) {
    conditions.push(`timestamp >= $${paramIndex}`);
    params.push(start_time);
    paramIndex++;
  }

  if (end_time) {
    conditions.push(`timestamp <= $${paramIndex}`);
    params.push(end_time);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countSql = `SELECT COUNT(*) AS total FROM audit_logs ${whereClause}`;
  const countResult = await query(countSql, params);
  const total = parseInt(countResult.rows[0].total, 10);

  // Clamp page size
  const clampedPageSize = Math.min(Math.max(1, pageSize), 500);
  const clampedPage = Math.max(1, page);
  const offset = (clampedPage - 1) * clampedPageSize;

  // Get paginated results
  const dataSql = `SELECT id, timestamp, user_id, action, details, status, ip_address
     FROM audit_logs
     ${whereClause}
     ORDER BY timestamp DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;

  const dataParams = [...params, clampedPageSize, offset];
  const dataResult = await query(dataSql, dataParams);

  logger.info('Audit logs queried', {
    filters,
    page: clampedPage,
    pageSize: clampedPageSize,
    total,
    returned: dataResult.rowCount,
  });

  return {
    logs: dataResult.rows,
    page: clampedPage,
    page_size: clampedPageSize,
    total,
  };
};

const exportLogs = async (filters = {}, format = 'json') => {
  const {
    user_id,
    action,
    status,
    start_time,
    end_time,
  } = filters;

  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (user_id) {
    conditions.push(`user_id = $${paramIndex}`);
    params.push(user_id);
    paramIndex++;
  }

  if (action) {
    conditions.push(`action = $${paramIndex}`);
    params.push(action);
    paramIndex++;
  }

  if (status) {
    conditions.push(`status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  if (start_time) {
    conditions.push(`timestamp >= $${paramIndex}`);
    params.push(start_time);
    paramIndex++;
  }

  if (end_time) {
    conditions.push(`timestamp <= $${paramIndex}`);
    params.push(end_time);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `SELECT id, timestamp, user_id, action, details, status, ip_address
     FROM audit_logs
     ${whereClause}
     ORDER BY timestamp DESC`;

  const result = await query(sql, params);

  logger.info('Audit logs exported', { format, filters, count: result.rowCount });

  if (format === 'csv') {
    return convertToCsv(result.rows);
  }

  return result.rows;
};

const convertToCsv = (rows) => {
  if (!rows || rows.length === 0) {
    return '';
  }

  const headers = ['id', 'timestamp', 'user_id', 'action', 'details', 'status', 'ip_address'];
  const csvLines = [headers.join(',')];

  for (const row of rows) {
    const values = headers.map((header) => {
      const val = row[header];
      if (val === null || val === undefined) {
        return '';
      }
      if (typeof val === 'object') {
        const escaped = JSON.stringify(val).replace(/"/g, '""');
        return `"${escaped}"`;
      }
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    csvLines.push(values.join(','));
  }

  return csvLines.join('\n');
};

const deleteLogsOlderThan = async (cutoffDate) => {
  logger.info('Deleting audit logs older than cutoff', { cutoffDate });

  const result = await query(
    'DELETE FROM audit_logs WHERE timestamp < $1 RETURNING id',
    [cutoffDate]
  );

  logger.info('Old audit logs deleted', { count: result.rowCount });

  return result.rowCount;
};

const countByAction = async (action, startTime, endTime) => {
  const conditions = ['action = $1'];
  const params = [action];
  let paramIndex = 2;

  if (startTime) {
    conditions.push(`timestamp >= $${paramIndex}`);
    params.push(startTime);
    paramIndex++;
  }

  if (endTime) {
    conditions.push(`timestamp <= $${paramIndex}`);
    params.push(endTime);
    paramIndex++;
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const result = await query(
    `SELECT COUNT(*) AS total FROM audit_logs ${whereClause}`,
    params
  );

  return parseInt(result.rows[0].total, 10);
};

const getDistinctActions = async () => {
  const result = await query(
    'SELECT DISTINCT action FROM audit_logs ORDER BY action'
  );
  return result.rows.map((row) => row.action);
};

module.exports = {
  saveLog,
  saveBatch,
  findById,
  queryLogs,
  exportLogs,
  deleteLogsOlderThan,
  countByAction,
  getDistinctActions,
};