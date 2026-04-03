import { useState, useCallback, useMemo, useEffect } from 'react';
import { useUpload } from '../../context/UploadContext';
import DataTable from '../common/DataTable';
import ErrorMessage from '../common/ErrorMessage';
import LoadingSpinner from '../common/LoadingSpinner';
import theme from '../../config/theme';

const HC_STATUS = {
  HEALTHY: 'healthy',
  WARNING: 'warning',
  CRITICAL: 'critical',
  UNKNOWN: 'unknown',
};

const STATUS_CONFIG = {
  [HC_STATUS.HEALTHY]: {
    label: 'Healthy',
    color: theme.colors.success[700],
    background: theme.colors.success[50],
    border: `1px solid ${theme.colors.success[200]}`,
    icon: '✓',
    badgeBg: theme.components.badge.completed.background,
    badgeColor: theme.components.badge.completed.color,
  },
  [HC_STATUS.WARNING]: {
    label: 'Warning',
    color: theme.colors.warning[700],
    background: theme.colors.warning[50],
    border: `1px solid ${theme.colors.warning[200]}`,
    icon: '⚠',
    badgeBg: theme.components.badge.pending.background,
    badgeColor: theme.components.badge.pending.color,
  },
  [HC_STATUS.CRITICAL]: {
    label: 'Critical',
    color: theme.colors.error[700],
    background: theme.colors.error[50],
    border: `1px solid ${theme.colors.error[200]}`,
    icon: '✕',
    badgeBg: theme.components.badge.failed.background,
    badgeColor: theme.components.badge.failed.color,
  },
  [HC_STATUS.UNKNOWN]: {
    label: 'Unknown',
    color: theme.colors.neutral[600],
    background: theme.colors.neutral[50],
    border: `1px solid ${theme.colors.neutral[200]}`,
    icon: '?',
    badgeBg: theme.colors.neutral[100],
    badgeColor: theme.colors.neutral[600],
  },
};

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: HC_STATUS.HEALTHY, label: 'Healthy' },
  { value: HC_STATUS.WARNING, label: 'Warning' },
  { value: HC_STATUS.CRITICAL, label: 'Critical' },
  { value: HC_STATUS.UNKNOWN, label: 'Unknown' },
];

const inferEnodeBStatus = (enodeb) => {
  if (!enodeb) return HC_STATUS.UNKNOWN;

  if (enodeb.status) {
    const normalized = String(enodeb.status).toLowerCase().trim();
    if (normalized === 'healthy' || normalized === 'ok' || normalized === 'normal' || normalized === 'pass' || normalized === 'active') {
      return HC_STATUS.HEALTHY;
    }
    if (normalized === 'warning' || normalized === 'degraded' || normalized === 'partial') {
      return HC_STATUS.WARNING;
    }
    if (normalized === 'critical' || normalized === 'fail' || normalized === 'failed' || normalized === 'error' || normalized === 'down' || normalized === 'alarm') {
      return HC_STATUS.CRITICAL;
    }
    return HC_STATUS.UNKNOWN;
  }

  if (enodeb.health_status) {
    return inferEnodeBStatus({ status: enodeb.health_status });
  }

  if (enodeb.alarm_count !== undefined || enodeb.alarms !== undefined) {
    const alarmCount = enodeb.alarm_count || (Array.isArray(enodeb.alarms) ? enodeb.alarms.length : 0);
    if (alarmCount === 0) return HC_STATUS.HEALTHY;
    if (alarmCount <= 2) return HC_STATUS.WARNING;
    return HC_STATUS.CRITICAL;
  }

  return HC_STATUS.UNKNOWN;
};

const extractEnodeBData = (result) => {
  if (!result) return [];

  const enodebs = [];

  if (result.extracted_tables && result.extracted_tables.length > 0) {
    for (const table of result.extracted_tables) {
      if (!table.rows || table.rows.length === 0) continue;

      const headers = table.headers || (table.rows.length > 0 ? Object.keys(table.rows[0]) : []);

      const hasEnodeBFields = headers.some((h) => {
        const lower = h.toLowerCase();
        return lower.includes('enodeb') || lower.includes('enb') || lower.includes('site') ||
          lower.includes('cell') || lower.includes('node') || lower.includes('sector') ||
          lower.includes('status') || lower.includes('health') || lower.includes('alarm');
      });

      if (hasEnodeBFields || table.rows.length > 0) {
        for (const row of table.rows) {
          const enodeb = {
            ...row,
            _sheetName: table.sheet_name || null,
          };
          enodebs.push(enodeb);
        }
      }
    }
  }

  if (enodebs.length === 0 && result.extracted_text) {
    const lines = result.extracted_text.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length > 1) {
      const headerLine = lines[0];
      const headerParts = headerLine.split(/[,\t|]/).map((h) => h.trim());

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(/[,\t|]/).map((p) => p.trim());
        if (parts.length >= 2) {
          const row = {};
          for (let j = 0; j < headerParts.length; j++) {
            row[headerParts[j]] = parts[j] || '';
          }
          enodebs.push(row);
        }
      }
    }
  }

  return enodebs;
};

