const express = require('express');
const { query, param, validationResult } = require('express-validator');
const DocumentUploadService = require('../services/DocumentUploadService');
const { upload } = require('../config/uploadConfig');
const { authenticate } = require('../middleware/authMiddleware');
const { AppError } = require('../middleware/errorHandler');
const { ERROR_MESSAGES } = require('../config/constants');
const logger = require('../utils/logger');

const router = express.Router();

const handleValidationErrors = (req, _res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const details = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));

    logger.warn('Validation failed for document request', {
      path: req.originalUrl,
      errors: details,
    });

    return next(new AppError(ERROR_MESSAGES.VALIDATION_ERROR, 400, details));
  }

  return next();
};

const uploadIdValidation = [
  param('uploadId')
    .notEmpty()
    .withMessage('Upload ID is required')
    .isUUID()
    .withMessage('Upload ID must be a valid UUID'),
];

const listValidation = [
  query('status')
    .optional()
    .isString()
    .withMessage('Status must be a string')
    .isIn(['pending', 'processing', 'completed', 'failed'])
    .withMessage('Status must be one of: pending, processing, completed, failed'),
  query('filetype')
    .optional()
    .isString()
    .withMessage('Filetype must be a string')
    .trim(),
  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('start_date must be a valid ISO8601 date'),
  query('end_date')
    .optional()
    .isISO8601()
    .withMessage('end_date must be a valid ISO8601 date'),
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
  query('sort_by')
    .optional()
    .isString()
    .withMessage('sort_by must be a string')
    .isIn(['created_at', 'updated_at', 'filename', 'filetype', 'size', 'status'])
    .withMessage('sort_by must be one of: created_at, updated_at, filename, filetype, size, status'),
  query('sort_order')
    .optional()
    .isString()
    .withMessage('sort_order must be a string')
    .isIn(['ASC', 'DESC', 'asc', 'desc'])
    .withMessage('sort_order must be ASC or DESC'),
];

// POST /api/documents/upload
router.post('/upload', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    const userId = req.user.id;

    logger.info('Document route: upload request received', {
      userId,
      filename: file ? file.originalname : null,
      size: file ? file.size : null,
      mimetype: file ? file.mimetype : null,
    });

    if (!file) {
      logger.warn('Document route: no file provided in upload request', { userId });
      return next(new AppError(ERROR_MESSAGES.FILE_REQUIRED, 400));
    }

    const result = await DocumentUploadService.uploadDocument(file, userId);

    logger.info('Document route: upload successful', {
      userId,
      uploadId: result.upload_id,
      status: result.status,
    });

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/documents/status/:uploadId
router.get('/status/:uploadId', authenticate, uploadIdValidation, handleValidationErrors, async (req, res, next) => {
  try {
    const { uploadId } = req.params;
    const userId = req.user.id;

    logger.info('Document route: status request received', { uploadId, userId });

    const result = await DocumentUploadService.getStatus(uploadId, userId);

    logger.info('Document route: status retrieved', {
      uploadId,
      userId,
      status: result.status,
      progress: result.progress,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/documents/result/:uploadId
router.get('/result/:uploadId', authenticate, uploadIdValidation, handleValidationErrors, async (req, res, next) => {
  try {
    const { uploadId } = req.params;
    const userId = req.user.id;

    logger.info('Document route: result request received', { uploadId, userId });

    const result = await DocumentUploadService.getResult(uploadId, userId);

    logger.info('Document route: result retrieved', {
      uploadId,
      userId,
      textLength: result.extracted_text ? result.extracted_text.length : 0,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/documents/list
router.get('/list', authenticate, listValidation, handleValidationErrors, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      status,
      filetype,
      start_date,
      end_date,
      page,
      page_size,
      sort_by,
      sort_order,
    } = req.query;

    logger.info('Document route: list request received', {
      userId,
      status,
      filetype,
      page,
      page_size,
    });

    const filters = {};
    if (status) filters.status = status;
    if (filetype) filters.filetype = filetype;
    if (start_date) filters.start_date = start_date;
    if (end_date) filters.end_date = end_date;
    if (page) filters.page = page;
    if (page_size) filters.page_size = page_size;
    if (sort_by) filters.sort_by = sort_by;
    if (sort_order) filters.sort_order = sort_order;

    const result = await DocumentUploadService.listUploads(userId, filters);

    logger.info('Document route: list retrieved', {
      userId,
      total: result.total,
      returned: result.uploads.length,
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

// DELETE /api/documents/:uploadId
router.delete('/:uploadId', authenticate, uploadIdValidation, handleValidationErrors, async (req, res, next) => {
  try {
    const { uploadId } = req.params;
    const userId = req.user.id;

    logger.info('Document route: delete request received', { uploadId, userId });

    const result = await DocumentUploadService.deleteDocument(uploadId, userId);

    logger.info('Document route: document deleted', { uploadId, userId });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/documents/stats
router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;

    logger.info('Document route: stats request received', { userId });

    const result = await DocumentUploadService.getUploadStats(userId);

    logger.info('Document route: stats retrieved', { userId, total: result.total });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;