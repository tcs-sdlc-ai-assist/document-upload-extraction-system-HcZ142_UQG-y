import { useState, useCallback, useEffect, useMemo } from 'react';
import DataTable from '../common/DataTable';
import ErrorMessage from '../common/ErrorMessage';
import LoadingSpinner from '../common/LoadingSpinner';
import logService from '../../services/logService';
import theme from '../../config/theme';

const STATUS_CONFIG = {
  success: {
    label: 'Success',
    background: theme.components.badge.completed.background,
    color: theme.components.badge.completed.color,
    icon: '✓',
  },
  failure: {
    label: 'Failure',
    background: theme.components.badge.failed.background,
    color: theme.components.badge.failed.color,
    icon: '✕',
  },
};

const ACTION_FILTER_OPTIONS = [
  { value: 'all', label: 'All Actions' },
  { value: 'user.login', label: 'User Login' },
  { value: 'user.logout', label: 'User Logout' },
  { value: 'user.register', label: 'User Register' },
  { value: 'token.refresh', label: 'Token Refresh' },
  { value: 'document.upload', label: 'Document Upload' },
  { value: 'document.delete', label: 'Document Delete' },
  { value: 'document.validation', label: 'Document Validation' },
  { value: 'extraction.start', label: 'Extraction Start' },
  { value: 'extraction.complete', label: 'Extraction Complete' },
  { value: 'extraction.fail', label: 'Extraction Fail' },
  { value: 'system.event', label: 'System Event' },
  { value: 'system.error', label: 'System Error' },
];

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'success', label: 'Success' },
  { value: 'failure', label: 'Failure' },
];

