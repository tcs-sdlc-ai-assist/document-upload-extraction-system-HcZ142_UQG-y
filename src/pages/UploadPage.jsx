import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUpload } from '../context/UploadContext';
import Layout from '../components/layout/Layout';
import FileDropzone from '../components/upload/FileDropzone';
import UploadStatusList from '../components/upload/UploadStatusList';
import ExtractionResultView from '../components/extraction/ExtractionResultView';
import ErrorMessage from '../components/common/ErrorMessage';
import LoadingSpinner from '../components/common/LoadingSpinner';
import documentService from '../services/documentService';
import theme from '../config/theme';

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatTimestamp = (timestamp) => {
  if (!timestamp) return '—';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '—';
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
    return '—';
  }
};

const STATUS_BADGE_CONFIG = {
  pending: {
    background: theme.components.badge.pending.background,
    color: theme.components.badge.pending.color,
    icon: '○',
    label: 'Pending',
  },
  processing: {
    background: theme.components.badge.processing.background,
    color: theme.components.badge.processing.color,
    icon: '⟳',
    label: 'Processing',
  },
  completed: {
    background: theme.components.badge.completed.background,
    color: theme.components.badge.completed.color,
    icon: '✓',
    label: 'Completed',
  },
  failed: {
    background: theme.components.badge.failed.background,
    color: theme.components.badge.failed.color,
    icon: '✕',
    label: 'Failed',
  },
};