const getEnodeBName = (enodeb) => {
  if (!enodeb) return 'Unknown';

  const nameFields = ['enodeb_name', 'enb_name', 'site_name', 'name', 'Name', 'eNodeB', 'enodeb',
    'ENB', 'enb', 'Site', 'site', 'node_name', 'NodeName', 'cell_name', 'CellName',
    'eNodeB Name', 'Site Name', 'Node Name'];

  for (const field of nameFields) {
    if (enodeb[field] && String(enodeb[field]).trim()) {
      return String(enodeb[field]).trim();
    }
  }

  const keys = Object.keys(enodeb).filter((k) => !k.startsWith('_'));
  if (keys.length > 0) {
    const firstVal = enodeb[keys[0]];
    if (firstVal && String(firstVal).trim()) {
      return String(firstVal).trim();
    }
  }

  return 'Unknown';
};

const getEnodeBId = (enodeb) => {
  if (!enodeb) return null;

  const idFields = ['enodeb_id', 'enb_id', 'site_id', 'id', 'ID', 'eNodeB ID', 'ENB ID',
    'Site ID', 'Node ID', 'cell_id', 'CellID', 'nodeId'];

  for (const field of idFields) {
    if (enodeb[field] !== undefined && enodeb[field] !== null && String(enodeb[field]).trim()) {
      return String(enodeb[field]).trim();
    }
  }

  return null;
};

