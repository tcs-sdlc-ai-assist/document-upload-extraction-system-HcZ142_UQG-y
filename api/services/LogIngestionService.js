const AuditLogRepository = require('../repositories/AuditLogRepository');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const { AUDIT_ACTIONS, AUDIT_STATUS, ERROR_MESSAGES } = require('../config/constants');

const ALLOWED_EVENT_TYPES = [
  'UPLOAD',
  'VALIDATION',
  'EXTRACTION',
  'ERROR',
  'AUTH',
  'SYSTEM',
];

const EVENT_TYPE_TO_ACTION_MAP = {
  UPLOAD: AUDIT_ACTIONS.DOCUMENT_UPLOAD,
  VALIDATION: 'document.validation',
  EXTRACTION: AUDIT_ACTIONS.EXTRACTION_START,
  ERROR: 'system.error',
  AUTH: AUDIT_ACTIONS.USER_LOGIN,
  SYSTEM: 'system.event',
};

const BUFFER_SIZE = parseInt(process.env.LOG_BUFFER_SIZE, 10) || 50;
const FLUSH_INTERVAL_MS = parseInt(process.env.LOG_FLUSH_INTERVAL_MS, 10) || 5000;

let logBuffer = [];
let flushTimer = null;
let ingestSuccessTotal = 0;
let ingestFailureTotal = 0;
let circuitBreakerOpen = false;
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 5;
const CIRCUIT_BREAKER_RESET_MS = 60000;
let circuitBreakerTimer = null;

const validateEvent = (event) => {
  const errors = [];

  if (!event) {
    errors.push('Event payload is required');
    return errors;
  }

  if (!event.event_type) {
    errors.push('event_type is required');
  } else if (!ALLOWED_EVENT_TYPES.includes(event.event_type)) {
    errors.push(
      `event_type must be one of ${ALLOWED_EVENT_TYPES.join(', ')}`
    );
  }

  if (!event.timestamp) {
    errors.push('timestamp is required');
  } else {
    const parsed = new Date(event.timestamp);
    if (isNaN(parsed.getTime())) {
      errors.push('timestamp must be a valid ISO8601 date string');
    }
  }

  if (event.details !== undefined && event.details !== null && typeof event.details !== 'object') {
    errors.push('details must be a JSON object');
  }

  if (event.correlation_id !== undefined && event.correlation_id !== null && typeof event.correlation_id !== 'string') {
    errors.push('correlation_id must be a string');
  }

  return errors;
};

const enrichEvent = (event, context = {}) => {
  const enriched = {
    user_id: context.user_id || event.user_id || null,
    action: event.action || EVENT_TYPE_TO_ACTION_MAP[event.event_type] || event.event_type.toLowerCase(),
    details: {
      ...(event.details || {}),
      event_type: event.event_type,
    },
    status: event.status || AUDIT_STATUS.SUCCESS,
    ip_address: context.ip_address || event.ip_address || null,
  };

  if (event.correlation_id) {
    enriched.details.correlation_id = event.correlation_id;
  }

  if (event.timestamp) {
    enriched.details.event_timestamp = event.timestamp;
  }

  return enriched;
};

const flushBuffer = async () => {
  if (logBuffer.length === 0) {
    return;
  }

  if (circuitBreakerOpen) {
    logger.warn('Circuit breaker is open, skipping buffer flush', {
      bufferedCount: logBuffer.length,
    });
    return;
  }

  const entriesToFlush = [...logBuffer];
  logBuffer = [];

  logger.info('Flushing log buffer to database', { count: entriesToFlush.length });

  try {
    await AuditLogRepository.saveBatch(entriesToFlush);
    consecutiveFailures = 0;
    ingestSuccessTotal += entriesToFlush.length;
    logger.info('Log buffer flushed successfully', { count: entriesToFlush.length });
  } catch (err) {
    consecutiveFailures++;
    ingestFailureTotal += entriesToFlush.length;

    logger.error('Failed to flush log buffer to database', {
      error: err.message,
      count: entriesToFlush.length,
      consecutiveFailures,
    });

    // Put entries back into buffer
    logBuffer = [...entriesToFlush, ...logBuffer];

    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      openCircuitBreaker();
    }
  }
};