const UploadPage = () => {
  const { user } = useAuth();
  const { results, queue, uploads, getUploadsList, UPLOAD_STATES } = useUpload();

  const [recentUploads, setRecentUploads] = useState([]);
  const [isLoadingUploads, setIsLoadingUploads] = useState(true);
  const [uploadsError, setUploadsError] = useState(null);
  const [selectedUploadId, setSelectedUploadId] = useState(null);
  const [selectedResult, setSelectedResult] = useState(null);
  const [isLoadingResult, setIsLoadingResult] = useState(false);
  const [resultError, setResultError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUploads, setTotalUploads] = useState(0);
  const [pageSize] = useState(10);

  const fetchRecentUploads = useCallback(async (page = 1) => {
    setIsLoadingUploads(true);
    setUploadsError(null);

    try {
      const filters = {
        page,
        page_size: pageSize,
        sort_by: 'created_at',
        sort_order: 'DESC',
      };

      if (filterStatus !== 'all') {
        filters.status = filterStatus;
      }

      const response = await documentService.listUploads(filters);

      if (response.success && response.data) {
        setRecentUploads(response.data.uploads || []);
        setTotalUploads(response.data.total || 0);
        setCurrentPage(response.data.page || page);
      } else {
        setUploadsError(response.message || 'Failed to load uploads.');
        setRecentUploads([]);
        setTotalUploads(0);
      }
    } catch (err) {
      setUploadsError(err.message || 'An unexpected error occurred while loading uploads.');
      setRecentUploads([]);
      setTotalUploads(0);
    } finally {
      setIsLoadingUploads(false);
    }
  }, [filterStatus, pageSize]);

  useEffect(() => {
    fetchRecentUploads(1);
  }, [fetchRecentUploads]);

  const activeUploads = useMemo(() => {
    return getUploadsList().filter(
      (u) => u.status === UPLOAD_STATES.UPLOADING || u.status === UPLOAD_STATES.PROCESSING
    );
  }, [getUploadsList, UPLOAD_STATES]);

  const completedContextResults = useMemo(() => {
    const completed = [];
    if (results && queue) {
      for (const fileId of queue) {
        const result = results[fileId];
        const upload = uploads[fileId];
        if (result && upload && upload.status === UPLOAD_STATES.COMPLETED) {
          completed.push({
            fileId,
            result,
            upload,
          });
        }
      }
    }
    return completed;
  }, [results, queue, uploads, UPLOAD_STATES]);

  const handleViewResult = useCallback(async (uploadId) => {
    if (selectedUploadId === uploadId) {
      setSelectedUploadId(null);
      setSelectedResult(null);
      setResultError(null);
      return;
    }

    setSelectedUploadId(uploadId);
    setSelectedResult(null);
    setResultError(null);
    setIsLoadingResult(true);

    try {
      const response = await documentService.getExtractionResult(uploadId);

      if (response.success && response.data) {
        setSelectedResult(response.data);
      } else {
        setResultError(response.message || 'Failed to load extraction result.');
      }
    } catch (err) {
      setResultError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoadingResult(false);
    }
  }, [selectedUploadId]);

  const handleCloseResult = useCallback(() => {
    setSelectedUploadId(null);
    setSelectedResult(null);
    setResultError(null);
  }, []);

  const handleRetryUploads = useCallback(() => {
    fetchRecentUploads(currentPage);
  }, [fetchRecentUploads, currentPage]);

  const handleDismissUploadsError = useCallback(() => {
    setUploadsError(null);
  }, []);

  const handleFilterChange = useCallback((newFilter) => {
    setFilterStatus(newFilter);
    setCurrentPage(1);
    setSelectedUploadId(null);
    setSelectedResult(null);
    setResultError(null);
  }, []);

  const handlePageChange = useCallback((page) => {
    fetchRecentUploads(page);
  }, [fetchRecentUploads]);

  const handleDeleteDocument = useCallback(async (uploadId) => {
    if (!uploadId) return;

    try {
      const response = await documentService.deleteDocument(uploadId);

      if (response.success) {
        if (selectedUploadId === uploadId) {
          setSelectedUploadId(null);
          setSelectedResult(null);
          setResultError(null);
        }
        fetchRecentUploads(currentPage);
      }
    } catch {
      // silent fail, user can retry
    }
  }, [selectedUploadId, fetchRecentUploads, currentPage]);

  const totalPages = Math.max(1, Math.ceil(totalUploads / pageSize));

  const renderStatusBadge = (status) => {
    const config = STATUS_BADGE_CONFIG[status] || STATUS_BADGE_CONFIG.pending;
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
  };

  const FILTER_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'processing', label: 'Processing' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
  ];

  const renderActiveUploadsBanner = () => {
    if (activeUploads.length === 0) return null;

    return (
      <div style={{
        marginBottom: theme.spacing[6],
      }}>
        <div style={{
          background: theme.colors.info[50],
          border: `1px solid ${theme.colors.info[200]}`,
          borderRadius: theme.components.card.borderRadius,
          padding: theme.spacing[4],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing[3],
          flexWrap: 'wrap',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[3],
          }}>
            <span style={{
              display: 'inline-block',
              width: '0.875rem',
              height: '0.875rem',
              border: `2px solid ${theme.colors.info[200]}`,
              borderTopColor: theme.colors.info[600],
              borderRadius: '50%',
              animation: 'uploadPageSpin 0.8s linear infinite',
            }} />
            <div>
              <p style={{
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold,
                color: theme.colors.info[800],
                margin: 0,
              }}>
                {activeUploads.length} {activeUploads.length === 1 ? 'upload' : 'uploads'} in progress
              </p>
              <p style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.info[600],
                margin: 0,
                marginTop: '2px',
              }}>
                {activeUploads.map((u) => u.file_name).filter(Boolean).join(', ') || 'Processing files...'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderUploadSection = () => (
    <div style={{
      background: theme.components.card.background,
      border: theme.components.card.border,
      borderRadius: theme.components.card.borderRadius,
      boxShadow: theme.components.card.shadow,
      marginBottom: theme.spacing[6],
      overflow: 'hidden',
    }}>
      <div style={{
        padding: `${theme.spacing[4]} ${theme.spacing[4]} ${theme.spacing[3]}`,
        borderBottom: `1px solid ${theme.colors.border.light}`,
      }}>
        <h3 style={{
          fontSize: theme.typography.fontSize.lg,
          fontWeight: theme.typography.fontWeight.semibold,
          color: theme.colors.text.primary,
          margin: 0,
          marginBottom: theme.spacing[1],
          lineHeight: theme.typography.lineHeight.tight,
        }}>
          Upload Documents
        </h3>
        <p style={{
          fontSize: theme.typography.fontSize.sm,
          color: theme.colors.text.tertiary,
          margin: 0,
        }}>
          Drag and drop files or browse to upload documents for data extraction
        </p>
      </div>
      <div style={{ padding: theme.spacing[4] }}>
        <FileDropzone />
      </div>
    </div>
  );

  const renderUploadQueue = () => {
    const uploadsList = getUploadsList();
    if (uploadsList.length === 0) return null;

    return (
      <div style={{ marginBottom: theme.spacing[6] }}>
        <h3 style={{
          fontSize: theme.typography.fontSize.lg,
          fontWeight: theme.typography.fontWeight.semibold,
          color: theme.colors.text.primary,
          margin: 0,
          marginBottom: theme.spacing[3],
          lineHeight: theme.typography.lineHeight.tight,
        }}>
          Upload Queue
        </h3>
        <UploadStatusList />
      </div>
    );
  };

  const renderRecentResults = () => {
    if (completedContextResults.length === 0) return null;

    return (
      <div style={{ marginBottom: theme.spacing[6] }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: theme.spacing[3],
        }}>
          <h3 style={{
            fontSize: theme.typography.fontSize.lg,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.text.primary,
            margin: 0,
            lineHeight: theme.typography.lineHeight.tight,
          }}>
            Recent Extraction Results
          </h3>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
            borderRadius: theme.borderRadius.full,
            background: theme.colors.success[50],
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.medium,
            color: theme.colors.success[700],
          }}>
            {completedContextResults.length} {completedContextResults.length === 1 ? 'result' : 'results'}
          </span>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing[4],
        }}>
          {completedContextResults.slice(0, 3).map(({ fileId, result }) => (
            <ExtractionResultView
              key={fileId}
              result={result}
            />
          ))}
        </div>
      </div>
    );
  };

  const renderUploadsHistory = () => {
    if (isLoadingUploads && recentUploads.length === 0) {
      return (
        <div style={{
          background: theme.components.card.background,
          border: theme.components.card.border,
          borderRadius: theme.components.card.borderRadius,
          padding: theme.spacing[8],
          boxShadow: theme.components.card.shadow,
          marginBottom: theme.spacing[6],
        }}>
          <LoadingSpinner size="md" message="Loading upload history..." />
        </div>
      );
    }

    if (uploadsError) {
      return (
        <div style={{ marginBottom: theme.spacing[6] }}>
          <ErrorMessage
            message={uploadsError}
            severity="error"
            title="Failed to Load Upload History"
            onRetry={handleRetryUploads}
            onDismiss={handleDismissUploadsError}
          />
        </div>
      );
    }

    return (
      <div style={{
        background: theme.components.card.background,
        border: theme.components.card.border,
        borderRadius: theme.components.card.borderRadius,
        boxShadow: theme.components.card.shadow,
        marginBottom: theme.spacing[6],
        overflow: 'hidden',
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
            <h3 style={{
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.semibold,
              color: theme.colors.text.primary,
              margin: 0,
              marginBottom: theme.spacing[1],
              lineHeight: theme.typography.lineHeight.tight,
            }}>
              Upload History
            </h3>
            <p style={{
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.text.tertiary,
              margin: 0,
            }}>
              All your uploaded documents and their extraction status
            </p>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[2],
          }}>
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
              {totalUploads} {totalUploads === 1 ? 'file' : 'files'}
            </span>
            <button
              onClick={handleRetryUploads}
              disabled={isLoadingUploads}
              style={{
                background: 'transparent',
                border: 'none',
                color: isLoadingUploads ? theme.colors.text.disabled : theme.colors.text.tertiary,
                fontSize: theme.typography.fontSize.sm,
                cursor: isLoadingUploads ? 'not-allowed' : 'pointer',
                padding: theme.spacing[1],
                borderRadius: theme.borderRadius.md,
                transition: theme.transitions.default,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '1.75rem',
                height: '1.75rem',
                lineHeight: 1,
                opacity: isLoadingUploads ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isLoadingUploads) {
                  e.currentTarget.style.background = theme.colors.neutral[100];
                  e.currentTarget.style.color = theme.colors.text.primary;
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoadingUploads) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = theme.colors.text.tertiary;
                }
              }}
              title="Refresh"
            >
              ⟳
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing[1],
          padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
          borderBottom: `1px solid ${theme.colors.border.light}`,
          overflowX: 'auto',
          background: theme.colors.background.secondary,
        }}>
          {FILTER_OPTIONS.map((option) => {
            const isActive = filterStatus === option.value;
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
              </button>
            );
          })}
        </div>

        {/* Loading indicator */}
        {isLoadingUploads && recentUploads.length > 0 && (
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
              animation: 'uploadPageSpin 0.8s linear infinite',
            }} />
            <span style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.info[700],
            }}>
              Refreshing uploads...
            </span>
          </div>
        )}

        {/* Upload List */}
        {recentUploads.length === 0 ? (
          <div style={{
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
              fontWeight: theme.typography.fontWeight.medium,
              color: theme.colors.text.secondary,
              margin: 0,
              marginBottom: theme.spacing[1],
            }}>
              {filterStatus === 'all'
                ? 'No uploads yet'
                : `No ${filterStatus} uploads found`}
            </p>
            <p style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.tertiary,
              margin: 0,
            }}>
              {filterStatus === 'all'
                ? 'Upload a document above to get started'
                : 'Try changing the filter to see other uploads'}
            </p>
          </div>
        ) : (
          <div>
            {recentUploads.map((upload, idx) => {
              const isSelected = selectedUploadId === upload.upload_id;
              const isCompleted = upload.status === 'completed';
              const isFailed = upload.status === 'failed';

              return (
                <div
                  key={upload.upload_id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: theme.spacing[3],
                    padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                    borderBottom: idx < recentUploads.length - 1
                      ? `1px solid ${theme.colors.border.light}`
                      : 'none',
                    background: isSelected
                      ? theme.colors.primary[50]
                      : idx % 2 === 0
                        ? theme.colors.background.primary
                        : theme.colors.neutral[50],
                    cursor: isCompleted ? 'pointer' : 'default',
                    transition: theme.transitions.fast,
                  }}
                  onClick={isCompleted ? () => handleViewResult(upload.upload_id) : undefined}
                  onMouseEnter={(e) => {
                    if (isCompleted && !isSelected) {
                      e.currentTarget.style.background = theme.colors.neutral[100];
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (isCompleted && !isSelected) {
                      e.currentTarget.style.background = idx % 2 === 0
                        ? theme.colors.background.primary
                        : theme.colors.neutral[50];
                    }
                  }}
                >
                  {/* File Type Icon */}
                  <div style={{
                    width: '2.25rem',
                    height: '2.25rem',
                    borderRadius: theme.borderRadius.lg,
                    background: isFailed
                      ? theme.colors.error[50]
                      : isCompleted
                        ? theme.colors.success[50]
                        : theme.colors.primary[50],
                    color: isFailed
                      ? theme.colors.error[700]
                      : isCompleted
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
                    {upload.filetype ? upload.filetype.substring(0, 3) : '?'}
                  </div>

                  {/* File Info */}
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
                      {upload.filetype && (
                        <span style={{
                          display: 'inline-block',
                          padding: `0 ${theme.spacing[2]}`,
                          background: theme.colors.neutral[100],
                          color: theme.colors.text.tertiary,
                          borderRadius: theme.borderRadius.md,
                          fontSize: theme.typography.fontSize.xs,
                          fontWeight: theme.typography.fontWeight.medium,
                          fontFamily: theme.typography.fontFamily.mono,
                          textTransform: 'uppercase',
                          lineHeight: '1.5',
                        }}>
                          {upload.filetype}
                        </span>
                      )}
                      {upload.size > 0 && (
                        <span style={{
                          fontSize: theme.typography.fontSize.xs,
                          color: theme.colors.text.tertiary,
                        }}>
                          {formatFileSize(upload.size)}
                        </span>
                      )}
                      {upload.created_at && (
                        <>
                          <span style={{
                            fontSize: theme.typography.fontSize.xs,
                            color: theme.colors.text.disabled,
                          }}>
                            •
                          </span>
                          <span style={{
                            fontSize: theme.typography.fontSize.xs,
                            color: theme.colors.text.tertiary,
                          }}>
                            {formatTimestamp(upload.created_at)}
                          </span>
                        </>
                      )}
                    </div>
                    {/* Error message for failed uploads */}
                    {isFailed && upload.error && (
                      <p style={{
                        fontSize: theme.typography.fontSize.xs,
                        color: theme.colors.error[600],
                        margin: 0,
                        marginTop: theme.spacing[1],
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {upload.error}
                      </p>
                    )}
                  </div>

                  {/* Status Badge */}
                  {renderStatusBadge(upload.status)}

                  {/* Actions */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: theme.spacing[1],
                    flexShrink: 0,
                  }}>
                    {/* View Result Arrow */}
                    {isCompleted && (
                      <span style={{
                        fontSize: theme.typography.fontSize.sm,
                        color: isSelected ? theme.colors.primary[600] : theme.colors.text.disabled,
                        flexShrink: 0,
                        transition: theme.transitions.default,
                      }}>
                        {isSelected ? '▼' : '▶'}
                      </span>
                    )}

                    {/* Delete button for terminal states */}
                    {(isCompleted || isFailed) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDocument(upload.upload_id);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: theme.colors.text.disabled,
                          fontSize: theme.typography.fontSize.sm,
                          cursor: 'pointer',
                          padding: theme.spacing[1],
                          borderRadius: theme.borderRadius.md,
                          transition: theme.transitions.default,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '1.5rem',
                          height: '1.5rem',
                          lineHeight: 1,
                          flexShrink: 0,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = theme.colors.error[50];
                          e.currentTarget.style.color = theme.colors.error[600];
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = theme.colors.text.disabled;
                        }}
                        title="Delete upload"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
            borderTop: `1px solid ${theme.colors.border.light}`,
            background: theme.colors.background.primary,
            flexWrap: 'wrap',
            gap: theme.spacing[3],
          }}>
            <span style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.tertiary,
              whiteSpace: 'nowrap',
            }}>
              Page {currentPage} of {totalPages} ({totalUploads} total)
            </span>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing[1],
            }}>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderRadius: theme.borderRadius.md,
                  padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                  fontSize: theme.typography.fontSize.xs,
                  fontFamily: theme.typography.fontFamily.sans,
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                  color: currentPage <= 1 ? theme.colors.text.disabled : theme.colors.text.secondary,
                  opacity: currentPage <= 1 ? 0.5 : 1,
                  transition: theme.transitions.default,
                  minWidth: '2rem',
                  height: '2rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={(e) => {
                  if (currentPage > 1) {
                    e.currentTarget.style.background = theme.colors.neutral[100];
                    e.currentTarget.style.color = theme.colors.text.primary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPage > 1) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = theme.colors.text.secondary;
                  }
                }}
                aria-label="Previous page"
              >
                ‹
              </button>

              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else {
                  let start = Math.max(1, currentPage - 2);
                  const end = Math.min(totalPages, start + 4);
                  if (end - start < 4) {
                    start = Math.max(1, end - 4);
                  }
                  pageNum = start + i;
                }

                if (pageNum > totalPages) return null;

                const isActive = pageNum === currentPage;
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    style={{
                      background: isActive ? theme.colors.primary[50] : 'transparent',
                      border: 'none',
                      borderRadius: theme.borderRadius.md,
                      padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                      fontSize: theme.typography.fontSize.xs,
                      fontFamily: theme.typography.fontFamily.sans,
                      fontWeight: isActive ? theme.typography.fontWeight.semibold : theme.typography.fontWeight.medium,
                      cursor: 'pointer',
                      color: isActive ? theme.colors.primary[700] : theme.colors.text.secondary,
                      transition: theme.transitions.default,
                      minWidth: '2rem',
                      height: '2rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
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
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderRadius: theme.borderRadius.md,
                  padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                  fontSize: theme.typography.fontSize.xs,
                  fontFamily: theme.typography.fontFamily.sans,
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  color: currentPage >= totalPages ? theme.colors.text.disabled : theme.colors.text.secondary,
                  opacity: currentPage >= totalPages ? 0.5 : 1,
                  transition: theme.transitions.default,
                  minWidth: '2rem',
                  height: '2rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={(e) => {
                  if (currentPage < totalPages) {
                    e.currentTarget.style.background = theme.colors.neutral[100];
                    e.currentTarget.style.color = theme.colors.text.primary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPage < totalPages) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = theme.colors.text.secondary;
                  }
                }}
                aria-label="Next page"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSelectedResult = () => {
    if (!selectedUploadId) return null;

    if (isLoadingResult) {
      return (
        <div style={{ marginBottom: theme.spacing[6] }}>
          <div style={{
            background: theme.components.card.background,
            border: theme.components.card.border,
            borderRadius: theme.components.card.borderRadius,
            padding: theme.spacing[6],
            boxShadow: theme.components.card.shadow,
          }}>
            <LoadingSpinner size="md" message="Loading extraction result..." />
          </div>
        </div>
      );
    }

    if (resultError) {
      return (
        <div style={{ marginBottom: theme.spacing[6] }}>
          <ErrorMessage
            message={resultError}
            severity="error"
            title="Extraction Result Error"
            onRetry={() => handleViewResult(selectedUploadId)}
            onDismiss={handleCloseResult}
          />
        </div>
      );
    }

    if (selectedResult) {
      return (
        <div style={{ marginBottom: theme.spacing[6] }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: theme.spacing[3],
          }}>
            <span style={{
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.semibold,
              color: theme.colors.text.primary,
            }}>
              Extraction Result
            </span>
            <button
              onClick={handleCloseResult}
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
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = theme.colors.text.primary;
                e.currentTarget.style.background = theme.colors.neutral[100];
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = theme.colors.text.tertiary;
                e.currentTarget.style.background = 'transparent';
              }}
            >
              ✕ Close
            </button>
          </div>
          <ExtractionResultView result={selectedResult} />
        </div>
      );
    }

    return null;
  };

  return (
    <Layout>
      {/* Page Header */}
      <div style={{
        marginBottom: theme.spacing[6],
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: theme.spacing[3],
        }}>
          <div>
            <h1 style={{
              fontSize: theme.typography.fontSize['2xl'],
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.text.primary,
              margin: 0,
              marginBottom: theme.spacing[1],
              lineHeight: theme.typography.lineHeight.tight,
            }}>
              Document Upload
            </h1>
            <p style={{
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.text.tertiary,
              margin: 0,
            }}>
              Upload documents for automated data extraction and processing
            </p>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[2],
          }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: theme.spacing[1],
              padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
              borderRadius: theme.borderRadius.full,
              background: theme.colors.neutral[100],
              fontSize: theme.typography.fontSize.xs,
              fontWeight: theme.typography.fontWeight.medium,
              color: theme.colors.text.tertiary,
            }}>
              Supported: PDF, CSV, XML, XLSX, XLS, DOCX, KML, TXT
            </span>
          </div>
        </div>
      </div>

      {/* Active Uploads Banner */}
      {renderActiveUploadsBanner()}

      {/* Upload Section */}
      {renderUploadSection()}

      {/* Upload Queue */}
      {renderUploadQueue()}

      {/* Recent Extraction Results from Context */}
      {renderRecentResults()}

      {/* Selected Result Detail */}
      {renderSelectedResult()}

      {/* Upload History */}
      {renderUploadsHistory()}

      <style>{`
        @keyframes uploadPageSpin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          div[style*="grid-template-columns: repeat(4"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </Layout>
  );
};

export default UploadPage;