const formatTimestamp = (timestamp) => {
  if (!timestamp) return '—';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString(undefined, {
      year: 'numeric',
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

const formatAction = (action) => {
  if (!action) return '—';
  return action
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatDetails = (details) => {
  if (!details) return '—';
  if (typeof details === 'string') return details;
  if (typeof details === 'object') {
    try {
      const keys = Object.keys(details);
      if (keys.length === 0) return '—';
      const parts = [];
      for (const key of keys.slice(0, 4)) {
        const val = details[key];
        if (val !== null && val !== undefined) {
          parts.push(`${key}: ${typeof val === 'object' ? JSON.stringify(val) : String(val)}`);
        }
      }
      if (keys.length > 4) {
        parts.push(`+${keys.length - 4} more`);
      }
      return parts.join(', ');
    } catch {
      return '—';
    }
  }
  return String(details);
};

const getDefaultStartDate = () => {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString().split('T')[0];
};

const getDefaultEndDate = () => {
  return new Date().toISOString().split('T')[0];
};

const AuditLogTable = ({
  initialFilters = {},
  pageSize: initialPageSize = 25,
  showExport = true,
  showFilters = true,
  title = 'Audit Logs',
  subtitle = 'System activity and security event log',
  style = {},
}) => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  const [filterAction, setFilterAction] = useState(initialFilters.action || 'all');
  const [filterStatus, setFilterStatus] = useState(initialFilters.status || 'all');
  const [filterStartDate, setFilterStartDate] = useState(initialFilters.start_time || getDefaultStartDate());
  const [filterEndDate, setFilterEndDate] = useState(initialFilters.end_time || getDefaultEndDate());
  const [filterUserId, setFilterUserId] = useState(initialFilters.user_id || '');
  const [filterIpAddress, setFilterIpAddress] = useState(initialFilters.ip_address || '');

  const [selectedLogId, setSelectedLogId] = useState(null);
  const [selectedLogDetail, setSelectedLogDetail] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const buildFilters = useCallback(() => {
    const filters = {};
    if (filterAction && filterAction !== 'all') filters.action = filterAction;
    if (filterStatus && filterStatus !== 'all') filters.status = filterStatus;
    if (filterStartDate) filters.start_time = new Date(filterStartDate).toISOString();
    if (filterEndDate) {
      const end = new Date(filterEndDate);
      end.setHours(23, 59, 59, 999);
      filters.end_time = end.toISOString();
    }
    if (filterUserId.trim()) filters.user_id = filterUserId.trim();
    if (filterIpAddress.trim()) filters.ip_address = filterIpAddress.trim();
    return filters;
  }, [filterAction, filterStatus, filterStartDate, filterEndDate, filterUserId, filterIpAddress]);

  const fetchLogs = useCallback(async (currentPage = 1) => {
    setIsLoading(true);
    setError(null);

    try {
      const filters = buildFilters();
      const response = await logService.getAuditLogs({
        ...filters,
        page: currentPage,
        page_size: pageSize,
      });

      if (response.success && response.data) {
        setLogs(response.data.logs || []);
        setTotal(response.data.total || 0);
        setPage(response.data.page || currentPage);
      } else {
        const errorMsg = response.message || 'Failed to load audit logs.';
        setError(errorMsg);
        setLogs([]);
        setTotal(0);
      }
    } catch (err) {
      const errorMsg = err.message || 'An unexpected error occurred while loading audit logs.';
      setError(errorMsg);
      setLogs([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [buildFilters, pageSize]);

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  const handleApplyFilters = useCallback(() => {
    setPage(1);
    setSelectedLogId(null);
    setSelectedLogDetail(null);
    fetchLogs(1);
  }, [fetchLogs]);

  const handleClearFilters = useCallback(() => {
    setFilterAction('all');
    setFilterStatus('all');
    setFilterStartDate(getDefaultStartDate());
    setFilterEndDate(getDefaultEndDate());
    setFilterUserId('');
    setFilterIpAddress('');
    setSelectedLogId(null);
    setSelectedLogDetail(null);
    setPage(1);
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchLogs(1);
    }, 100);
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAction, filterStatus, filterStartDate, filterEndDate]);

  const handleRetry = useCallback(() => {
    fetchLogs(page);
  }, [fetchLogs, page]);

  const handleDismissError = useCallback(() => {
    setError(null);
  }, []);

  const handleDismissExportError = useCallback(() => {
    setExportError(null);
  }, []);

  const handleExport = useCallback(async (format) => {
    setIsExporting(true);
    setExportError(null);

    try {
      const filters = buildFilters();
      const response = await logService.exportAuditLogs(filters, format);

      if (response.success && response.data) {
        const exportData = response.data.data || response.data;

        if (format === 'csv') {
          const csvContent = typeof exportData === 'string' ? exportData : JSON.stringify(exportData);
          const blob = new Blob([csvContent], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } else {
          const jsonContent = typeof exportData === 'string' ? exportData : JSON.stringify(exportData, null, 2);
          const blob = new Blob([jsonContent], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `audit_logs_${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      } else {
        setExportError(response.message || `Failed to export audit logs as ${format.toUpperCase()}.`);
      }
    } catch (err) {
      setExportError(err.message || 'An unexpected error occurred during export.');
    } finally {
      setIsExporting(false);
    }
  }, [buildFilters]);

  const handleRowClick = useCallback(async (row) => {
    if (!row || !row.id) return;

    if (selectedLogId === row.id) {
      setSelectedLogId(null);
      setSelectedLogDetail(null);
      return;
    }

    setSelectedLogId(row.id);
    setSelectedLogDetail(null);
    setIsLoadingDetail(true);

    try {
      const response = await logService.getAuditLogById(row.id);
      if (response.success && response.data) {
        setSelectedLogDetail(response.data);
      } else {
        setSelectedLogDetail(row);
      }
    } catch {
      setSelectedLogDetail(row);
    } finally {
      setIsLoadingDetail(false);
    }
  }, [selectedLogId]);

  const handleCloseDetail = useCallback(() => {
    setSelectedLogId(null);
    setSelectedLogDetail(null);
  }, []);

  const hasActiveFilters = useMemo(() => {
    return (
      filterAction !== 'all' ||
      filterStatus !== 'all' ||
      filterUserId.trim() !== '' ||
      filterIpAddress.trim() !== '' ||
      filterStartDate !== getDefaultStartDate() ||
      filterEndDate !== getDefaultEndDate()
    );
  }, [filterAction, filterStatus, filterUserId, filterIpAddress, filterStartDate, filterEndDate]);

  const tableData = useMemo(() => {
    return logs.map((log) => ({
      id: log.id,
      timestamp: log.timestamp,
      user_id: log.user_id || '—',
      action: log.action || '—',
      status: log.status || '—',
      ip_address: log.ip_address || '—',
      details: log.details || {},
      _raw: log,
    }));
  }, [logs]);

  const columns = useMemo(() => [
    {
      key: 'timestamp',
      label: 'Timestamp',
      sortable: true,
      width: '12rem',
      render: (value) => (
        <span style={{
          fontSize: theme.typography.fontSize.xs,
          fontFamily: theme.typography.fontFamily.mono,
          color: theme.colors.text.primary,
          whiteSpace: 'nowrap',
        }}>
          {formatTimestamp(value)}
        </span>
      ),
    },
    {
      key: 'user_id',
      label: 'User',
      sortable: true,
      width: '8rem',
      render: (value) => (
        <span style={{
          fontSize: theme.typography.fontSize.xs,
          fontFamily: theme.typography.fontFamily.mono,
          color: value === '—' ? theme.colors.text.disabled : theme.colors.text.secondary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '7rem',
          display: 'inline-block',
        }}
        title={value}
        >
          {value !== '—' ? value.substring(0, 8) + '…' : '—'}
        </span>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      sortable: true,
      render: (value) => (
        <span style={{
          display: 'inline-block',
          padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
          background: theme.colors.neutral[100],
          color: theme.colors.text.secondary,
          borderRadius: theme.borderRadius.md,
          fontSize: theme.typography.fontSize.xs,
          fontWeight: theme.typography.fontWeight.medium,
          whiteSpace: 'nowrap',
          lineHeight: '1.5',
        }}>
          {formatAction(value)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      width: '7rem',
      align: 'center',
      render: (value) => {
        const config = STATUS_CONFIG[value] || {
          label: value || '—',
          background: theme.colors.neutral[100],
          color: theme.colors.neutral[600],
          icon: '?',
        };
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: theme.spacing[1],
            padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
            borderRadius: theme.borderRadius.full,
            background: config.background,
            color: config.color,
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.medium,
            whiteSpace: 'nowrap',
            lineHeight: 1.2,
          }}>
            <span style={{ lineHeight: 1 }}>{config.icon}</span>
            {config.label}
          </span>
        );
      },
    },
    {
      key: 'ip_address',
      label: 'IP Address',
      sortable: true,
      width: '8rem',
      render: (value) => (
        <span style={{
          fontSize: theme.typography.fontSize.xs,
          fontFamily: theme.typography.fontFamily.mono,
          color: value === '—' ? theme.colors.text.disabled : theme.colors.text.secondary,
        }}>
          {value}
        </span>
      ),
    },
    {
      key: 'details',
      label: 'Details',
      sortable: false,
      render: (value) => (
        <span style={{
          fontSize: theme.typography.fontSize.xs,
          color: theme.colors.text.tertiary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '16rem',
          display: 'inline-block',
        }}
        title={typeof value === 'object' ? JSON.stringify(value) : String(value)}
        >
          {formatDetails(value)}
        </span>
      ),
    },
  ], []);

  const renderFilters = () => {
    if (!showFilters) return null;

    return (
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: theme.spacing[3],
        padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
        borderBottom: `1px solid ${theme.colors.border.light}`,
        flexWrap: 'wrap',
        background: theme.colors.background.secondary,
      }}>
        {/* Date Range */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing[1],
        }}>
          <label style={{
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.medium,
            color: theme.colors.text.tertiary,
          }}>
            Start Date
          </label>
          <input
            type="date"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
            style={{
              background: theme.components.input.background,
              color: theme.components.input.color,
              border: theme.components.input.border,
              borderRadius: theme.components.input.borderRadius,
              padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
              fontSize: theme.typography.fontSize.xs,
              fontFamily: theme.typography.fontFamily.sans,
              outline: 'none',
              transition: theme.transitions.default,
              minWidth: '8rem',
            }}
            onFocus={(e) => {
              e.target.style.border = theme.components.input.borderFocus;
              e.target.style.boxShadow = theme.components.input.boxShadowFocus;
            }}
            onBlur={(e) => {
              e.target.style.border = theme.components.input.border;
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing[1],
        }}>
          <label style={{
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.medium,
            color: theme.colors.text.tertiary,
          }}>
            End Date
          </label>
          <input
            type="date"
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
            style={{
              background: theme.components.input.background,
              color: theme.components.input.color,
              border: theme.components.input.border,
              borderRadius: theme.components.input.borderRadius,
              padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
              fontSize: theme.typography.fontSize.xs,
              fontFamily: theme.typography.fontFamily.sans,
              outline: 'none',
              transition: theme.transitions.default,
              minWidth: '8rem',
            }}
            onFocus={(e) => {
              e.target.style.border = theme.components.input.borderFocus;
              e.target.style.boxShadow = theme.components.input.boxShadowFocus;
            }}
            onBlur={(e) => {
              e.target.style.border = theme.components.input.border;
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Action Filter */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing[1],
        }}>
          <label style={{
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.medium,
            color: theme.colors.text.tertiary,
          }}>
            Action
          </label>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            style={{
              background: theme.components.input.background,
              color: theme.components.input.color,
              border: theme.components.input.border,
              borderRadius: theme.components.input.borderRadius,
              padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
              fontSize: theme.typography.fontSize.xs,
              fontFamily: theme.typography.fontFamily.sans,
              cursor: 'pointer',
              outline: 'none',
              transition: theme.transitions.default,
              minWidth: '9rem',
            }}
            onFocus={(e) => {
              e.target.style.border = theme.components.input.borderFocus;
              e.target.style.boxShadow = theme.components.input.boxShadowFocus;
            }}
            onBlur={(e) => {
              e.target.style.border = theme.components.input.border;
              e.target.style.boxShadow = 'none';
            }}
          >
            {ACTION_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing[1],
        }}>
          <label style={{
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.medium,
            color: theme.colors.text.tertiary,
          }}>
            Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              background: theme.components.input.background,
              color: theme.components.input.color,
              border: theme.components.input.border,
              borderRadius: theme.components.input.borderRadius,
              padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
              fontSize: theme.typography.fontSize.xs,
              fontFamily: theme.typography.fontFamily.sans,
              cursor: 'pointer',
              outline: 'none',
              transition: theme.transitions.default,
              minWidth: '7rem',
            }}
            onFocus={(e) => {
              e.target.style.border = theme.components.input.borderFocus;
              e.target.style.boxShadow = theme.components.input.boxShadowFocus;
            }}
            onBlur={(e) => {
              e.target.style.border = theme.components.input.border;
              e.target.style.boxShadow = 'none';
            }}
          >
            {STATUS_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* User ID Filter */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing[1],
        }}>
          <label style={{
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.medium,
            color: theme.colors.text.tertiary,
          }}>
            User ID
          </label>
          <input
            type="text"
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            placeholder="Filter by user..."
            style={{
              background: theme.components.input.background,
              color: theme.components.input.color,
              border: theme.components.input.border,
              borderRadius: theme.components.input.borderRadius,
              padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
              fontSize: theme.typography.fontSize.xs,
              fontFamily: theme.typography.fontFamily.sans,
              outline: 'none',
              transition: theme.transitions.default,
              minWidth: '8rem',
            }}
            onFocus={(e) => {
              e.target.style.border = theme.components.input.borderFocus;
              e.target.style.boxShadow = theme.components.input.boxShadowFocus;
            }}
            onBlur={(e) => {
              e.target.style.border = theme.components.input.border;
              e.target.style.boxShadow = 'none';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleApplyFilters();
              }
            }}
          />
        </div>

        {/* IP Address Filter */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing[1],
        }}>
          <label style={{
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.medium,
            color: theme.colors.text.tertiary,
          }}>
            IP Address
          </label>
          <input
            type="text"
            value={filterIpAddress}
            onChange={(e) => setFilterIpAddress(e.target.value)}
            placeholder="Filter by IP..."
            style={{
              background: theme.components.input.background,
              color: theme.components.input.color,
              border: theme.components.input.border,
              borderRadius: theme.components.input.borderRadius,
              padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
              fontSize: theme.typography.fontSize.xs,
              fontFamily: theme.typography.fontFamily.sans,
              outline: 'none',
              transition: theme.transitions.default,
              minWidth: '8rem',
            }}
            onFocus={(e) => {
              e.target.style.border = theme.components.input.borderFocus;
              e.target.style.boxShadow = theme.components.input.boxShadowFocus;
            }}
            onBlur={(e) => {
              e.target.style.border = theme.components.input.border;
              e.target.style.boxShadow = 'none';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleApplyFilters();
              }
            }}
          />
        </div>

        {/* Filter Actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing[2],
          marginLeft: 'auto',
        }}>
          <button
            onClick={handleApplyFilters}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing[1],
              background: theme.components.button.primary.background,
              color: theme.components.button.primary.color,
              border: 'none',
              borderRadius: theme.components.button.primary.borderRadius,
              padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
              fontSize: theme.typography.fontSize.xs,
              fontWeight: theme.components.button.primary.fontWeight,
              fontFamily: theme.typography.fontFamily.sans,
              cursor: 'pointer',
              transition: theme.transitions.default,
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.components.button.primary.hoverBackground;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = theme.components.button.primary.background;
            }}
          >
            ⌕ Search
          </button>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              style={{
                background: 'transparent',
                border: 'none',
                color: theme.colors.text.tertiary,
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.medium,
                fontFamily: theme.typography.fontFamily.sans,
                cursor: 'pointer',
                padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                borderRadius: theme.borderRadius.md,
                transition: theme.transitions.default,
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = theme.colors.error[600];
                e.currentTarget.style.background = theme.colors.error[50];
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = theme.colors.text.tertiary;
                e.currentTarget.style.background = 'transparent';
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderExportButtons = () => {
    if (!showExport) return null;

    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing[2],
      }}>
        <button
          onClick={() => handleExport('csv')}
          disabled={isExporting || logs.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[1],
            background: theme.components.button.secondary.background,
            color: logs.length === 0 || isExporting
              ? theme.colors.text.disabled
              : theme.colors.text.secondary,
            border: theme.components.button.secondary.border,
            borderRadius: theme.components.button.secondary.borderRadius,
            padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.components.button.secondary.fontWeight,
            fontFamily: theme.typography.fontFamily.sans,
            cursor: logs.length === 0 || isExporting ? 'not-allowed' : 'pointer',
            transition: theme.transitions.default,
            whiteSpace: 'nowrap',
            opacity: logs.length === 0 || isExporting ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            if (logs.length > 0 && !isExporting) {
              e.currentTarget.style.background = theme.components.button.secondary.hoverBackground;
              e.currentTarget.style.color = theme.colors.text.primary;
            }
          }}
          onMouseLeave={(e) => {
            if (logs.length > 0 && !isExporting) {
              e.currentTarget.style.background = theme.components.button.secondary.background;
              e.currentTarget.style.color = theme.colors.text.secondary;
            }
          }}
        >
          ↓ CSV
        </button>

        <button
          onClick={() => handleExport('json')}
          disabled={isExporting || logs.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[1],
            background: theme.components.button.secondary.background,
            color: logs.length === 0 || isExporting
              ? theme.colors.text.disabled
              : theme.colors.text.secondary,
            border: theme.components.button.secondary.border,
            borderRadius: theme.components.button.secondary.borderRadius,
            padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.components.button.secondary.fontWeight,
            fontFamily: theme.typography.fontFamily.sans,
            cursor: logs.length === 0 || isExporting ? 'not-allowed' : 'pointer',
            transition: theme.transitions.default,
            whiteSpace: 'nowrap',
            opacity: logs.length === 0 || isExporting ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            if (logs.length > 0 && !isExporting) {
              e.currentTarget.style.background = theme.components.button.secondary.hoverBackground;
              e.currentTarget.style.color = theme.colors.text.primary;
            }
          }}
          onMouseLeave={(e) => {
            if (logs.length > 0 && !isExporting) {
              e.currentTarget.style.background = theme.components.button.secondary.background;
              e.currentTarget.style.color = theme.colors.text.secondary;
            }
          }}
        >
          ↓ JSON
        </button>

        {isExporting && (
          <span style={{
            display: 'inline-block',
            width: '0.875rem',
            height: '0.875rem',
            border: `2px solid ${theme.colors.neutral[200]}`,
            borderTopColor: theme.colors.primary[600],
            borderRadius: '50%',
            animation: 'auditLogExportSpin 0.8s linear infinite',
          }} />
        )}
      </div>
    );
  };

  const renderLogDetail = () => {
    if (!selectedLogId) return null;

    if (isLoadingDetail) {
      return (
        <div style={{
          background: theme.colors.background.primary,
          borderRadius: theme.borderRadius.lg,
          border: `1px solid ${theme.colors.border.light}`,
          padding: theme.spacing[6],
        }}>
          <LoadingSpinner size="sm" message="Loading log details..." />
        </div>
      );
    }

    if (!selectedLogDetail) return null;

    const detail = selectedLogDetail;
    const statusConfig = STATUS_CONFIG[detail.status] || {
      label: detail.status || '—',
      background: theme.colors.neutral[100],
      color: theme.colors.neutral[600],
      icon: '?',
    };

    const detailFields = [
      { label: 'Log ID', value: detail.id || '—' },
      { label: 'Timestamp', value: formatTimestamp(detail.timestamp) },
      { label: 'User ID', value: detail.user_id || '—' },
      { label: 'Action', value: formatAction(detail.action) },
      { label: 'Status', value: statusConfig.label },
      { label: 'IP Address', value: detail.ip_address || '—' },
    ];

    return (
      <div style={{
        background: theme.colors.background.primary,
        borderRadius: theme.borderRadius.lg,
        border: `1px solid ${theme.colors.border.light}`,
        overflow: 'hidden',
      }}>
        {/* Detail Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
          borderBottom: `1px solid ${theme.colors.border.light}`,
          background: theme.colors.background.secondary,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[2],
          }}>
            <span style={{
              width: '2rem',
              height: '2rem',
              borderRadius: theme.borderRadius.lg,
              background: statusConfig.background,
              color: statusConfig.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.bold,
              flexShrink: 0,
            }}>
              {statusConfig.icon}
            </span>
            <div>
              <p style={{
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold,
                color: theme.colors.text.primary,
                margin: 0,
              }}>
                {formatAction(detail.action)}
              </p>
              <p style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.tertiary,
                margin: 0,
              }}>
                {formatTimestamp(detail.timestamp)}
              </p>
            </div>
          </div>
          <button
            onClick={handleCloseDetail}
            style={{
              background: 'transparent',
              border: 'none',
              color: theme.colors.text.disabled,
              fontSize: theme.typography.fontSize.base,
              cursor: 'pointer',
              padding: theme.spacing[1],
              borderRadius: theme.borderRadius.md,
              transition: theme.transitions.default,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '1.75rem',
              height: '1.75rem',
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.colors.neutral[100];
              e.currentTarget.style.color = theme.colors.text.secondary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = theme.colors.text.disabled;
            }}
          >
            ✕
          </button>
        </div>

        {/* Detail Fields */}
        <div style={{ padding: 0 }}>
          {detailFields.map((field, idx) => (
            <div
              key={field.label}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
                background: idx % 2 === 0
                  ? theme.colors.background.primary
                  : theme.colors.background.tertiary,
                borderBottom: idx < detailFields.length - 1
                  ? `1px solid ${theme.colors.border.light}`
                  : 'none',
                gap: theme.spacing[3],
              }}
            >
              <span style={{
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.text.tertiary,
                minWidth: '6rem',
                flexShrink: 0,
              }}>
                {field.label}
              </span>
              <span style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.primary,
                wordBreak: 'break-word',
                flex: 1,
                minWidth: 0,
                fontFamily: field.label === 'Log ID' || field.label === 'User ID' || field.label === 'IP Address'
                  ? theme.typography.fontFamily.mono
                  : theme.typography.fontFamily.sans,
              }}>
                {field.value}
              </span>
            </div>
          ))}
        </div>

        {/* Details JSON */}
        {detail.details && typeof detail.details === 'object' && Object.keys(detail.details).length > 0 && (
          <div style={{
            borderTop: `1px solid ${theme.colors.border.light}`,
          }}>
            <div style={{
              padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
              background: theme.colors.background.secondary,
              borderBottom: `1px solid ${theme.colors.border.light}`,
            }}>
              <span style={{
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.semibold,
                color: theme.colors.text.secondary,
              }}>
                Event Details
              </span>
            </div>
            <div style={{
              padding: theme.spacing[4],
              maxHeight: '16rem',
              overflowY: 'auto',
            }}>
              <pre style={{
                fontFamily: theme.typography.fontFamily.mono,
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.primary,
                lineHeight: theme.typography.lineHeight.relaxed,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: 0,
                background: theme.colors.background.tertiary,
                padding: theme.spacing[3],
                borderRadius: theme.borderRadius.lg,
                border: `1px solid ${theme.colors.border.light}`,
              }}>
                {JSON.stringify(detail.details, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (isLoading && logs.length === 0) {
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
          message="Loading audit logs..."
        />
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: theme.typography.fontFamily.sans,
      ...style,
    }}>
      {/* Error Messages */}
      {error && (
        <div style={{ marginBottom: theme.spacing[4] }}>
          <ErrorMessage
            message={error}
            severity="error"
            title="Failed to Load Audit Logs"
            onRetry={handleRetry}
            onDismiss={handleDismissError}
          />
        </div>
      )}

      {exportError && (
        <div style={{ marginBottom: theme.spacing[4] }}>
          <ErrorMessage
            message={exportError}
            severity="warning"
            title="Export Failed"
            onDismiss={handleDismissExportError}
            compact
          />
        </div>
      )}

      {/* Main Card */}
      <div style={{
        background: theme.components.card.background,
        border: theme.components.card.border,
        borderRadius: theme.components.card.borderRadius,
        boxShadow: theme.components.card.shadow,
        overflow: 'hidden',
        marginBottom: selectedLogId ? theme.spacing[4] : 0,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${theme.spacing[4]} ${theme.spacing[4]} ${theme.spacing[3]}`,
          borderBottom: `1px solid ${theme.colors.border.light}`,
          flexWrap: 'wrap',
          gap: theme.spacing[3],
        }}>
          <div>
            {title && (
              <h3 style={{
                fontSize: theme.typography.fontSize.lg,
                fontWeight: theme.typography.fontWeight.semibold,
                color: theme.colors.text.primary,
                margin: 0,
                marginBottom: subtitle ? theme.spacing[1] : 0,
                lineHeight: theme.typography.lineHeight.tight,
              }}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p style={{
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.text.tertiary,
                margin: 0,
                lineHeight: theme.typography.lineHeight.normal,
              }}>
                {subtitle}
              </p>
            )}
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[3],
          }}>
            {/* Total count badge */}
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
              borderRadius: theme.borderRadius.full,
              background: theme.colors.neutral[100],
              fontSize: theme.typography.fontSize.xs,
              fontWeight: theme.typography.fontWeight.medium,
              color: theme.colors.text.secondary,
            }}>
              {total.toLocaleString()} {total === 1 ? 'entry' : 'entries'}
            </span>

            {/* Refresh button */}
            <button
              onClick={handleRetry}
              disabled={isLoading}
              style={{
                background: 'transparent',
                border: 'none',
                color: isLoading ? theme.colors.text.disabled : theme.colors.text.tertiary,
                fontSize: theme.typography.fontSize.sm,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                padding: theme.spacing[1],
                borderRadius: theme.borderRadius.md,
                transition: theme.transitions.default,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '1.75rem',
                height: '1.75rem',
                lineHeight: 1,
                opacity: isLoading ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.background = theme.colors.neutral[100];
                  e.currentTarget.style.color = theme.colors.text.primary;
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = theme.colors.text.tertiary;
                }
              }}
              title="Refresh"
            >
              ⟳
            </button>

            {/* Export Buttons */}
            {renderExportButtons()}
          </div>
        </div>

        {/* Filters */}
        {renderFilters()}

        {/* Loading overlay */}
        {isLoading && logs.length > 0 && (
          <div style={{
            padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
            background: theme.colors.info[50],
            borderBottom: `1px solid ${theme.colors.info[200]}`,
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[2],
          }}>
            <span style={{
              display: 'inline-block',
              width: '0.75rem',
              height: '0.75rem',
              border: `2px solid ${theme.colors.info[200]}`,
              borderTopColor: theme.colors.info[600],
              borderRadius: '50%',
              animation: 'auditLogExportSpin 0.8s linear infinite',
            }} />
            <span style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.info[700],
            }}>
              Refreshing logs...
            </span>
          </div>
        )}

        {/* Data Table */}
        <DataTable
          data={tableData}
          columns={columns}
          pageSize={pageSize}
          sortable={true}
          paginated={true}
          striped={true}
          compact={false}
          emptyMessage="No audit log entries match the current filters"
          emptyIcon="L"
          maxHeight="36rem"
          stickyHeader={true}
          showRowNumbers={false}
          onRowClick={handleRowClick}
          rowKeyField="id"
        />
      </div>

      {/* Log Detail Panel */}
      {selectedLogId && (
        <div>
          {renderLogDetail()}
        </div>
      )}

      <style>{`
        @keyframes auditLogExportSpin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          div[style*="flex-wrap: wrap"] {
            flex-direction: column;
            align-items: stretch !important;
          }
        }
      `}</style>
    </div>
  );
};

export default AuditLogTable;