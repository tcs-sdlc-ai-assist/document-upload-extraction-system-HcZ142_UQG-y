const { pool } = require('../config/db');
const LogIngestionService = require('./LogIngestionService');
const logger = require('../utils/logger');

const startTime = Date.now();

let requestCountTotal = 0;
let requestCountByMethod = {};
let requestCountByStatus = {};
let extractionTimesMs = [];
let errorCountTotal = 0;
let errorCountByType = {};

const MAX_EXTRACTION_TIMES_STORED = 1000;

const getUptime = () => {
  const uptimeMs = Date.now() - startTime;
  const uptimeSeconds = Math.floor(uptimeMs / 1000);
  return {
    ms: uptimeMs,
    seconds: uptimeSeconds,
    human: formatUptime(uptimeSeconds),
  };
};

const formatUptime = (totalSeconds) => {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(' ');
};

const getMemoryUsage = () => {
  const mem = process.memoryUsage();
  return {
    rss_bytes: mem.rss,
    heap_total_bytes: mem.heapTotal,
    heap_used_bytes: mem.heapUsed,
    external_bytes: mem.external,
    rss_mb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
    heap_total_mb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
    heap_used_mb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
    external_mb: Math.round((mem.external / 1024 / 1024) * 100) / 100,
  };
};

const checkDatabaseConnectivity = async () => {
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    const latencyMs = Date.now() - start;

    return {
      connected: true,
      latency_ms: latencyMs,
    };
  } catch (err) {
    logger.error('Database health check failed', { error: err.message });
    return {
      connected: false,
      latency_ms: null,
      error: err.message,
    };
  }
};

const getHealthStatus = async () => {
  logger.debug('Performing health status check');

  const database = await checkDatabaseConnectivity();
  const uptime = getUptime();
  const memory = getMemoryUsage();

  const isHealthy = database.connected;

  const status = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime,
    database,
    memory,
  };

  if (isHealthy) {
    logger.debug('Health check passed', { status: status.status });
  } else {
    logger.warn('Health check failed', { status: status.status, database });
  }

  return status;
};

const getMetrics = () => {
  logger.debug('Collecting metrics');

  const logIngestionMetrics = LogIngestionService.getMetrics();

  const extractionStats = computeExtractionStats();

  const metrics = {
    timestamp: new Date().toISOString(),
    uptime_seconds: getUptime().seconds,
    requests: {
      total: requestCountTotal,
      by_method: { ...requestCountByMethod },
      by_status: { ...requestCountByStatus },
    },
    errors: {
      total: errorCountTotal,
      by_type: { ...errorCountByType },
    },
    extraction: extractionStats,
    log_ingestion: logIngestionMetrics,
    memory: getMemoryUsage(),
  };

  logger.debug('Metrics collected', {
    request_total: requestCountTotal,
    error_total: errorCountTotal,
  });

  return metrics;
};

