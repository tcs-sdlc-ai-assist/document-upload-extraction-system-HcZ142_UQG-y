const express = require('express');
const MonitoringService = require('../services/MonitoringService');
const { authenticate } = require('../middleware/authMiddleware');
const { AppError } = require('../middleware/errorHandler');
const { ERROR_MESSAGES, USER_ROLES } = require('../config/constants');
const logger = require('../utils/logger');

const router = express.Router();

const requireAdmin = (req, _res, next) => {
  if (!req.user || req.user.role !== USER_ROLES.ADMIN) {
    logger.warn('Admin access denied for monitoring endpoint', {
      userId: req.user ? req.user.id : null,
      role: req.user ? req.user.role : null,
      path: req.originalUrl,
    });
    return next(new AppError(ERROR_MESSAGES.FORBIDDEN, 403));
  }
  return next();
};

// GET /api/monitoring/health
router.get('/health', async (_req, res, next) => {
  try {
    logger.info('Monitoring route: health check request received');

    const healthStatus = await MonitoringService.getHealthStatus();

    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;

    logger.info('Monitoring route: health check completed', {
      status: healthStatus.status,
      statusCode,
    });

    return res.status(statusCode).json({
      success: healthStatus.status === 'healthy',
      data: healthStatus,
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/monitoring/metrics
router.get('/metrics', authenticate, requireAdmin, async (req, res, next) => {
  try {
    logger.info('Monitoring route: metrics request received', {
      userId: req.user.id,
    });

    const acceptHeader = req.headers.accept || '';

    if (acceptHeader.includes('text/plain')) {
      const prometheusMetrics = MonitoringService.getMetricsPrometheus();

      logger.info('Monitoring route: Prometheus metrics retrieved', {
        userId: req.user.id,
      });

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(prometheusMetrics);
    }

    const metrics = MonitoringService.getMetrics();

    logger.info('Monitoring route: metrics retrieved', {
      userId: req.user.id,
      requestTotal: metrics.requests ? metrics.requests.total : 0,
      errorTotal: metrics.errors ? metrics.errors.total : 0,
    });

    return res.status(200).json({
      success: true,
      data: metrics,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;