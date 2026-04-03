import { useState, useCallback, useEffect } from 'react';
import { useUpload } from '../../context/UploadContext';
import ProgressBar from './ProgressBar';
import theme from '../../config/theme';

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now - date;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffSeconds < 60) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

const mapUploadStatus = (status) => {
  switch (status) {
    case 'uploading':
      return 'uploading';
    case 'processing':
      return 'processing';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return 'idle';
  }
};

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'uploading', label: 'Uploading' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

const UploadStatusList = () => {
  const {
    getUploadsList,
    retry,
    clearResults,
    UPLOAD_STATES,
  } = useUpload();

  const [filter, setFilter] = useState('all');
  const [, setTick] = useState(0);

  // Force re-render periodically to update relative timestamps
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const uploadsList = getUploadsList();

  const filteredUploads = filter === 'all'
    ? uploadsList
    : uploadsList.filter((upload) => upload.status === filter);

  const summary = {
    total: uploadsList.length,
    uploading: uploadsList.filter((u) => u.status === UPLOAD_STATES.UPLOADING).length,
    processing: uploadsList.filter((u) => u.status === UPLOAD_STATES.PROCESSING).length,
    completed: uploadsList.filter((u) => u.status === UPLOAD_STATES.COMPLETED).length,
    failed: uploadsList.filter((u) => u.status === UPLOAD_STATES.FAILED).length,
  };

  const handleRetry = useCallback(async (fileId) => {
    await retry(fileId);
  }, [retry]);

  const handleRemove = useCallback((fileId) => {
    clearResults(fileId);
  }, [clearResults]);

  const handleClearAll = useCallback(() => {
    const terminalUploads = uploadsList.filter(
      (u) => u.status === UPLOAD_STATES.COMPLETED || u.status === UPLOAD_STATES.FAILED
    );
    for (const upload of terminalUploads) {
      clearResults(upload.fileId);
    }
  }, [uploadsList, clearResults, UPLOAD_STATES]);

  const handleFilterChange = useCallback((newFilter) => {
    setFilter(newFilter);
  }, []);

  if (uploadsList.length === 0) {
    return (
      <div style={{
        fontFamily: theme.typography.fontFamily.sans,
        background: theme.components.card.background,
        border: theme.components.card.border,
        borderRadius: theme.components.card.borderRadius,
        padding: theme.components.card.padding,
        boxShadow: theme.components.card.shadow,
        textAlign: 'center',
      }}>
        <div style={{
          padding: theme.spacing[8],
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
              ↑
            </span>
          </div>
          <p style={{
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.medium,
            color: theme.colors.text.secondary,
            margin: 0,
            marginBottom: theme.spacing[1],
          }}>
            No uploads yet
          </p>
          <p style={{
            fontSize: theme.typography.fontSize.xs,
            color: theme.colors.text.tertiary,
            margin: 0,
          }}>
            Upload a document to see its status here
          </p>
        </div>
      </div>
    );
  }

  const hasTerminalUploads = summary.completed > 0 || summary.failed > 0;

  return (
    <div style={{
      fontFamily: theme.typography.fontFamily.sans,
    }}>
      {/* Summary Bar */}
      <div style={{
        background: theme.components.card.background,
        border: theme.components.card.border,
        borderRadius: theme.components.card.borderRadius,
        padding: theme.spacing[4],
        boxShadow: theme.components.card.shadow,
        marginBottom: theme.spacing[4],
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: theme.spacing[3],
        }}>
          {/* Summary Counts */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[3],
            flexWrap: 'wrap',
          }}>
            <span style={{
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.semibold,
              color: theme.colors.text.primary,
            }}>
              Uploads
            </span>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing[2],
            }}>
              {/* Total */}
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: theme.spacing[1],
                padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                borderRadius: theme.borderRadius.full,
                background: theme.colors.neutral[100],
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.text.secondary,
              }}>
                Total: {summary.total}
              </span>

              {/* Uploading */}
              {summary.uploading > 0 && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: theme.spacing[1],
                  padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                  borderRadius: theme.borderRadius.full,
                  background: theme.components.badge.processing.background,
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.medium,
                  color: theme.components.badge.processing.color,
                }}>
                  ↑ {summary.uploading}
                </span>
              )}

              {/* Processing */}
              {summary.processing > 0 && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: theme.spacing[1],
                  padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                  borderRadius: theme.borderRadius.full,
                  background: theme.colors.info[50],
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.medium,
                  color: theme.colors.info[700],
                }}>
                  ⟳ {summary.processing}
                </span>
              )}

              {/* Completed */}
              {summary.completed > 0 && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: theme.spacing[1],
                  padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                  borderRadius: theme.borderRadius.full,
                  background: theme.components.badge.completed.background,
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.medium,
                  color: theme.components.badge.completed.color,
                }}>
                  ✓ {summary.completed}
                </span>
              )}

              {/* Failed */}
              {summary.failed > 0 && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: theme.spacing[1],
                  padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                  borderRadius: theme.borderRadius.full,
                  background: theme.components.badge.failed.background,
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.medium,
                  color: theme.components.badge.failed.color,
                }}>
                  ✕ {summary.failed}
                </span>
              )}
            </div>
          </div>

          {/* Clear Completed Button */}
          {hasTerminalUploads && (
            <button
              onClick={handleClearAll}
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
              Clear completed
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing[1],
          marginTop: theme.spacing[3],
          borderTop: `1px solid ${theme.colors.border.light}`,
          paddingTop: theme.spacing[3],
          overflowX: 'auto',
        }}>
          {STATUS_FILTER_OPTIONS.map((option) => {
            const isActive = filter === option.value;
            let count = 0;
            if (option.value === 'all') count = summary.total;
            else if (option.value === 'uploading') count = summary.uploading;
            else if (option.value === 'processing') count = summary.processing;
            else if (option.value === 'completed') count = summary.completed;
            else if (option.value === 'failed') count = summary.failed;

            if (option.value !== 'all' && count === 0) return null;

            return (
              <button
                key={option.value}
                onClick={() => handleFilterChange(option.value)}
                style={{
                  background: isActive ? theme.colors.primary[50] : 'transparent',
                  color: isActive ? theme.colors.primary[700] : theme.colors.text.secondary,
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
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: theme.spacing[1],
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = theme.colors.neutral[100];
                    e.currentTarget.style.color = theme.colors.text.primary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = theme.colors.text.secondary;
                  }
                }}
              >
                {option.label}
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '1.125rem',
                  height: '1.125rem',
                  padding: `0 ${theme.spacing[1]}`,
                  borderRadius: theme.borderRadius.full,
                  background: isActive ? theme.colors.primary[100] : theme.colors.neutral[200],
                  color: isActive ? theme.colors.primary[700] : theme.colors.text.tertiary,
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.semibold,
                  lineHeight: 1,
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Upload Items */}
      {filteredUploads.length === 0 ? (
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
            No uploads match the selected filter
          </p>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing[3],
        }}>
          {filteredUploads.map((upload) => {
            const progressStatus = mapUploadStatus(upload.status);
            const isTerminal = upload.status === UPLOAD_STATES.COMPLETED || upload.status === UPLOAD_STATES.FAILED;
            const isFailed = upload.status === UPLOAD_STATES.FAILED;

            return (
              <div
                key={upload.fileId}
                style={{
                  background: theme.components.card.background,
                  border: isFailed
                    ? `1px solid ${theme.colors.error[200]}`
                    : theme.components.card.border,
                  borderRadius: theme.components.card.borderRadius,
                  padding: theme.spacing[4],
                  boxShadow: theme.components.card.shadow,
                  transition: theme.transitions.default,
                }}
              >
                {/* File Info Row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: theme.spacing[3],
                  marginBottom: theme.spacing[3],
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: theme.spacing[3],
                    flex: 1,
                    minWidth: 0,
                  }}>
                    {/* File Type Icon */}
                    <div style={{
                      width: '2.25rem',
                      height: '2.25rem',
                      borderRadius: theme.borderRadius.lg,
                      background: isFailed
                        ? theme.colors.error[50]
                        : upload.status === UPLOAD_STATES.COMPLETED
                          ? theme.colors.success[50]
                          : theme.colors.primary[50],
                      color: isFailed
                        ? theme.colors.error[700]
                        : upload.status === UPLOAD_STATES.COMPLETED
                          ? theme.colors.success[700]
                          : theme.colors.primary[700],
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: theme.typography.fontSize.xs,
                      fontWeight: theme.typography.fontWeight.bold,
                      fontFamily: theme.typography.fontFamily.mono,
                      flexShrink: 0,
                      textTransform: 'uppercase',
                    }}>
                      {upload.file_type
                        ? upload.file_type.split('/').pop().substring(0, 3)
                        : '?'}
                    </div>

                    {/* File Details */}
                    <div style={{
                      flex: 1,
                      minWidth: 0,
                    }}>
                      <p style={{
                        fontSize: theme.typography.fontSize.sm,
                        fontWeight: theme.typography.fontWeight.medium,
                        color: theme.colors.text.primary,
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {upload.file_name || 'Unknown file'}
                      </p>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: theme.spacing[2],
                        marginTop: '2px',
                      }}>
                        {upload.file_size > 0 && (
                          <span style={{
                            fontSize: theme.typography.fontSize.xs,
                            color: theme.colors.text.tertiary,
                          }}>
                            {formatFileSize(upload.file_size)}
                          </span>
                        )}
                        {upload.file_size > 0 && (upload.created_at || upload.updated_at) && (
                          <span style={{
                            fontSize: theme.typography.fontSize.xs,
                            color: theme.colors.text.disabled,
                          }}>
                            •
                          </span>
                        )}
                        {(upload.created_at || upload.updated_at) && (
                          <span style={{
                            fontSize: theme.typography.fontSize.xs,
                            color: theme.colors.text.tertiary,
                          }}>
                            {formatTimestamp(upload.updated_at || upload.created_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Upload ID Badge */}
                  {upload.upload_id && (
                    <span style={{
                      display: 'inline-block',
                      padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                      background: theme.colors.neutral[100],
                      color: theme.colors.text.tertiary,
                      borderRadius: theme.borderRadius.md,
                      fontSize: theme.typography.fontSize.xs,
                      fontFamily: theme.typography.fontFamily.mono,
                      flexShrink: 0,
                      maxWidth: '8rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={upload.upload_id}
                    >
                      {upload.upload_id.substring(0, 8)}…
                    </span>
                  )}
                </div>

                {/* Progress Bar */}
                <ProgressBar
                  progress={upload.progress || 0}
                  status={progressStatus}
                  fileName={null}
                  fileSize={null}
                  error={upload.error || null}
                  showPercentage={true}
                  showStatus={true}
                  showFileName={false}
                  animated={true}
                  compact={false}
                  onRetry={isFailed ? () => handleRetry(upload.fileId) : null}
                  onRemove={isTerminal ? () => handleRemove(upload.fileId) : null}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UploadStatusList;