const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const HealthCheckDirectory = ({
  healthCheckData = null,
  extractionResults = null,
  isLoading = false,
  error = null,
  onRetry = null,
  onDismissError = null,
  style = {},
}) => {
  const { results, queue, uploads } = useUpload();

  const [selectedFileId, setSelectedFileId] = useState(null);
  const [selectedEnodeBIndex, setSelectedEnodeBIndex] = useState(null);
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState('list');

  const allHCFiles = useMemo(() => {
    const files = [];

    if (healthCheckData && Array.isArray(healthCheckData) && healthCheckData.length > 0) {
      for (const hcFile of healthCheckData) {
        files.push({
          fileId: hcFile.fileId || hcFile.id || `hc_${files.length}`,
          fileName: hcFile.fileName || hcFile.file_name || 'Unknown HC File',
          fileType: hcFile.fileType || hcFile.filetype || '',
          fileSize: hcFile.fileSize || hcFile.size || 0,
          status: hcFile.status || 'completed',
          processedAt: hcFile.processedAt || hcFile.processed_at || null,
          enodebs: hcFile.enodebs || extractEnodeBData(hcFile),
          result: hcFile,
        });
      }
      return files;
    }

    if (extractionResults) {
      const resultData = Array.isArray(extractionResults) ? extractionResults : [extractionResults];
      for (const result of resultData) {
        const enodebs = extractEnodeBData(result);
        files.push({
          fileId: result.upload_id || result.id || `hc_${files.length}`,
          fileName: result.file_name || result.fileName || 'Unknown HC File',
          fileType: result.filetype || result.fileType || '',
          fileSize: result.size || result.fileSize || 0,
          status: result.status || 'completed',
          processedAt: result.processed_at || result.processedAt || null,
          enodebs,
          result,
        });
      }
      return files;
    }

    if (results && queue) {
      for (const fileId of queue) {
        const result = results[fileId];
        if (!result) continue;

        const upload = uploads[fileId] || {};
        const enodebs = extractEnodeBData(result);

        if (enodebs.length > 0) {
          files.push({
            fileId,
            fileName: result.file_name || upload.file_name || 'Unknown HC File',
            fileType: result.filetype || upload.file_type || '',
            fileSize: result.size || upload.file_size || 0,
            status: upload.status || 'completed',
            processedAt: result.processed_at || null,
            enodebs,
            result,
          });
        }
      }
    }

    return files;
  }, [healthCheckData, extractionResults, results, queue, uploads]);

  const selectedFile = useMemo(() => {
    if (!selectedFileId) return null;
    return allHCFiles.find((f) => f.fileId === selectedFileId) || null;
  }, [selectedFileId, allHCFiles]);

  const enrichedEnodebs = useMemo(() => {
    if (!selectedFile || !selectedFile.enodebs) return [];

    return selectedFile.enodebs.map((enodeb, idx) => ({
      ...enodeb,
      _index: idx,
      _name: getEnodeBName(enodeb),
      _id: getEnodeBId(enodeb),
      _status: inferEnodeBStatus(enodeb),
      _sourceFile: selectedFile.fileName,
    }));
  }, [selectedFile]);

  const filteredEnodebs = useMemo(() => {
    let data = enrichedEnodebs;

    if (filterStatus !== 'all') {
      data = data.filter((e) => e._status === filterStatus);
    }

    if (filterText.trim()) {
      const search = filterText.trim().toLowerCase();
      data = data.filter((e) => {
        const name = (e._name || '').toLowerCase();
        const id = (e._id || '').toLowerCase();
        const values = Object.values(e)
          .filter((v) => typeof v === 'string')
          .map((v) => v.toLowerCase());
        return name.includes(search) || id.includes(search) || values.some((v) => v.includes(search));
      });
    }

    return data;
  }, [enrichedEnodebs, filterStatus, filterText]);

  const stats = useMemo(() => {
    const totalFiles = allHCFiles.length;
    const totalEnodebs = enrichedEnodebs.length;
    const statusCounts = {
      [HC_STATUS.HEALTHY]: 0,
      [HC_STATUS.WARNING]: 0,
      [HC_STATUS.CRITICAL]: 0,
      [HC_STATUS.UNKNOWN]: 0,
    };

    for (const e of enrichedEnodebs) {
      statusCounts[e._status] = (statusCounts[e._status] || 0) + 1;
    }

    const healthRate = totalEnodebs > 0
      ? Math.round((statusCounts[HC_STATUS.HEALTHY] / totalEnodebs) * 10000) / 100
      : 0;

    return { totalFiles, totalEnodebs, statusCounts, healthRate };
  }, [allHCFiles, enrichedEnodebs]);

  useEffect(() => {
    setSelectedEnodeBIndex(null);
  }, [selectedFileId, filterText, filterStatus]);

  useEffect(() => {
    if (allHCFiles.length > 0 && !selectedFileId) {
      setSelectedFileId(allHCFiles[0].fileId);
    }
  }, [allHCFiles, selectedFileId]);

  const handleFileSelect = useCallback((fileId) => {
    setSelectedFileId(fileId);
    setSelectedEnodeBIndex(null);
  }, []);

  const handleEnodeBSelect = useCallback((index) => {
    setSelectedEnodeBIndex((prev) => (prev === index ? null : index));
  }, []);

  const handleFilterTextChange = useCallback((e) => {
    setFilterText(e.target.value);
  }, []);

  const handleStatusFilterChange = useCallback((e) => {
    setFilterStatus(e.target.value);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilterText('');
    setFilterStatus('all');
    setSelectedEnodeBIndex(null);
  }, []);

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
  }, []);

  const handleExportCSV = useCallback(() => {
    if (filteredEnodebs.length === 0) return;

    const allKeys = new Set();
    for (const e of filteredEnodebs) {
      for (const key of Object.keys(e)) {
        if (!key.startsWith('_')) {
          allKeys.add(key);
        }
      }
    }

    const headers = ['Name', 'ID', 'Status', ...allKeys];
    const csvLines = [headers.join(',')];

    for (const e of filteredEnodebs) {
      const values = [
        e._name || '',
        e._id || '',
        STATUS_CONFIG[e._status]?.label || 'Unknown',
        ...[...allKeys].map((key) => {
          const val = e[key];
          if (val === null || val === undefined) return '';
          const str = String(val);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }),
      ];
      csvLines.push(values.join(','));
    }

    try {
      const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const baseName = selectedFile ? selectedFile.fileName.replace(/\.[^/.]+$/, '') : 'health_check';
      link.download = `${baseName}_enodeb_report.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // silent fail
    }
  }, [filteredEnodebs, selectedFile]);

  const renderStatusBadge = (status) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG[HC_STATUS.UNKNOWN];
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: theme.spacing[1],
        padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
        borderRadius: theme.borderRadius.full,
        background: config.badgeBg,
        color: config.badgeColor,
        fontSize: theme.typography.fontSize.xs,
        fontWeight: theme.typography.fontWeight.medium,
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
      }}>
        <span style={{ lineHeight: 1 }}>{config.icon}</span>
        {config.label}
      </span>
    );
  };

  const renderFileList = () => {
    if (allHCFiles.length === 0) {
      return (
        <div style={{
          padding: theme.spacing[6],
          textAlign: 'center',
        }}>
          <div style={{
            width: '3rem',
            height: '3rem',
            borderRadius: theme.borderRadius.full,
            background: theme.colors.neutral[100],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            marginBottom: theme.spacing[3],
          }}>
            <span style={{
              fontSize: theme.typography.fontSize.xl,
              color: theme.colors.text.tertiary,
              lineHeight: 1,
            }}>
              H
            </span>
          </div>
          <p style={{
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.text.tertiary,
            margin: 0,
          }}>
            No health check files available
          </p>
        </div>
      );
    }

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing[1],
      }}>
        {allHCFiles.map((file) => {
          const isSelected = selectedFileId === file.fileId;
          const totalEnodebs = file.enodebs ? file.enodebs.length : 0;
          const criticalCount = file.enodebs
            ? file.enodebs.filter((e) => inferEnodeBStatus(e) === HC_STATUS.CRITICAL).length
            : 0;
          const warningCount = file.enodebs
            ? file.enodebs.filter((e) => inferEnodeBStatus(e) === HC_STATUS.WARNING).length
            : 0;

          return (
            <button
              key={file.fileId}
              onClick={() => handleFileSelect(file.fileId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing[3],
                padding: `${theme.spacing[3]} ${theme.spacing[3]}`,
                background: isSelected ? theme.colors.primary[50] : 'transparent',
                border: isSelected
                  ? `1px solid ${theme.colors.primary[200]}`
                  : `1px solid transparent`,
                borderRadius: theme.borderRadius.lg,
                cursor: 'pointer',
                transition: theme.transitions.default,
                width: '100%',
                textAlign: 'left',
                fontFamily: theme.typography.fontFamily.sans,
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = theme.colors.neutral[50];
                  e.currentTarget.style.border = `1px solid ${theme.colors.border.light}`;
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.border = '1px solid transparent';
                }
              }}
            >
              <div style={{
                width: '2.25rem',
                height: '2.25rem',
                borderRadius: theme.borderRadius.lg,
                background: isSelected ? theme.colors.primary[100] : theme.colors.neutral[100],
                color: isSelected ? theme.colors.primary[700] : theme.colors.text.tertiary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.bold,
                fontFamily: theme.typography.fontFamily.mono,
                flexShrink: 0,
                textTransform: 'uppercase',
              }}>
                {file.fileType ? file.fileType.substring(0, 3) : 'HC'}
              </div>

              <div style={{
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
              }}>
                <p style={{
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: isSelected
                    ? theme.typography.fontWeight.semibold
                    : theme.typography.fontWeight.medium,
                  color: isSelected ? theme.colors.primary[700] : theme.colors.text.primary,
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {file.fileName}
                </p>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing[2],
                  marginTop: '2px',
                }}>
                  <span style={{
                    fontSize: theme.typography.fontSize.xs,
                    color: theme.colors.text.tertiary,
                  }}>
                    {totalEnodebs} {totalEnodebs === 1 ? 'eNodeB' : 'eNodeBs'}
                  </span>
                  {criticalCount > 0 && (
                    <span style={{
                      fontSize: theme.typography.fontSize.xs,
                      color: theme.colors.error[600],
                      fontWeight: theme.typography.fontWeight.medium,
                    }}>
                      {criticalCount} critical
                    </span>
                  )}
                  {warningCount > 0 && (
                    <span style={{
                      fontSize: theme.typography.fontSize.xs,
                      color: theme.colors.warning[600],
                      fontWeight: theme.typography.fontWeight.medium,
                    }}>
                      {warningCount} warning
                    </span>
                  )}
                </div>
              </div>

              {isSelected && (
                <span style={{
                  width: '3px',
                  height: '60%',
                  borderRadius: theme.borderRadius.full,
                  background: theme.colors.primary[600],
                  flexShrink: 0,
                }} />
              )}
            </button>
          );
        })}
      </div>
    );
  };

  const renderStatsCards = () => {
    if (!selectedFile) return null;

    const cards = [
      {
        label: 'Total eNodeBs',
        value: stats.totalEnodebs,
        color: theme.colors.primary[700],
        bg: theme.colors.primary[50],
        icon: '⊞',
      },
      {
        label: 'Healthy',
        value: stats.statusCounts[HC_STATUS.HEALTHY],
        color: theme.colors.success[700],
        bg: theme.colors.success[50],
        icon: '✓',
      },
      {
        label: 'Warning',
        value: stats.statusCounts[HC_STATUS.WARNING],
        color: theme.colors.warning[700],
        bg: theme.colors.warning[50],
        icon: '⚠',
      },
      {
        label: 'Critical',
        value: stats.statusCounts[HC_STATUS.CRITICAL],
        color: theme.colors.error[700],
        bg: theme.colors.error[50],
        icon: '✕',
      },
    ];

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: theme.spacing[3],
        marginBottom: theme.spacing[4],
      }}>
        {cards.map((card) => (
          <div
            key={card.label}
            style={{
              background: theme.colors.background.primary,
              border: theme.components.card.border,
              borderRadius: theme.borderRadius.lg,
              padding: theme.spacing[3],
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing[3],
            }}
          >
            <div style={{
              width: '2.25rem',
              height: '2.25rem',
              borderRadius: theme.borderRadius.lg,
              background: card.bg,
              color: card.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.bold,
              flexShrink: 0,
            }}>
              {card.icon}
            </div>
            <div>
              <p style={{
                fontSize: theme.typography.fontSize['2xl'],
                fontWeight: theme.typography.fontWeight.bold,
                color: card.color,
                margin: 0,
                lineHeight: theme.typography.lineHeight.tight,
              }}>
                {card.value}
              </p>
              <p style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.tertiary,
                margin: 0,
              }}>
                {card.label}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderListView = () => {
    if (filteredEnodebs.length === 0) {
      return (
        <div style={{
          background: theme.colors.background.primary,
          border: theme.components.card.border,
          borderRadius: theme.components.card.borderRadius,
          padding: theme.spacing[8],
          textAlign: 'center',
        }}>
          <div style={{
            width: '3rem',
            height: '3rem',
            borderRadius: theme.borderRadius.full,
            background: theme.colors.neutral[100],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            marginBottom: theme.spacing[3],
          }}>
            <span style={{
              fontSize: theme.typography.fontSize.xl,
              color: theme.colors.text.tertiary,
              lineHeight: 1,
            }}>
              ∅
            </span>
          </div>
          <p style={{
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.text.tertiary,
            margin: 0,
          }}>
            No eNodeBs match the current filters
          </p>
        </div>
      );
    }

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing[2],
      }}>
        {filteredEnodebs.map((enodeb) => {
          const isSelected = selectedEnodeBIndex === enodeb._index;
          const statusConfig = STATUS_CONFIG[enodeb._status] || STATUS_CONFIG[HC_STATUS.UNKNOWN];

          return (
            <div
              key={enodeb._index}
              onClick={() => handleEnodeBSelect(enodeb._index)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing[3],
                padding: theme.spacing[3],
                background: isSelected ? statusConfig.background : theme.colors.background.primary,
                border: isSelected ? statusConfig.border : theme.components.card.border,
                borderRadius: theme.borderRadius.lg,
                cursor: 'pointer',
                transition: theme.transitions.default,
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = theme.colors.neutral[50];
                  e.currentTarget.style.borderColor = theme.colors.border.default;
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = theme.colors.background.primary;
                  e.currentTarget.style.borderColor = theme.colors.border.light;
                }
              }}
            >
              <div style={{
                width: '2rem',
                height: '2rem',
                borderRadius: theme.borderRadius.full,
                background: statusConfig.background,
                color: statusConfig.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.bold,
                flexShrink: 0,
                border: statusConfig.border,
              }}>
                {statusConfig.icon}
              </div>

              <div style={{
                flex: 1,
                minWidth: 0,
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing[2],
                }}>
                  <span style={{
                    fontSize: theme.typography.fontSize.sm,
                    fontWeight: theme.typography.fontWeight.medium,
                    color: theme.colors.text.primary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {enodeb._name}
                  </span>
                  {enodeb._id && (
                    <span style={{
                      fontSize: theme.typography.fontSize.xs,
                      color: theme.colors.text.tertiary,
                      fontFamily: theme.typography.fontFamily.mono,
                      flexShrink: 0,
                    }}>
                      ID: {enodeb._id}
                    </span>
                  )}
                </div>
              </div>

              {renderStatusBadge(enodeb._status)}
            </div>
          );
        })}
      </div>
    );
  };

  const renderTableView = () => {
    const allKeys = new Set();
    for (const e of filteredEnodebs) {
      for (const key of Object.keys(e)) {
        if (!key.startsWith('_')) {
          allKeys.add(key);
        }
      }
    }

    const displayKeys = [...allKeys].slice(0, 8);

    const tableData = filteredEnodebs.map((e) => {
      const row = {
        _index: e._index,
        name: e._name,
        id: e._id || '—',
        status: e._status,
      };
      for (const key of displayKeys) {
        if (row[key] === undefined) {
          row[key] = e[key] !== undefined && e[key] !== null ? String(e[key]) : '—';
        }
      }
      return row;
    });

    const columns = [
      {
        key: 'name',
        label: 'eNodeB Name',
        sortable: true,
      },
      {
        key: 'id',
        label: 'ID',
        sortable: true,
        width: '6rem',
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        width: '8rem',
        render: (value) => renderStatusBadge(value),
      },
      ...displayKeys
        .filter((k) => k !== 'name' && k !== 'id' && k !== 'status')
        .slice(0, 5)
        .map((key) => ({
          key,
          label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          sortable: true,
        })),
    ];

    return (
      <DataTable
        data={tableData}
        columns={columns}
        pageSize={25}
        sortable={true}
        paginated={true}
        striped={true}
        compact={false}
        emptyMessage="No eNodeBs match the current filters"
        emptyIcon="∅"
        maxHeight="32rem"
        stickyHeader={true}
        showRowNumbers={true}
        onRowClick={(row) => handleEnodeBSelect(row._index)}
        rowKeyField="_index"
      />
    );
  };

  const renderEnodeBDetail = () => {
    if (selectedEnodeBIndex === null || !enrichedEnodebs[selectedEnodeBIndex]) {
      return (
        <div style={{
          background: theme.colors.background.tertiary,
          borderRadius: theme.borderRadius.lg,
          border: `1px solid ${theme.colors.border.light}`,
          padding: theme.spacing[6],
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.text.tertiary,
            margin: 0,
          }}>
            Select an eNodeB to view details
          </p>
        </div>
      );
    }

    const enodeb = enrichedEnodebs[selectedEnodeBIndex];
    const statusConfig = STATUS_CONFIG[enodeb._status] || STATUS_CONFIG[HC_STATUS.UNKNOWN];

    const detailKeys = Object.keys(enodeb).filter((k) => !k.startsWith('_'));

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
          background: statusConfig.background,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[2],
          }}>
            <div style={{
              width: '2rem',
              height: '2rem',
              borderRadius: theme.borderRadius.full,
              background: theme.colors.background.primary,
              color: statusConfig.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.bold,
              flexShrink: 0,
              border: statusConfig.border,
            }}>
              {statusConfig.icon}
            </div>
            <div>
              <p style={{
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold,
                color: theme.colors.text.primary,
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '14rem',
              }}>
                {enodeb._name}
              </p>
              <p style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.tertiary,
                margin: 0,
              }}>
                {enodeb._id ? `ID: ${enodeb._id}` : `eNodeB #${selectedEnodeBIndex + 1}`}
              </p>
            </div>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[1],
          }}>
            {renderStatusBadge(enodeb._status)}
            <button
              onClick={() => setSelectedEnodeBIndex(null)}
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
        </div>

        {/* Detail Fields */}
        <div style={{
          maxHeight: '24rem',
          overflowY: 'auto',
        }}>
          {detailKeys.map((key, idx) => {
            const value = enodeb[key];
            const displayValue = value === null || value === undefined
              ? '—'
              : typeof value === 'object'
                ? JSON.stringify(value)
                : String(value);

            return (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
                  background: idx % 2 === 0
                    ? theme.colors.background.primary
                    : theme.colors.background.tertiary,
                  borderBottom: idx < detailKeys.length - 1
                    ? `1px solid ${theme.colors.border.light}`
                    : 'none',
                  gap: theme.spacing[3],
                }}
              >
                <span style={{
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.medium,
                  color: theme.colors.text.tertiary,
                  minWidth: '8rem',
                  flexShrink: 0,
                  textTransform: 'capitalize',
                }}>
                  {key.replace(/_/g, ' ')}
                </span>
                <span style={{
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.text.primary,
                  wordBreak: 'break-word',
                  flex: 1,
                  minWidth: 0,
                  fontFamily: typeof value === 'number'
                    ? theme.typography.fontFamily.mono
                    : theme.typography.fontFamily.sans,
                }}>
                  {displayValue}
                </span>
              </div>
            );
          })}

          {detailKeys.length === 0 && (
            <div style={{
              padding: theme.spacing[6],
              textAlign: 'center',
            }}>
              <p style={{
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.text.tertiary,
                margin: 0,
              }}>
                No detail fields available
              </p>
            </div>
          )}
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
          message="Loading health check data..."
        />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        fontFamily: theme.typography.fontFamily.sans,
        ...style,
      }}>
        <ErrorMessage
          message={error}
          severity="error"
          title="Health Check Directory Error"
          onRetry={onRetry}
          onDismiss={onDismissError}
        />
      </div>
    );
  }

  if (allHCFiles.length === 0) {
    return (
      <div style={{
        fontFamily: theme.typography.fontFamily.sans,
        background: theme.components.card.background,
        border: theme.components.card.border,
        borderRadius: theme.components.card.borderRadius,
        padding: theme.spacing[8],
        boxShadow: theme.components.card.shadow,
        textAlign: 'center',
        ...style,
      }}>
        <div style={{
          width: '3.5rem',
          height: '3.5rem',
          borderRadius: theme.borderRadius.full,
          background: theme.colors.neutral[100],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto',
          marginBottom: theme.spacing[3],
        }}>
          <span style={{
            fontSize: theme.typography.fontSize['2xl'],
            color: theme.colors.text.tertiary,
            lineHeight: 1,
          }}>
            H
          </span>
        </div>
        <p style={{
          fontSize: theme.typography.fontSize.sm,
          fontWeight: theme.typography.fontWeight.medium,
          color: theme.colors.text.secondary,
          margin: 0,
          marginBottom: theme.spacing[1],
        }}>
          No health check data available
        </p>
        <p style={{
          fontSize: theme.typography.fontSize.xs,
          color: theme.colors.text.tertiary,
          margin: 0,
        }}>
          Upload and process a health check file (CSV, XLSX, XLS) to view eNodeB status details
        </p>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: theme.typography.fontFamily.sans,
      ...style,
    }}>
      {/* Main Layout: File List Sidebar + Content */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '16rem 1fr',
        gap: theme.spacing[4],
        alignItems: 'start',
      }}>
        {/* File List Sidebar */}
        <div style={{
          background: theme.components.card.background,
          border: theme.components.card.border,
          borderRadius: theme.components.card.borderRadius,
          boxShadow: theme.components.card.shadow,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
            borderBottom: `1px solid ${theme.colors.border.light}`,
          }}>
            <h3 style={{
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.semibold,
              color: theme.colors.text.primary,
              margin: 0,
              marginBottom: theme.spacing[1],
              lineHeight: theme.typography.lineHeight.tight,
            }}>
              HC Files
            </h3>
            <span style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.tertiary,
            }}>
              {allHCFiles.length} {allHCFiles.length === 1 ? 'file' : 'files'}
            </span>
          </div>
          <div style={{
            padding: theme.spacing[2],
            maxHeight: '32rem',
            overflowY: 'auto',
          }}>
            {renderFileList()}
          </div>
        </div>

        {/* Main Content */}
        <div>
          {/* Header */}
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
              <div>
                <h3 style={{
                  fontSize: theme.typography.fontSize.lg,
                  fontWeight: theme.typography.fontWeight.semibold,
                  color: theme.colors.text.primary,
                  margin: 0,
                  marginBottom: theme.spacing[1],
                  lineHeight: theme.typography.lineHeight.tight,
                }}>
                  Health Check Directory
                </h3>
                <p style={{
                  fontSize: theme.typography.fontSize.sm,
                  color: theme.colors.text.tertiary,
                  margin: 0,
                  lineHeight: theme.typography.lineHeight.normal,
                }}>
                  {selectedFile
                    ? `eNodeB health status from ${selectedFile.fileName}`
                    : 'Select a file to view eNodeB health details'}
                </p>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing[2],
                flexWrap: 'wrap',
              }}>
                {stats.totalEnodebs > 0 && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                    borderRadius: theme.borderRadius.full,
                    background: stats.healthRate >= 90
                      ? theme.colors.success[50]
                      : stats.healthRate >= 70
                        ? theme.colors.warning[50]
                        : theme.colors.error[50],
                    fontSize: theme.typography.fontSize.xs,
                    fontWeight: theme.typography.fontWeight.semibold,
                    color: stats.healthRate >= 90
                      ? theme.colors.success[700]
                      : stats.healthRate >= 70
                        ? theme.colors.warning[700]
                        : theme.colors.error[700],
                  }}>
                    {stats.healthRate}% Healthy
                  </span>
                )}

                <button
                  onClick={handleExportCSV}
                  disabled={filteredEnodebs.length === 0}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: theme.spacing[1],
                    background: theme.components.button.secondary.background,
                    color: filteredEnodebs.length === 0
                      ? theme.colors.text.disabled
                      : theme.colors.text.secondary,
                    border: theme.components.button.secondary.border,
                    borderRadius: theme.components.button.secondary.borderRadius,
                    padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
                    fontSize: theme.typography.fontSize.xs,
                    fontWeight: theme.components.button.secondary.fontWeight,
                    fontFamily: theme.typography.fontFamily.sans,
                    cursor: filteredEnodebs.length === 0 ? 'not-allowed' : 'pointer',
                    transition: theme.transitions.default,
                    whiteSpace: 'nowrap',
                    opacity: filteredEnodebs.length === 0 ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (filteredEnodebs.length > 0) {
                      e.currentTarget.style.background = theme.components.button.secondary.hoverBackground;
                      e.currentTarget.style.color = theme.colors.text.primary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (filteredEnodebs.length > 0) {
                      e.currentTarget.style.background = theme.components.button.secondary.background;
                      e.currentTarget.style.color = theme.colors.text.secondary;
                    }
                  }}
                >
                  ↓ Export CSV
                </button>
              </div>
            </div>

            {/* Filters and View Toggle */}
            {selectedFile && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                flexWrap: 'wrap',
                gap: theme.spacing[3],
              }}>
                {/* Filters */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing[3],
                  flexWrap: 'wrap',
                  flex: 1,
                  minWidth: 0,
                }}>
                  {/* Search */}
                  <div style={{ position: 'relative', flex: 1, minWidth: '10rem', maxWidth: '18rem' }}>
                    <input
                      type="text"
                      value={filterText}
                      onChange={handleFilterTextChange}
                      placeholder="Search eNodeBs..."
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        background: theme.components.input.background,
                        color: theme.components.input.color,
                        border: theme.components.input.border,
                        borderRadius: theme.components.input.borderRadius,
                        padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
                        paddingLeft: theme.spacing[8],
                        fontSize: theme.typography.fontSize.sm,
                        outline: 'none',
                        transition: theme.transitions.default,
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
                    <span style={{
                      position: 'absolute',
                      left: theme.spacing[3],
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: theme.colors.text.disabled,
                      fontSize: theme.typography.fontSize.sm,
                      pointerEvents: 'none',
                    }}>
                      ⌕
                    </span>
                  </div>

                  {/* Status Filter */}
                  <select
                    value={filterStatus}
                    onChange={handleStatusFilterChange}
                    style={{
                      background: theme.components.input.background,
                      color: theme.components.input.color,
                      border: theme.components.input.border,
                      borderRadius: theme.components.input.borderRadius,
                      padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
                      fontSize: theme.typography.fontSize.sm,
                      fontFamily: theme.typography.fontFamily.sans,
                      cursor: 'pointer',
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
                  >
                    {STATUS_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  {/* Clear Filters */}
                  {(filterText || filterStatus !== 'all') && (
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

                  {/* Filtered count */}
                  <span style={{
                    fontSize: theme.typography.fontSize.xs,
                    color: theme.colors.text.tertiary,
                    whiteSpace: 'nowrap',
                  }}>
                    {filteredEnodebs.length} of {enrichedEnodebs.length} eNodeBs
                  </span>
                </div>

                {/* View Toggle */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing[1],
                  background: theme.colors.background.tertiary,
                  borderRadius: theme.borderRadius.md,
                  padding: '2px',
                }}>
                  {[
                    { key: 'list', label: 'List', icon: '☰' },
                    { key: 'table', label: 'Table', icon: '⊞' },
                  ].map((mode) => {
                    const isActive = viewMode === mode.key;
                    return (
                      <button
                        key={mode.key}
                        onClick={() => handleViewModeChange(mode.key)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: theme.spacing[1],
                          background: isActive ? theme.colors.background.primary : 'transparent',
                          color: isActive ? theme.colors.primary[700] : theme.colors.text.tertiary,
                          border: 'none',
                          borderRadius: theme.borderRadius.md,
                          padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
                          fontSize: theme.typography.fontSize.xs,
                          fontWeight: isActive
                            ? theme.typography.fontWeight.semibold
                            : theme.typography.fontWeight.medium,
                          fontFamily: theme.typography.fontFamily.sans,
                          cursor: 'pointer',
                          transition: theme.transitions.default,
                          whiteSpace: 'nowrap',
                          boxShadow: isActive ? theme.shadows.sm : 'none',
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.color = theme.colors.text.secondary;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.color = theme.colors.text.tertiary;
                          }
                        }}
                      >
                        <span style={{ lineHeight: 1 }}>{mode.icon}</span>
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Stats Cards */}
          {selectedFile && renderStatsCards()}

          {/* Content Area */}
          {selectedFile ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: selectedEnodeBIndex !== null ? '1fr 20rem' : '1fr',
              gap: theme.spacing[4],
              alignItems: 'start',
            }}>
              {/* eNodeB List or Table */}
              <div style={{
                background: viewMode === 'table' ? 'transparent' : undefined,
              }}>
                {viewMode === 'list' ? renderListView() : renderTableView()}
              </div>

              {/* eNodeB Detail Panel */}
              {selectedEnodeBIndex !== null && (
                <div>
                  {renderEnodeBDetail()}
                </div>
              )}
            </div>
          ) : (
            <div style={{
              background: theme.components.card.background,
              border: theme.components.card.border,
              borderRadius: theme.components.card.borderRadius,
              padding: theme.spacing[8],
              boxShadow: theme.components.card.shadow,
              textAlign: 'center',
            }}>
              <p style={{
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.text.tertiary,
                margin: 0,
              }}>
                Select a health check file from the sidebar to view eNodeB details
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns: 16rem"] {
            grid-template-columns: 1fr !important;
          }
          div[style*="grid-template-columns: 1fr 20rem"] {
            grid-template-columns: 1fr !important;
          }
          div[style*="grid-template-columns: repeat(4"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
};

export default HealthCheckDirectory;