const LogIngestionService = require('../services/LogIngestionService');
const MonitoringService = require('../services/MonitoringService');
const logger = require('../utils/logger');

const mapMethodToEventType = (method, path) => {
  if (path.startsWith('/api/auth')) {
    return 'AUTH';
  }

  if (path.startsWith('/api/documents') || path.startsWith('/api/uploads')) {
    if (method === 'POST') {
      return 'UPLOAD';
    }
    return 'EXTRACTION';
  }

  if (path.startsWith('/api/monitoring') || path.startsWith('/api/logs')) {
    return 'SYSTEM';
  }

  return 'SYSTEM';
};

const auditMiddleware = (req, res, next) => {
  const startTime = Date.now();
  const originalEnd = res.end;

  res.end = function (chunk, encoding) {
    res.end = originalEnd;
    res.end(chunk, encoding);

    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const method = req.method;
    const path = req.originalUrl || req.url;
    const userId = req.user ? req.user.id : null;
    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    MonitoringService.recordRequest(method, statusCode);

    if (statusCode >= 500) {
      MonitoringService.recordError(`${statusCode}_${method}_${path}`);
    }

    const eventType = mapMethodToEventType(method, path);
    const status = statusCode >= 400 ? 'failure' : 'success';

    const event = {
      event_type: eventType,
      timestamp: new Date().toISOString(),
      user_id: userId,
      details: {
        method,
        path,
        status_code: statusCode,
        response_time_ms: duration,
        user_agent: req.headers['user-agent'] || null,
      },
      status,
      ip_address: ipAddress,
    };

    LogIngestionService.ingestEvent(event, {
      user_id: userId,
      ip_address: ipAddress,
    }).catch((err) => {
      logger.warn('Failed to ingest audit log event', {
        error: err.message,
        method,
        path,
        statusCode,
        userId,
      });
    });

    logger.debug('Request audited', {
      method,
      path,
      statusCode,
      duration: `${duration}ms`,
      userId,
      ip: ipAddress,
    });
  };

  next();
};

module.exports = {
  auditMiddleware,
};