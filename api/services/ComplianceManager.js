const AuditLogRepository = require('../repositories/AuditLogRepository');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const { ERROR_MESSAGES, AUDIT_ACTIONS, AUDIT_STATUS } = require('../config/constants');

const DEFAULT_RETENTION_DAYS = parseInt(process.env.LOG_RETENTION_DAYS, 10) || 365;

const exportAuditLogs = async (filters = {}, format = 'json') => {
  logger.info('Exporting audit logs', { filters, format });

  const allowedFormats = ['json', 'csv'];

  if (!allowedFormats.includes(format)) {
    logger.warn('Invalid export format requested', { format });
    throw new AppError('Export format must be one of: json, csv', 400);
  }

  const sanitizedFilters = sanitizeFilters(filters);

  const data = await AuditLogRepository.exportLogs(sanitizedFilters, format);

  const count = format === 'csv'
    ? (data ? data.split('\n').length - 1 : 0)
    : (Array.isArray(data) ? data.length : 0);

  logger.info('Audit logs exported successfully', { format, count });

  return {
    format,
    count,
    data,
  };
};

const enforceRetentionPolicy = async (retentionDays = DEFAULT_RETENTION_DAYS) => {
  logger.info('Enforcing log retention policy', { retentionDays });

  if (typeof retentionDays !== 'number' || retentionDays < 1) {
    logger.warn('Invalid retention period specified', { retentionDays });
    throw new AppError('Retention period must be a positive number of days', 400);
  }

  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  logger.info('Deleting audit logs older than cutoff date', {
    cutoffDate: cutoffDate.toISOString(),
    retentionDays,
  });

  const deletedCount = await AuditLogRepository.deleteLogsOlderThan(cutoffDate);

  logger.info('Retention policy enforced successfully', {
    deletedCount,
    cutoffDate: cutoffDate.toISOString(),
    retentionDays,
  });

  return {
    deleted_count: deletedCount,
    cutoff_date: cutoffDate.toISOString(),
    retention_days: retentionDays,
  };
};

const generateComplianceReport = async (startTime, endTime) => {
  logger.info('Generating compliance report', { startTime, endTime });

  if (!startTime || !endTime) {
    throw new AppError('start_time and end_time are required for compliance report', 400);
  }

  const parsedStart = new Date(startTime);
  const parsedEnd = new Date(endTime);

  if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
    throw new AppError('start_time and end_time must be valid ISO8601 date strings', 400);
  }

  if (parsedStart >= parsedEnd) {
    throw new AppError('start_time must be before end_time', 400);
  }

  const actions = await AuditLogRepository.getDistinctActions();

  const actionCounts = {};
  for (const action of actions) {
    const count = await AuditLogRepository.countByAction(action, parsedStart, parsedEnd);
    actionCounts[action] = count;
  }

  const totalLogs = Object.values(actionCounts).reduce((sum, count) => sum + count, 0);

  const successFilters = {
    status: AUDIT_STATUS.SUCCESS,
    start_time: parsedStart,
    end_time: parsedEnd,
  };
  const successResult = await AuditLogRepository.queryLogs(successFilters, 1, 1);
  const successCount = successResult.total;

  const failureFilters = {
    status: AUDIT_STATUS.FAILURE,
    start_time: parsedStart,
    end_time: parsedEnd,
  };
  const failureResult = await AuditLogRepository.queryLogs(failureFilters, 1, 1);
  const failureCount = failureResult.total;

  const report = {
    report_generated_at: new Date().toISOString(),
    period: {
      start: parsedStart.toISOString(),
      end: parsedEnd.toISOString(),
    },
    summary: {
      total_events: totalLogs,
      success_count: successCount,
      failure_count: failureCount,
      success_rate: totalLogs > 0
        ? Math.round((successCount / totalLogs) * 10000) / 100
        : 0,
    },
    events_by_action: actionCounts,
    retention_policy: {
      retention_days: DEFAULT_RETENTION_DAYS,
      cutoff_date: new Date(Date.now() - DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    },
  };

  logger.info('Compliance report generated successfully', {
    totalEvents: totalLogs,
    successCount,
    failureCount,
    period: report.period,
  });

  return report;
};

const getRetentionPolicy = () => {
  const cutoffDate = new Date(Date.now() - DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  return {
    retention_days: DEFAULT_RETENTION_DAYS,
    cutoff_date: cutoffDate.toISOString(),
  };
};

const queryAuditLogs = async (filters = {}, page = 1, pageSize = 50) => {
  logger.info('Querying audit logs', { filters, page, pageSize });

  const sanitizedFilters = sanitizeFilters(filters);

  const result = await AuditLogRepository.queryLogs(sanitizedFilters, page, pageSize);

  logger.info('Audit logs queried successfully', {
    page: result.page,
    pageSize: result.page_size,
    total: result.total,
    returned: result.logs.length,
  });

  return result;
};

const getAuditLogById = async (id) => {
  logger.info('Retrieving audit log by ID', { id });

  if (!id) {
    throw new AppError('Log ID is required', 400);
  }

  const log = await AuditLogRepository.findById(id);

  if (!log) {
    logger.warn('Audit log not found', { id });
    throw new AppError('Audit log not found', 404);
  }

  logger.info('Audit log retrieved successfully', { id });

  return log;
};

const sanitizeFilters = (filters) => {
  const sanitized = {};

  if (filters.user_id) {
    sanitized.user_id = String(filters.user_id);
  }

  if (filters.action) {
    sanitized.action = String(filters.action);
  }

  if (filters.status) {
    sanitized.status = String(filters.status);
  }

  if (filters.ip_address) {
    sanitized.ip_address = String(filters.ip_address);
  }

  if (filters.start_time) {
    const parsed = new Date(filters.start_time);
    if (!isNaN(parsed.getTime())) {
      sanitized.start_time = parsed;
    }
  }

  if (filters.end_time) {
    const parsed = new Date(filters.end_time);
    if (!isNaN(parsed.getTime())) {
      sanitized.end_time = parsed;
    }
  }

  return sanitized;
};

module.exports = {
  exportAuditLogs,
  enforceRetentionPolicy,
  generateComplianceReport,
  getRetentionPolicy,
  queryAuditLogs,
  getAuditLogById,
};