const getMetricsPrometheus = () => {
  logger.debug('Collecting Prometheus-style metrics');

  const logIngestionMetrics = LogIngestionService.getMetrics();
  const extractionStats = computeExtractionStats();
  const memory = getMemoryUsage();
  const uptime = getUptime();

  const lines = [];

  lines.push(`# HELP uptime_seconds Application uptime in seconds`);
  lines.push(`# TYPE uptime_seconds gauge`);
  lines.push(`uptime_seconds ${uptime.seconds}`);

  lines.push(`# HELP request_count_total Total number of HTTP requests`);
  lines.push(`# TYPE request_count_total counter`);
  lines.push(`request_count_total ${requestCountTotal}`);

  for (const [method, count] of Object.entries(requestCountByMethod)) {
    lines.push(`request_count_by_method{method="${method}"} ${count}`);
  }

  for (const [status, count] of Object.entries(requestCountByStatus)) {
    lines.push(`request_count_by_status{status="${status}"} ${count}`);
  }

  lines.push(`# HELP error_count_total Total number of errors`);
  lines.push(`# TYPE error_count_total counter`);
  lines.push(`error_count_total ${errorCountTotal}`);

  lines.push(`# HELP extraction_avg_ms Average extraction time in milliseconds`);
  lines.push(`# TYPE extraction_avg_ms gauge`);
  lines.push(`extraction_avg_ms ${extractionStats.avg_ms}`);

  lines.push(`# HELP extraction_count Total number of extractions recorded`);
  lines.push(`# TYPE extraction_count counter`);
  lines.push(`extraction_count ${extractionStats.count}`);

  lines.push(`# HELP log_ingest_success_total Total successful log ingestions`);
  lines.push(`# TYPE log_ingest_success_total counter`);
  lines.push(`log_ingest_success_total ${logIngestionMetrics.log_ingest_success_total}`);

  lines.push(`# HELP log_ingest_failure_total Total failed log ingestions`);
  lines.push(`# TYPE log_ingest_failure_total counter`);
  lines.push(`log_ingest_failure_total ${logIngestionMetrics.log_ingest_failure_total}`);

  lines.push(`# HELP log_buffer_size Current log buffer size`);
  lines.push(`# TYPE log_buffer_size gauge`);
  lines.push(`log_buffer_size ${logIngestionMetrics.log_buffer_size}`);

  lines.push(`# HELP circuit_breaker_open Whether the circuit breaker is open`);
  lines.push(`# TYPE circuit_breaker_open gauge`);
  lines.push(`circuit_breaker_open ${logIngestionMetrics.circuit_breaker_open ? 1 : 0}`);

  lines.push(`# HELP memory_rss_bytes Resident set size in bytes`);
  lines.push(`# TYPE memory_rss_bytes gauge`);
  lines.push(`memory_rss_bytes ${memory.rss_bytes}`);

  lines.push(`# HELP memory_heap_used_bytes Heap used in bytes`);
  lines.push(`# TYPE memory_heap_used_bytes gauge`);
  lines.push(`memory_heap_used_bytes ${memory.heap_used_bytes}`);

  lines.push(`# HELP memory_heap_total_bytes Heap total in bytes`);
  lines.push(`# TYPE memory_heap_total_bytes gauge`);
  lines.push(`memory_heap_total_bytes ${memory.heap_total_bytes}`);

  return lines.join('\n');
};

const computeExtractionStats = () => {
  if (extractionTimesMs.length === 0) {
    return {
      count: 0,
      avg_ms: 0,
      min_ms: 0,
      max_ms: 0,
      p50_ms: 0,
      p95_ms: 0,
      p99_ms: 0,
    };
  }

  const sorted = [...extractionTimesMs].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const avg = Math.round(sum / count);
  const min = sorted[0];
  const max = sorted[count - 1];
  const p50 = sorted[Math.floor(count * 0.5)];
  const p95 = sorted[Math.floor(count * 0.95)];
  const p99 = sorted[Math.floor(count * 0.99)];

  return {
    count,
    avg_ms: avg,
    min_ms: min,
    max_ms: max,
    p50_ms: p50,
    p95_ms: p95,
    p99_ms: p99,
  };
};

const recordRequest = (method, statusCode) => {
  requestCountTotal++;

  const methodUpper = (method || 'UNKNOWN').toUpperCase();
  requestCountByMethod[methodUpper] = (requestCountByMethod[methodUpper] || 0) + 1;

  const statusGroup = String(statusCode || 0);
  requestCountByStatus[statusGroup] = (requestCountByStatus[statusGroup] || 0) + 1;
};

const recordError = (errorType) => {
  errorCountTotal++;

  const type = errorType || 'unknown';
  errorCountByType[type] = (errorCountByType[type] || 0) + 1;
};

const recordExtractionTime = (durationMs) => {
  if (typeof durationMs !== 'number' || durationMs < 0) {
    logger.warn('Invalid extraction time recorded', { durationMs });
    return;
  }

  extractionTimesMs.push(Math.round(durationMs));

  if (extractionTimesMs.length > MAX_EXTRACTION_TIMES_STORED) {
    extractionTimesMs = extractionTimesMs.slice(-MAX_EXTRACTION_TIMES_STORED);
  }
};

const resetMetrics = () => {
  logger.info('Resetting monitoring metrics');

  requestCountTotal = 0;
  requestCountByMethod = {};
  requestCountByStatus = {};
  extractionTimesMs = [];
  errorCountTotal = 0;
  errorCountByType = {};
};

module.exports = {
  getHealthStatus,
  getMetrics,
  getMetricsPrometheus,
  recordRequest,
  recordError,
  recordExtractionTime,
  resetMetrics,
};