const openCircuitBreaker = () => {
  circuitBreakerOpen = true;
  logger.error('Circuit breaker opened due to repeated DB failures', {
    consecutiveFailures,
  });

  if (circuitBreakerTimer) {
    clearTimeout(circuitBreakerTimer);
  }

  circuitBreakerTimer = setTimeout(() => {
    circuitBreakerOpen = false;
    consecutiveFailures = 0;
    logger.info('Circuit breaker reset, resuming log ingestion');
    circuitBreakerTimer = null;
  }, CIRCUIT_BREAKER_RESET_MS);
};

const startFlushTimer = () => {
  if (flushTimer) {
    return;
  }

  flushTimer = setInterval(async () => {
    try {
      await flushBuffer();
    } catch (err) {
      logger.error('Error during scheduled buffer flush', { error: err.message });
    }
  }, FLUSH_INTERVAL_MS);
};

const stopFlushTimer = () => {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }

  if (circuitBreakerTimer) {
    clearTimeout(circuitBreakerTimer);
    circuitBreakerTimer = null;
  }
};

const ingestEvent = async (event, context = {}) => {
  logger.debug('Ingesting log event', {
    event_type: event ? event.event_type : undefined,
    user_id: context.user_id || (event ? event.user_id : undefined),
  });

  const validationErrors = validateEvent(event);

  if (validationErrors.length > 0) {
    logger.warn('Log event validation failed', { errors: validationErrors });
    ingestFailureTotal++;
    throw new AppError(ERROR_MESSAGES.VALIDATION_ERROR, 400, validationErrors);
  }

  if (circuitBreakerOpen && logBuffer.length >= BUFFER_SIZE * 10) {
    logger.error('Log buffer full and circuit breaker open, rejecting event');
    ingestFailureTotal++;
    throw new AppError('Log ingestion temporarily unavailable', 503);
  }

  const enrichedEvent = enrichEvent(event, context);

  logBuffer.push(enrichedEvent);

  startFlushTimer();

  if (logBuffer.length >= BUFFER_SIZE) {
    try {
      await flushBuffer();
    } catch (err) {
      logger.error('Error flushing buffer after threshold reached', { error: err.message });
    }
  }

  ingestSuccessTotal++;

  return {
    status: 'ok',
    log_id: event.correlation_id || null,
  };
};

const ingestEventDirect = async (event, context = {}) => {
  logger.debug('Ingesting log event directly', {
    event_type: event ? event.event_type : undefined,
    user_id: context.user_id || (event ? event.user_id : undefined),
  });

  const validationErrors = validateEvent(event);

  if (validationErrors.length > 0) {
    logger.warn('Log event validation failed', { errors: validationErrors });
    ingestFailureTotal++;
    throw new AppError(ERROR_MESSAGES.VALIDATION_ERROR, 400, validationErrors);
  }

  const enrichedEvent = enrichEvent(event, context);

  try {
    const savedLog = await AuditLogRepository.saveLog(enrichedEvent);
    ingestSuccessTotal++;
    consecutiveFailures = 0;

    logger.info('Log event persisted directly', { logId: savedLog.id });

    return {
      status: 'ok',
      log_id: savedLog.id,
    };
  } catch (err) {
    consecutiveFailures++;
    ingestFailureTotal++;

    logger.error('Failed to persist log event directly', {
      error: err.message,
      consecutiveFailures,
    });

    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      openCircuitBreaker();
    }

    throw new AppError('Failed to persist log event', 500);
  }
};

const getMetrics = () => {
  return {
    log_ingest_success_total: ingestSuccessTotal,
    log_ingest_failure_total: ingestFailureTotal,
    log_buffer_size: logBuffer.length,
    circuit_breaker_open: circuitBreakerOpen,
    consecutive_failures: consecutiveFailures,
  };
};

const getBufferSize = () => {
  return logBuffer.length;
};

const isCircuitBreakerOpen = () => {
  return circuitBreakerOpen;
};

const shutdown = async () => {
  logger.info('Shutting down LogIngestionService');
  stopFlushTimer();

  if (logBuffer.length > 0) {
    logger.info('Flushing remaining buffer on shutdown', { count: logBuffer.length });
    try {
      await flushBuffer();
    } catch (err) {
      logger.error('Failed to flush buffer on shutdown', { error: err.message });
    }
  }

  logger.info('LogIngestionService shutdown complete');
};

module.exports = {
  ingestEvent,
  ingestEventDirect,
  flushBuffer,
  getMetrics,
  getBufferSize,
  isCircuitBreakerOpen,
  validateEvent,
  shutdown,
  startFlushTimer,
  stopFlushTimer,
  ALLOWED_EVENT_TYPES,
};