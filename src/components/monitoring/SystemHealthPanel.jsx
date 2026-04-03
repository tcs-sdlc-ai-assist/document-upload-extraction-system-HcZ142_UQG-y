import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import ErrorMessage from '../common/ErrorMessage';
import LoadingSpinner from '../common/LoadingSpinner';
import apiClient from '../../services/apiClient';
import theme from '../../config/theme';

const DEFAULT_REFRESH_INTERVAL_MS = 30000;
const MIN_REFRESH_INTERVAL_MS = 5000;

const HEALTH_STATUS_CONFIG = {
  healthy: {
    label: 'Healthy',
    color: theme.colors.success[700],
    background: theme.colors.success[50],
    border: `1px solid ${theme.colors.success[200]}`,
    icon: '✓',
    badgeBg: theme.components.badge.completed.background,
    badgeColor: theme.components.badge.completed.color,
  },
  unhealthy: {
    label: 'Unhealthy',
    color: theme.colors.error[700],
    background: theme.colors.error[50],
    border: `1px solid ${theme.colors.error[200]}`,
    icon: '✕',
    badgeBg: theme.components.badge.failed.background,
    badgeColor: theme.components.badge.failed.color,
  },
  unknown: {
    label: 'Unknown',
    color: theme.colors.neutral[600],
    background: theme.colors.neutral[50],
    border: `1px solid ${theme.colors.neutral[200]}`,
    icon: '?',
    badgeBg: theme.colors.neutral[100],
    badgeColor: theme.colors.neutral[600],
  },
};

const formatUptime = (seconds) => {
  if (!seconds && seconds !== 0) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
};

