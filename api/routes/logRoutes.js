const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const LogIngestionService = require('../services/LogIngestionService');
const ComplianceManager = require('../services/ComplianceManager');
const { authenticate } = require('../middleware/authMiddleware');
const { AppError } = require('../middleware/errorHandler');
const { ERROR_MESSAGES, USER_ROLES } = require('../config/constants');
const logger = require('../utils/logger');

const router = express.Router();

const handleValidationErrors = (req, _res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const details = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));

    logger.warn('Validation failed for log request', {
      path: req.originalUrl,
      errors: details,
    });

    return next(new AppError(ERROR_MESSAGES.VALIDATION_ERROR, 400, details));
  }

  return next();
};

const requireAdmin = (req, _res, next) => {
  if (!req.user || req.user.role !== USER_ROLES.ADMIN) {
    logger.warn('Admin access denied', {
      userId: req.user ? req.user.id : null,
      role: req.user ? req.user.role : null,
      path: req.originalUrl,
    });
    return next(new AppError(ERROR_MESSAGES.FORBIDDEN, 403));
  }
  return next();
};

const eventValidation = [
  body('event_type')
    .notEmpty()
    .withMessage('event_type is required')
    .isString()
    .withMessage('event_type must be a string')
    .isIn(LogIngestionService.ALLOWED_EVENT_TYPES)
    .withMessage(`event_type must be one of ${LogIngestionService.ALLOWED_EVENT_TYPES.join(', ')}`),
  body('timestamp')
    .notEmpty()
    .withMessage('timestamp is required')
    .isISO8601()
    .withMessage('timestamp must be a valid ISO8601 date string'),
  body('details')
    .optional()
    .isObject()
    .withMessage('details must be a JSON object'),
  body('correlation_id')
    .optional()
    .isString()
    .withMessage('correlation_id must be a string')
    .trim(),
  body('user_id')
    .optional()
    .isString()
    .withMessage('user_id must be a string')
    .trim(),
];

const auditQueryValidation = [
  query('user_id')
    .optional()
    .isString()
    .withMessage('user_id must be a string')
    .trim(),
  query('action')
    .optional()
    .isString()
    .withMessage('action must be a string')
    .trim(),
  query('status')
    .optional()
    .isString()
    .withMessage('status must be a string')
    .isIn(['success', 'failure'])
    .withMessage('status must be one of: success, failure'),
  query('ip_address')
    .optional()
    .isString()
    .withMessage('ip_address must be a string')
    .trim(),
  query('start_time')
    .optional()
    .isISO8601()
    .withMessage('start_time must be a valid ISO8601 date'),
  query('end_time')
    .optional()
    .isISO8601()
    .withMessage('end_time must be a valid ISO8601 date'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  query('page_size')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('Page size must be between 1 and 500')
    .toInt(),
];

const exportValidation = [
  query('format')
    .optional()
    .isString()
    .withMessage('format must be a string')
    .isIn(['json', 'csv'])
    .withMessage('format must be one of: json, csv'),
  query('user_id')
    .optional()
    .isString()
    .withMessage('user_id must be a string')
    .trim(),
  query('action')
    .optional()
    .isString()
    .withMessage('action must be a string')
    .trim(),
  query('status')
    .optional()
    .isString()
    .withMessage('status must be a string')
    .isIn(['success', 'failure'])
    .withMessage('status must be one of: success, failure'),
  query('start_time')
    .optional()
    .isISO8601()
    .withMessage('start_time must be a valid ISO8601 date'),
  query('end_time')
    .optional()
    .isISO8601()
    .withMessage('end_time must be a valid ISO8601 date'),
];

// POST /api/logs/event
router.post('/event', authenticate, eventValidation, handleValidationErrors, async (req, res, next) => {
  try {
    const { event_type, timestamp, details, correlation_id, user_id } = req.body;

    logger.info('Log route: event ingestion request received', {
      event_type,
      userId: req.user.id,
    });

    const event = {
      event_type,
      timestamp,
      details: details || {},
      correlation_id: correlation_id || null,
      user_id: user_id || req.user.id,
    };

    const context = {
      user_id: req.user.id,
      ip_address: req.ip || req.connection?.remoteAddress || null,
    };

    const result = await LogIngestionService.ingestEvent(event, context);

    logger.info('Log route: event ingested successfully', {
      event_type,
      userId: req.user.id,
      logId: result.log_id,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/logs/audit
router.get('/audit', authenticate, requireAdmin, auditQueryValidation, handleValidationErrors, async (req, res, next) => {
  try {
    const {
      user_id,
      action,
      status,
      ip_address,
      start_time,
      end_time,
      page,
      page_size,
    } = req.query;

    logger.info('Log route: audit log query request received', {
      userId: req.user.id,
      filters: { user_id, action, status, start_time, end_time },
      page,
      page_size,
    });

    const filters = {};
    if (user_id) filters.user_id = user_id;
    if (action) filters.action = action;
    if (status) filters.status = status;
    if (ip_address) filters.ip_address = ip_address;
    if (start_time) filters.start_time = start_time;
    if (end_time) filters.end_time = end_time;

    const result = await ComplianceManager.queryAuditLogs(
      filters,
      page || 1,
      page_size || 50
    );

    logger.info('Log route: audit logs retrieved', {
      userId: req.user.id,
      total: result.total,
      returned: result.logs.length,
      page: result.page,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/logs/audit/export
router.get('/audit/export', authenticate, requireAdmin, exportValidation, handleValidationErrors, async (req, res, next) => {
  try {
    const {
      format,
      user_id,
      action,
      status,
      start_time,
      end_time,
    } = req.query;

    const exportFormat = format || 'json';

    logger.info('Log route: audit log export request received', {
      userId: req.user.id,
      format: exportFormat,
      filters: { user_id, action, status, start_time, end_time },
    });

    const filters = {};
    if (user_id) filters.user_id = user_id;
    if (action) filters.action = action;
    if (status) filters.status = status;
    if (start_time) filters.start_time = start_time;
    if (end_time) filters.end_time = end_time;

    const result = await ComplianceManager.exportAuditLogs(filters, exportFormat);

    logger.info('Log route: audit logs exported', {
      userId: req.user.id,
      format: exportFormat,
      count: result.count,
    });

    if (exportFormat === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit_logs.csv"');
      return res.status(200).send(result.data);
    }

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/logs/audit/:id
router.get('/audit/:id', authenticate, requireAdmin, [
  param('id')
    .notEmpty()
    .withMessage('Log ID is required')
    .isUUID()
    .withMessage('Log ID must be a valid UUID'),
], handleValidationErrors, async (req, res, next) => {
  try {
    const { id } = req.params;

    logger.info('Log route: audit log detail request received', {
      logId: id,
      userId: req.user.id,
    });

    const log = await ComplianceManager.getAuditLogById(id);

    logger.info('Log route: audit log detail retrieved', {
      logId: id,
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      data: log,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;