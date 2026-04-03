const logger = require('../utils/logger');
const { ERROR_MESSAGES } = require('../config/constants');

class AppError extends Error {
  constructor(message, statusCode, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational || false;

  const logContext = {
    statusCode,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userId: req.user ? req.user.id : null,
  };

  if (statusCode >= 500) {
    logger.error(err.message, {
      ...logContext,
      stack: err.stack,
    });
  } else {
    logger.warn(err.message, logContext);
  }

  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: {
        message: ERROR_MESSAGES.USER_ALREADY_EXISTS,
        statusCode: 409,
      },
    });
  }

  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      error: {
        message: ERROR_MESSAGES.VALIDATION_ERROR,
        statusCode: 400,
      },
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: {
        message: ERROR_MESSAGES.VALIDATION_ERROR,
        statusCode: 400,
      },
    });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: {
        message: ERROR_MESSAGES.FILE_TOO_LARGE,
        statusCode: 413,
      },
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      error: {
        message: ERROR_MESSAGES.FILE_REQUIRED,
        statusCode: 400,
      },
    });
  }

  const message = isOperational
    ? err.message
    : ERROR_MESSAGES.INTERNAL_SERVER_ERROR;

  const response = {
    success: false,
    error: {
      message,
      statusCode,
    },
  };

  if (isOperational && err.details) {
    response.error.details = err.details;
  }

  return res.status(statusCode).json(response);
};

const notFoundHandler = (req, res, _next) => {
  logger.warn('Route not found', {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
  });

  return res.status(404).json({
    success: false,
    error: {
      message: ERROR_MESSAGES.NOT_FOUND,
      statusCode: 404,
    },
  });
};

module.exports = {
  AppError,
  errorHandler,
  notFoundHandler,
};