const formatBytes = (bytes) => {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatNumber = (num) => {
  if (num === null || num === undefined) return '—';
  return Number(num).toLocaleString();
};

const formatMs = (ms) => {
  if (ms === null || ms === undefined || ms === 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const formatTimestamp = (timestamp) => {
  if (!timestamp) return '—';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '—';
  }
};

const fetchHealthStatus = async () => {
  try {
    const response = await apiClient.get('/monitoring/health');
    if (response.success && response.data) {
      return { success: true, data: response.data };
    }
    return { success: false, message: response.message || 'Failed to fetch health status' };
  } catch (error) {
    return {
      success: false,
      message: error.message || 'Failed to fetch health status',
    };
  }
};

const fetchMetrics = async () => {
  try {
    const response = await apiClient.get('/monitoring/metrics');
    if (response.success && response.data) {
      return { success: true, data: response.data };
    }
    return { success: false, message: response.message || 'Failed to fetch metrics' };
  } catch (error) {
    return {
      success: false,
      message: error.message || 'Failed to fetch metrics',
    };
  }
};

const SystemHealthPanel = ({
  refreshInterval = DEFAULT_REFRESH_INTERVAL_MS,
  showMetrics = true,
  showHealth = true,
  compact = false,
  title = 'System Health',
  subtitle = 'Real-time system monitoring and performance metrics',
  style = {},
}) => {
  const [healthData, setHealthData] = useState(null);
  const [metricsData, setMetricsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const intervalRef = useRef(null);

  const clampedInterval = Math.max(refreshInterval, MIN_REFRESH_INTERVAL_MS);

  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const promises = [];

      if (showHealth) {
        promises.push(fetchHealthStatus());
      } else {
        promises.push(Promise.resolve(null));
      }

      if (showMetrics) {
        promises.push(fetchMetrics());
      } else {
        promises.push(Promise.resolve(null));
      }

      const [healthResult, metricsResult] = await Promise.all(promises);

      if (healthResult && healthResult.success) {
        setHealthData(healthResult.data);
      } else if (healthResult && !healthResult.success) {
        setError(healthResult.message || 'Failed to load health data');
      }

      if (metricsResult && metricsResult.success) {
        setMetricsData(metricsResult.data);
      } else if (metricsResult && !metricsResult.success && !error) {
        setError(metricsResult.message || 'Failed to load metrics data');
      }

      setLastUpdated(new Date().toISOString());
    } catch (err) {
      setError(err.message || 'An unexpected error occurred while loading system health data.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [showHealth, showMetrics, error]);

  useEffect(() => {
    loadData(true);
  }, []);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        loadData(false);
      }, clampedInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefresh, clampedInterval, loadData]);

  const handleRefresh = useCallback(() => {
    loadData(false);
  }, [loadData]);

  const handleRetry = useCallback(() => {
    loadData(true);
  }, [loadData]);

  const handleDismissError = useCallback(() => {
    setError(null);
  }, []);

  const handleToggleAutoRefresh = useCallback(() => {
    setAutoRefresh((prev) => !prev);
  }, []);

  const overallStatus = useMemo(() => {
    if (!healthData) return 'unknown';
    return healthData.status === 'healthy' ? 'healthy' : 'unhealthy';
  }, [healthData]);

  const statusConfig = HEALTH_STATUS_CONFIG[overallStatus] || HEALTH_STATUS_CONFIG.unknown;

  const memoryUsage = useMemo(() => {
    if (healthData && healthData.memory) return healthData.memory;
    if (metricsData && metricsData.memory) return metricsData.memory;
    return null;
  }, [healthData, metricsData]);

  const uptimeData = useMemo(() => {
    if (healthData && healthData.uptime) return healthData.uptime;
    if (metricsData && metricsData.uptime_seconds !== undefined) {
      return { seconds: metricsData.uptime_seconds };
    }
    return null;
  }, [healthData, metricsData]);

  const databaseStatus = useMemo(() => {
    if (healthData && healthData.database) return healthData.database;
    return null;
  }, [healthData]);

  const requestMetrics = useMemo(() => {
    if (metricsData && metricsData.requests) return metricsData.requests;
    return null;
  }, [metricsData]);

  const errorMetrics = useMemo(() => {
    if (metricsData && metricsData.errors) return metricsData.errors;
    return null;
  }, [metricsData]);

  const extractionMetrics = useMemo(() => {
    if (metricsData && metricsData.extraction) return metricsData.extraction;
    return null;
  }, [metricsData]);

  const logIngestionMetrics = useMemo(() => {
    if (metricsData && metricsData.log_ingestion) return metricsData.log_ingestion;
    return null;
  }, [metricsData]);

  const memoryPercent = useMemo(() => {
    if (!memoryUsage) return 0;
    if (memoryUsage.heap_used_bytes && memoryUsage.heap_total_bytes) {
      return Math.round((memoryUsage.heap_used_bytes / memoryUsage.heap_total_bytes) * 100);
    }
    return 0;
  }, [memoryUsage]);

  const renderStatCard = (label, value, icon, color, bgColor, subtitle2 = null) => (
    <div style={{
      background: theme.colors.background.primary,
      border: theme.components.card.border,
      borderRadius: theme.borderRadius.lg,
      padding: compact ? theme.spacing[3] : theme.spacing[4],
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing[3],
      transition: theme.transitions.default,
    }}>
      <div style={{
        width: compact ? '2rem' : '2.5rem',
        height: compact ? '2rem' : '2.5rem',
        borderRadius: theme.borderRadius.lg,
        background: bgColor,
        color: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: compact ? theme.typography.fontSize.xs : theme.typography.fontSize.sm,
        fontWeight: theme.typography.fontWeight.bold,
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: compact ? theme.typography.fontSize.lg : theme.typography.fontSize['2xl'],
          fontWeight: theme.typography.fontWeight.bold,
          color: theme.colors.text.primary,
          margin: 0,
          lineHeight: theme.typography.lineHeight.tight,
          fontFamily: theme.typography.fontFamily.mono,
        }}>
          {value}
        </p>
        <p style={{
          fontSize: theme.typography.fontSize.xs,
          color: theme.colors.text.tertiary,
          margin: 0,
          marginTop: '2px',
        }}>
          {label}
        </p>
        {subtitle2 && (
          <p style={{
            fontSize: theme.typography.fontSize.xs,
            color: theme.colors.text.disabled,
            margin: 0,
            marginTop: '1px',
          }}>
            {subtitle2}
          </p>
        )}
      </div>
    </div>
  );

  const renderDatabaseSection = () => {
    if (!databaseStatus) return null;

    const dbStatusConfig = databaseStatus.connected
      ? HEALTH_STATUS_CONFIG.healthy
      : HEALTH_STATUS_CONFIG.unhealthy;

    return (
      <div style={{
        background: theme.colors.background.primary,
        border: theme.components.card.border,
        borderRadius: theme.borderRadius.lg,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
          borderBottom: `1px solid ${theme.colors.border.light}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.text.primary,
          }}>
            Database
          </span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: theme.spacing[1],
            padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
            borderRadius: theme.borderRadius.full,
            background: dbStatusConfig.badgeBg,
            color: dbStatusConfig.badgeColor,
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.medium,
            lineHeight: 1.2,
          }}>
            <span style={{ lineHeight: 1 }}>{dbStatusConfig.icon}</span>
            {databaseStatus.connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}` }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing[3],
          }}>
            <div>
              <p style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.tertiary,
                margin: 0,
              }}>
                Latency
              </p>
              <p style={{
                fontSize: theme.typography.fontSize.lg,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.text.primary,
                margin: 0,
                fontFamily: theme.typography.fontFamily.mono,
              }}>
                {databaseStatus.latency_ms !== null && databaseStatus.latency_ms !== undefined
                  ? `${databaseStatus.latency_ms}ms`
                  : '—'}
              </p>
            </div>
            <div style={{
              width: '3rem',
              height: '3rem',
              borderRadius: theme.borderRadius.full,
              background: dbStatusConfig.background,
              color: dbStatusConfig.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.bold,
            }}>
              {dbStatusConfig.icon}
            </div>
          </div>
          {databaseStatus.error && (
            <p style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.error[600],
              margin: 0,
              marginTop: theme.spacing[2],
              wordBreak: 'break-word',
            }}>
              {databaseStatus.error}
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderMemorySection = () => {
    if (!memoryUsage) return null;

    const barColor = memoryPercent > 90
      ? theme.colors.error[500]
      : memoryPercent > 70
        ? theme.colors.warning[500]
        : theme.colors.success[500];

    return (
      <div style={{
        background: theme.colors.background.primary,
        border: theme.components.card.border,
        borderRadius: theme.borderRadius.lg,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
          borderBottom: `1px solid ${theme.colors.border.light}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.text.primary,
          }}>
            Memory Usage
          </span>
          <span style={{
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.semibold,
            color: barColor,
            fontFamily: theme.typography.fontFamily.mono,
          }}>
            {memoryPercent}%
          </span>
        </div>
        <div style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}` }}>
          {/* Memory bar */}
          <div style={{
            width: '100%',
            height: theme.components.progressBar.height,
            background: theme.components.progressBar.background,
            borderRadius: theme.components.progressBar.borderRadius,
            overflow: 'hidden',
            marginBottom: theme.spacing[3],
          }}>
            <div style={{
              width: `${memoryPercent}%`,
              height: '100%',
              background: barColor,
              borderRadius: theme.components.progressBar.borderRadius,
              transition: `width ${theme.transitions.default}`,
            }} />
          </div>

          {/* Memory details */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: theme.spacing[3],
          }}>
            <div>
              <p style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.tertiary,
                margin: 0,
              }}>
                Heap Used
              </p>
              <p style={{
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold,
                color: theme.colors.text.primary,
                margin: 0,
                fontFamily: theme.typography.fontFamily.mono,
              }}>
                {memoryUsage.heap_used_mb ? `${memoryUsage.heap_used_mb} MB` : formatBytes(memoryUsage.heap_used_bytes)}
              </p>
            </div>
            <div>
              <p style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.tertiary,
                margin: 0,
              }}>
                Heap Total
              </p>
              <p style={{
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold,
                color: theme.colors.text.primary,
                margin: 0,
                fontFamily: theme.typography.fontFamily.mono,
              }}>
                {memoryUsage.heap_total_mb ? `${memoryUsage.heap_total_mb} MB` : formatBytes(memoryUsage.heap_total_bytes)}
              </p>
            </div>
            <div>
              <p style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.tertiary,
                margin: 0,
              }}>
                RSS
              </p>
              <p style={{
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold,
                color: theme.colors.text.primary,
                margin: 0,
                fontFamily: theme.typography.fontFamily.mono,
              }}>
                {memoryUsage.rss_mb ? `${memoryUsage.rss_mb} MB` : formatBytes(memoryUsage.rss_bytes)}
              </p>
            </div>
            <div>
              <p style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.tertiary,
                margin: 0,
              }}>
                External
              </p>
              <p style={{
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold,
                color: theme.colors.text.primary,
                margin: 0,
                fontFamily: theme.typography.fontFamily.mono,
              }}>
                {memoryUsage.external_mb ? `${memoryUsage.external_mb} MB` : formatBytes(memoryUsage.external_bytes)}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderRequestMetrics = () => {
    if (!requestMetrics) return null;

    const byMethod = requestMetrics.by_method || {};
    const byStatus = requestMetrics.by_status || {};

    const methodEntries = Object.entries(byMethod).sort((a, b) => b[1] - a[1]);
    const statusEntries = Object.entries(byStatus).sort((a, b) => a[0].localeCompare(b[0]));

    return (
      <div style={{
        background: theme.colors.background.primary,
        border: theme.components.card.border,
        borderRadius: theme.borderRadius.lg,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
          borderBottom: `1px solid ${theme.colors.border.light}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.text.primary,
          }}>
            Request Metrics
          </span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
            borderRadius: theme.borderRadius.full,
            background: theme.colors.primary[50],
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.primary[700],
            fontFamily: theme.typography.fontFamily.mono,
          }}>
            {formatNumber(requestMetrics.total)} total
          </span>
        </div>
        <div style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}` }}>
          {/* By Method */}
          {methodEntries.length > 0 && (
            <div style={{ marginBottom: theme.spacing[3] }}>
              <p style={{
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.text.tertiary,
                margin: 0,
                marginBottom: theme.spacing[2],
                textTransform: 'uppercase',
                letterSpacing: theme.typography.letterSpacing.wide,
              }}>
                By Method
              </p>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: theme.spacing[2],
              }}>
                {methodEntries.map(([method, count]) => (
                  <div
                    key={method}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: theme.spacing[1],
                      padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                      background: theme.colors.neutral[100],
                      borderRadius: theme.borderRadius.md,
                    }}
                  >
                    <span style={{
                      fontSize: theme.typography.fontSize.xs,
                      fontWeight: theme.typography.fontWeight.semibold,
                      color: theme.colors.text.secondary,
                      fontFamily: theme.typography.fontFamily.mono,
                    }}>
                      {method}
                    </span>
                    <span style={{
                      fontSize: theme.typography.fontSize.xs,
                      color: theme.colors.text.tertiary,
                      fontFamily: theme.typography.fontFamily.mono,
                    }}>
                      {formatNumber(count)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By Status */}
          {statusEntries.length > 0 && (
            <div>
              <p style={{
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.text.tertiary,
                margin: 0,
                marginBottom: theme.spacing[2],
                textTransform: 'uppercase',
                letterSpacing: theme.typography.letterSpacing.wide,
              }}>
                By Status Code
              </p>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: theme.spacing[2],
              }}>
                {statusEntries.map(([status, count]) => {
                  const statusNum = parseInt(status, 10);
                  let statusColor = theme.colors.text.secondary;
                  let statusBg = theme.colors.neutral[100];

                  if (statusNum >= 200 && statusNum < 300) {
                    statusColor = theme.colors.success[700];
                    statusBg = theme.colors.success[50];
                  } else if (statusNum >= 400 && statusNum < 500) {
                    statusColor = theme.colors.warning[700];
                    statusBg = theme.colors.warning[50];
                  } else if (statusNum >= 500) {
                    statusColor = theme.colors.error[700];
                    statusBg = theme.colors.error[50];
                  }

                  return (
                    <div
                      key={status}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: theme.spacing[1],
                        padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                        background: statusBg,
                        borderRadius: theme.borderRadius.md,
                      }}
                    >
                      <span style={{
                        fontSize: theme.typography.fontSize.xs,
                        fontWeight: theme.typography.fontWeight.semibold,
                        color: statusColor,
                        fontFamily: theme.typography.fontFamily.mono,
                      }}>
                        {status}
                      </span>
                      <span style={{
                        fontSize: theme.typography.fontSize.xs,
                        color: statusColor,
                        fontFamily: theme.typography.fontFamily.mono,
                        opacity: 0.8,
                      }}>
                        {formatNumber(count)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderExtractionMetrics = () => {
    if (!extractionMetrics) return null;

    return (
      <div style={{
        background: theme.colors.background.primary,
        border: theme.components.card.border,
        borderRadius: theme.borderRadius.lg,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
          borderBottom: `1px solid ${theme.colors.border.light}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.text.primary,
          }}>
            Extraction Performance
          </span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
            borderRadius: theme.borderRadius.full,
            background: theme.colors.info[50],
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.info[700],
            fontFamily: theme.typography.fontFamily.mono,
          }}>
            {formatNumber(extractionMetrics.count)} extractions
          </span>
        </div>
        <div style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}` }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: theme.spacing[3],
          }}>
            <div>
              <p style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.tertiary,
                margin: 0,
              }}>
                Average
              </p>
              <p style={{
                fontSize: theme.typography.fontSize.base,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.text.primary,
                margin: 0,
                fontFamily: theme.typography.fontFamily.mono,
              }}>
                {formatMs(extractionMetrics.avg_ms)}
              </p>
            </div>
            <div>
              <p style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.tertiary,
                margin: 0,
              }}>
                Min
              </p>
              <p style={{
                fontSize: theme.typography.fontSize.base,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.success[700],
                margin: 0,
                fontFamily: theme.typography.fontFamily.mono,
              }}>
                {formatMs(extractionMetrics.min_ms)}
              </p>
            </div>
            <div>
              <p style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.tertiary,
                margin: 0,
              }}>
                Max
              </p>
              <p style={{
                fontSize: theme.typography.fontSize.base,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.error[700],
                margin: 0,
                fontFamily: theme.typography.fontFamily.mono,
              }}>
                {formatMs(extractionMetrics.max_ms)}
              </p>
            </div>
          </div>

          {/* Percentiles */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: theme.spacing[3],
            marginTop: theme.spacing[3],
            paddingTop: theme.spacing[3],
            borderTop: `1px solid ${theme.colors.border.light}`,
          }}>
            <div>
              <p style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.tertiary,
                margin: 0,
              }}>
                P50
              </p>
              <p style={{
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold,
                color: theme.colors.text.primary,
                margin: 0,
                fontFamily: theme.typography.fontFamily.mono,
              }}>
                {formatMs(extractionMetrics.p50_ms)}
              </p>
            </div>
            <div>
              <p style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.tertiary,
                margin: 0,
              }}>
                P95
              </p>
              <p style={{
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold,
                color: theme.colors.warning[700],
                margin: 0,
                fontFamily: theme.typography.fontFamily.mono,
              }}>
                {formatMs(extractionMetrics.p95_ms)}
              </p>
            </div>
            <div>
              <p style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.tertiary,
                margin: 0,
              }}>
                P99
              </p>
              <p style={{
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold,
                color: theme.colors.error[700],
                margin: 0,
                fontFamily: theme.typography.fontFamily.mono,
              }}>
                {formatMs(extractionMetrics.p99_ms)}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderErrorMetrics = () => {
    if (!errorMetrics) return null;

    const byType = errorMetrics.by_type || {};
    const typeEntries = Object.entries(byType).sort((a, b) => b[1] - a[1]);

    return (
      <div style={{
        background: theme.colors.background.primary,
        border: errorMetrics.total > 0
          ? `1px solid ${theme.colors.error[200]}`
          : theme.components.card.border,
        borderRadius: theme.borderRadius.lg,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
          borderBottom: `1px solid ${theme.colors.border.light}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: errorMetrics.total > 0 ? theme.colors.error[50] : 'transparent',
        }}>
          <span style={{
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.text.primary,
          }}>
            Errors
          </span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
            borderRadius: theme.borderRadius.full,
            background: errorMetrics.total > 0
              ? theme.components.badge.failed.background
              : theme.components.badge.completed.background,
            color: errorMetrics.total > 0
              ? theme.components.badge.failed.color
              : theme.components.badge.completed.color,
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.semibold,
            fontFamily: theme.typography.fontFamily.mono,
          }}>
            {errorMetrics.total > 0 ? `${formatNumber(errorMetrics.total)} errors` : 'No errors'}
          </span>
        </div>
        {typeEntries.length > 0 && (
          <div style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}` }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: theme.spacing[2],
            }}>
              {typeEntries.slice(0, 8).map(([type, count]) => (
                <div
                  key={type}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: theme.spacing[2],
                  }}
                >
                  <span style={{
                    fontSize: theme.typography.fontSize.xs,
                    color: theme.colors.text.secondary,
                    fontFamily: theme.typography.fontFamily.mono,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    minWidth: 0,
                  }}
                  title={type}
                  >
                    {type}
                  </span>
                  <span style={{
                    fontSize: theme.typography.fontSize.xs,
                    fontWeight: theme.typography.fontWeight.semibold,
                    color: theme.colors.error[600],
                    fontFamily: theme.typography.fontFamily.mono,
                    flexShrink: 0,
                  }}>
                    {formatNumber(count)}
                  </span>
                </div>
              ))}
              {typeEntries.length > 8 && (
                <p style={{
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.text.disabled,
                  margin: 0,
                  textAlign: 'center',
                }}>
                  +{typeEntries.length - 8} more error types
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderLogIngestionMetrics = () => {
    if (!logIngestionMetrics) return null;

    return (
      <div style={{
        background: theme.colors.background.primary,
        border: theme.components.card.border,
        borderRadius: theme.borderRadius.lg,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
          borderBottom: `1px solid ${theme.colors.border.light}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.text.primary,
          }}>
            Log Ingestion
          </span>
          {logIngestionMetrics.circuit_breaker_open && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: theme.spacing[1],
              padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
              borderRadius: theme.borderRadius.full,
              background: theme.components.badge.failed.background,
              color: theme.components.badge.failed.color,
              fontSize: theme.typography.fontSize.xs,
              fontWeight: theme.typography.fontWeight.medium,
              lineHeight: 1.2,
            }}>
              <span style={{ lineHeight: 1 }}>⚠</span>
              Circuit Breaker Open
            </span>
          )}
        </div>
        <div style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}` }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: theme.spacing[3],
          }}>
            <div>
              <p style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.tertiary,
                margin: 0,
              }}>
                Success
              </p>
              <p style={{
                fontSize: theme.typography.fontSize.base,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.success[700],
                margin: 0,
                fontFamily: theme.typography.fontFamily.mono,
              }}>
                {formatNumber(logIngestionMetrics.log_ingest_success_total)}
              </p>
            </div>
            <div>
              <p style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.tertiary,
                margin: 0,
              }}>
                Failures
              </p>
              <p style={{
                fontSize: theme.typography.fontSize.base,
                fontWeight: theme.typography.fontWeight.bold,
                color: logIngestionMetrics.log_ingest_failure_total > 0
                  ? theme.colors.error[700]
                  : theme.colors.text.primary,
                margin: 0,
                fontFamily: theme.typography.fontFamily.mono,
              }}>
                {formatNumber(logIngestionMetrics.log_ingest_failure_total)}
              </p>
            </div>
            <div>
              <p style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.tertiary,
                margin: 0,
              }}>
                Buffer Size
              </p>
              <p style={{
                fontSize: theme.typography.fontSize.base,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.text.primary,
                margin: 0,
                fontFamily: theme.typography.fontFamily.mono,
              }}>
                {formatNumber(logIngestionMetrics.log_buffer_size)}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div style={{
        fontFamily: theme.typography.fontFamily.sans,
        background: theme.components.card.background,
        border: theme.components.card.border,
        borderRadius: theme.components.card.borderRadius,
        padding: theme.spacing[8],
        boxShadow: theme.components.card.shadow,
        ...style,
      }}>
        <LoadingSpinner
          size="lg"
          message="Loading system health data..."
        />
      </div>
    );
  }

  if (error && !healthData && !metricsData) {
    return (
      <div style={{
        fontFamily: theme.typography.fontFamily.sans,
        ...style,
      }}>
        <ErrorMessage
          message={error}
          severity="error"
          title="System Health Error"
          onRetry={handleRetry}
          onDismiss={handleDismissError}
        />
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: theme.typography.fontFamily.sans,
      ...style,
    }}>
      {/* Error banner (non-blocking) */}
      {error && (
        <div style={{ marginBottom: theme.spacing[4] }}>
          <ErrorMessage
            message={error}
            severity="warning"
            onRetry={handleRefresh}
            onDismiss={handleDismissError}
            compact
          />
        </div>
      )}

      {/* Header Card */}
      <div style={{
        background: theme.components.card.background,
        border: theme.components.card.border,
        borderRadius: theme.components.card.borderRadius,
        boxShadow: theme.components.card.shadow,
        marginBottom: theme.spacing[4],
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${theme.spacing[4]} ${theme.spacing[4]} ${theme.spacing[3]}`,
          borderBottom: `1px solid ${theme.colors.border.light}`,
          flexWrap: 'wrap',
          gap: theme.spacing[3],
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[3],
          }}>
            {/* Overall status indicator */}
            <div style={{
              width: '2.5rem',
              height: '2.5rem',
              borderRadius: theme.borderRadius.full,
              background: statusConfig.background,
              color: statusConfig.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.bold,
              flexShrink: 0,
              border: statusConfig.border,
            }}>
              {statusConfig.icon}
            </div>
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing[2],
              }}>
                <h3 style={{
                  fontSize: theme.typography.fontSize.lg,
                  fontWeight: theme.typography.fontWeight.semibold,
                  color: theme.colors.text.primary,
                  margin: 0,
                  lineHeight: theme.typography.lineHeight.tight,
                }}>
                  {title}
                </h3>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: theme.spacing[1],
                  padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                  borderRadius: theme.borderRadius.full,
                  background: statusConfig.badgeBg,
                  color: statusConfig.badgeColor,
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.medium,
                  lineHeight: 1.2,
                }}>
                  <span style={{ lineHeight: 1 }}>{statusConfig.icon}</span>
                  {statusConfig.label}
                </span>
              </div>
              {subtitle && (
                <p style={{
                  fontSize: theme.typography.fontSize.sm,
                  color: theme.colors.text.tertiary,
                  margin: 0,
                  marginTop: '2px',
                  lineHeight: theme.typography.lineHeight.normal,
                }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[3],
            flexWrap: 'wrap',
          }}>
            {/* Last updated */}
            {lastUpdated && (
              <span style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.disabled,
                whiteSpace: 'nowrap',
              }}>
                Updated {formatTimestamp(lastUpdated)}
              </span>
            )}

            {/* Auto-refresh toggle */}
            <button
              onClick={handleToggleAutoRefresh}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: theme.spacing[1],
                background: autoRefresh ? theme.colors.success[50] : theme.colors.neutral[100],
                color: autoRefresh ? theme.colors.success[700] : theme.colors.text.tertiary,
                border: autoRefresh
                  ? `1px solid ${theme.colors.success[200]}`
                  : `1px solid ${theme.colors.border.light}`,
                borderRadius: theme.borderRadius.full,
                padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.medium,
                fontFamily: theme.typography.fontFamily.sans,
                cursor: 'pointer',
                transition: theme.transitions.default,
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
              title={autoRefresh ? `Auto-refreshing every ${clampedInterval / 1000}s` : 'Auto-refresh disabled'}
            >
              {autoRefresh ? '● Live' : '○ Paused'}
            </button>

            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing[1],
                background: theme.components.button.secondary.background,
                color: isRefreshing ? theme.colors.text.disabled : theme.colors.text.secondary,
                border: theme.components.button.secondary.border,
                borderRadius: theme.components.button.secondary.borderRadius,
                padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.components.button.secondary.fontWeight,
                fontFamily: theme.typography.fontFamily.sans,
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
                transition: theme.transitions.default,
                whiteSpace: 'nowrap',
                opacity: isRefreshing ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isRefreshing) {
                  e.currentTarget.style.background = theme.components.button.secondary.hoverBackground;
                  e.currentTarget.style.color = theme.colors.text.primary;
                }
              }}
              onMouseLeave={(e) => {
                if (!isRefreshing) {
                  e.currentTarget.style.background = theme.components.button.secondary.background;
                  e.currentTarget.style.color = theme.colors.text.secondary;
                }
              }}
            >
              {isRefreshing && (
                <span style={{
                  display: 'inline-block',
                  width: '0.75rem',
                  height: '0.75rem',
                  border: `2px solid ${theme.colors.neutral[200]}`,
                  borderTopColor: theme.colors.primary[600],
                  borderRadius: '50%',
                  animation: 'systemHealthSpin 0.8s linear infinite',
                }} />
              )}
              {isRefreshing ? 'Refreshing...' : '⟳ Refresh'}
            </button>
          </div>
        </div>

        {/* Refreshing indicator */}
        {isRefreshing && (
          <div style={{
            padding: `${theme.spacing[1]} ${theme.spacing[4]}`,
            background: theme.colors.info[50],
            borderBottom: `1px solid ${theme.colors.info[200]}`,
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[2],
          }}>
            <span style={{
              display: 'inline-block',
              width: '0.625rem',
              height: '0.625rem',
              border: `2px solid ${theme.colors.info[200]}`,
              borderTopColor: theme.colors.info[600],
              borderRadius: '50%',
              animation: 'systemHealthSpin 0.8s linear infinite',
            }} />
            <span style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.info[700],
            }}>
              Refreshing health data...
            </span>
          </div>
        )}

        {/* Summary Stats Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: compact ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: theme.spacing[3],
          padding: theme.spacing[4],
        }}>
          {renderStatCard(
            'Uptime',
            uptimeData ? formatUptime(uptimeData.seconds) : '—',
            '⏱',
            theme.colors.primary[700],
            theme.colors.primary[50],
            uptimeData && uptimeData.human ? uptimeData.human : null,
          )}
          {renderStatCard(
            'Total Requests',
            requestMetrics ? formatNumber(requestMetrics.total) : '—',
            '↗',
            theme.colors.info[700],
            theme.colors.info[50],
          )}
          {renderStatCard(
            'Total Errors',
            errorMetrics ? formatNumber(errorMetrics.total) : '—',
            '✕',
            errorMetrics && errorMetrics.total > 0 ? theme.colors.error[700] : theme.colors.success[700],
            errorMetrics && errorMetrics.total > 0 ? theme.colors.error[50] : theme.colors.success[50],
          )}
          {renderStatCard(
            'Avg Extraction',
            extractionMetrics ? formatMs(extractionMetrics.avg_ms) : '—',
            '⚡',
            theme.colors.warning[700],
            theme.colors.warning[50],
            extractionMetrics ? `${formatNumber(extractionMetrics.count)} total` : null,
          )}
        </div>
      </div>

      {/* Detail Sections */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: compact ? '1fr' : 'repeat(2, 1fr)',
        gap: theme.spacing[4],
      }}>
        {showHealth && renderDatabaseSection()}
        {renderMemorySection()}
        {showMetrics && renderRequestMetrics()}
        {showMetrics && renderExtractionMetrics()}
        {showMetrics && renderErrorMetrics()}
        {showMetrics && renderLogIngestionMetrics()}
      </div>

      <style>{`
        @keyframes systemHealthSpin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          div[style*="grid-template-columns: repeat(4"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          div[style*="grid-template-columns: repeat(2"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default SystemHealthPanel;