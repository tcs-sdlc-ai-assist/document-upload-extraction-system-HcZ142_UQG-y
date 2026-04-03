const express = require('express');
const { body, validationResult } = require('express-validator');
const AuthService = require('../services/AuthService');
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

    logger.warn('Validation failed for auth request', {
      path: req.originalUrl,
      errors: details,
    });

    return next(new AppError(ERROR_MESSAGES.VALIDATION_ERROR, 400, details));
  }

  return next();
};

const loginValidation = [
  body('username')
    .notEmpty()
    .withMessage('Username is required')
    .isString()
    .withMessage('Username must be a string')
    .trim()
    .isLength({ max: 64 })
    .withMessage('Username must be at most 64 characters'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isString()
    .withMessage('Password must be a string')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters'),
];

const refreshValidation = [
  body('refresh_token')
    .notEmpty()
    .withMessage('Refresh token is required')
    .isString()
    .withMessage('Refresh token must be a string'),
];

const logoutValidation = [
  body('refresh_token')
    .notEmpty()
    .withMessage('Refresh token is required')
    .isString()
    .withMessage('Refresh token must be a string'),
];

// POST /api/auth/login
router.post('/login', loginValidation, handleValidationErrors, async (req, res, next) => {
  try {
    const { username, password } = req.body;

    logger.info('Auth route: login request received', { username });

    const result = await AuthService.login(username, password);

    logger.info('Auth route: login successful', { username, userId: result.user.id });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', logoutValidation, handleValidationErrors, async (req, res, next) => {
  try {
    const { refresh_token } = req.body;

    logger.info('Auth route: logout request received');

    const result = await AuthService.logout(refresh_token);

    logger.info('Auth route: logout successful');

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/refresh
router.post('/refresh', refreshValidation, handleValidationErrors, async (req, res, next) => {
  try {
    const { refresh_token } = req.body;

    logger.info('Auth route: token refresh request received');

    const result = await AuthService.refreshToken(refresh_token);

    logger.info('Auth route: token refresh successful');

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/auth/session
router.get('/session', authenticate, async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.split(' ')[1] : null;

    logger.info('Auth route: session check request received', { userId: req.user.id });

    const result = await AuthService.getSession(token);

    logger.info('Auth route: session check successful', { userId: req.user.id });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;