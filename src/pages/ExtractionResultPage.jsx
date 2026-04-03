import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/layout/Layout';
import ExtractionResultView from '../components/extraction/ExtractionResultView';
import ErrorMessage from '../components/common/ErrorMessage';
import LoadingSpinner from '../components/common/LoadingSpinner';
import documentService from '../services/documentService';
import theme from '../config/theme';

const getUploadIdFromUrl = () => {
  const path = window.location.pathname;
  const parts = path.split('/');
  const resultIndex = parts.indexOf('result');
  if (resultIndex !== -1 && resultIndex + 1 < parts.length) {
    return parts[resultIndex + 1];
  }
  const extractionIndex = parts.indexOf('extraction');
  if (extractionIndex !== -1 && extractionIndex + 1 < parts.length) {
    return parts[extractionIndex + 1];
  }
  if (parts.length >= 2) {
    return parts[parts.length - 1] || null;
  }
  return null;
};

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
    return date.toLocaleString(undefined, {
      year: 'numeric',
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

const ExtractionResultPage = () => {
  const { user } = useAuth();

  const [uploadId] = useState(() => getUploadIdFromUrl());
  const [result, setResult] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [error, setError] = useState(null);
  const [statusError, setStatusError] = useState(null);

  const fetchUploadStatus = useCallback(async () => {
    if (!uploadId) return;

    setIsLoadingStatus(true);
    setStatusError(null);

    try {
      const response = await documentService.getUploadStatus(uploadId);

      if (response.success && response.data) {
        setUploadStatus(response.data);
      } else {
        setStatusError(response.message || 'Failed to load upload status.');
      }
    } catch (err) {
      setStatusError(err.message || 'An unexpected error occurred while loading upload status.');
    } finally {
      setIsLoadingStatus(false);
    }
  }, [uploadId]);

  const fetchResult = useCallback(async () => {
    if (!uploadId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await documentService.getExtractionResult(uploadId);

      if (response.success && response.data) {
        setResult(response.data);
      } else {
        const errorMsg = response.message || 'Failed to load extraction result.';
        setError(errorMsg);
      }
    } catch (err) {
      const errorMsg = err.message || 'An unexpected error occurred while loading extraction result.';
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [uploadId]);

  useEffect(() => {
    if (!uploadId) {
      setIsLoading(false);
      setIsLoadingStatus(false);
      setError('No upload ID provided. Please navigate to a valid extraction result.');
      return;
    }

    fetchUploadStatus();
    fetchResult();
  }, [uploadId, fetchUploadStatus, fetchResult]);

  const handleRetry = useCallback(() => {
    fetchResult();
    fetchUploadStatus();
  }, [fetchResult, fetchUploadStatus]);

  const handleDismissError = useCallback(() => {
    setError(null);
  }, []);

  const handleNavigateBack = useCallback(() => {
    window.location.href = '/upload';
  }, []);

  const handleNavigateDashboard = useCallback(() => {
    window.location.href = '/dashboard';
  }, []);

  const handleDeleteDocument = useCallback(async () => {
    if (!uploadId) return;

    try {
      const response = await documentService.deleteDocument(uploadId);

      if (response.success) {
        window.location.href = '/upload';
      }
    } catch {
      // silent fail
    }
  }, [uploadId]);

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

  const renderBreadcrumb = () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing[2],
      marginBottom: theme.spacing[4],
    }}>
      <button
        onClick={handleNavigateDashboard}
        style={{
          background: 'transparent',
          border: 'none',
          color: theme.colors.text.link,
          fontSize: theme.typography.fontSize.sm,
          fontWeight: theme.typography.fontWeight.medium,
          fontFamily: theme.typography.fontFamily.sans,
          cursor: 'pointer',
          padding: 0,
          transition: theme.transitions.default,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = theme.colors.text.linkHover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = theme.colors.text.link;
        }}
      >
        Dashboard
      </button>
      <span style={{
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.text.disabled,
      }}>
        /
      </span>
      <button
        onClick={handleNavigateBack}
        style={{
          background: 'transparent',
          border: 'none',
          color: theme.colors.text.link,
          fontSize: theme.typography.fontSize.sm,
          fontWeight: theme.typography.fontWeight.medium,
          fontFamily: theme.typography.fontFamily.sans,
          cursor: 'pointer',
          padding: 0,
          transition: theme.transitions.default,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = theme.colors.text.linkHover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = theme.colors.text.link;
        }}
      >
        Uploads
      </button>
      <span style={{
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.text.disabled,
      }}>
        /
      </span>
      <span style={{
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.text.secondary,
        fontWeight: theme.typography.fontWeight.medium,
      }}>
        Extraction Result
      </span>
    </div>
  );

  const renderPageHeader = () => {
    const fileName = result
      ? (result.file_name || 'Unknown file')
      : uploadStatus
        ? (uploadStatus.filename || 'Unknown file')
        : 'Extraction Result';

    const fileType = result
      ? result.filetype
      : uploadStatus
        ? uploadStatus.filetype
        : null;

    const fileSize = result
      ? result.size
      : uploadStatus
        ? uploadStatus.size
        : null;

    const status = result
      ? result.status
      : uploadStatus
        ? uploadStatus.status
        : null;

    const processedAt = result
      ? result.processed_at
      : null;

    const createdAt = result
      ? result.created_at
      : uploadStatus
        ? uploadStatus.created_at
        : null;

    return (
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: theme.spacing[6],
        flexWrap: 'wrap',
        gap: theme.spacing[3],
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing[3],
          flex: 1,
          minWidth: 0,
        }}>
          {/* Back Button */}
          <button
            onClick={handleNavigateBack}
            style={{
              background: theme.components.button.secondary.background,
              color: theme.colors.text.secondary,
              border: theme.components.button.secondary.border,
              borderRadius: theme.components.button.secondary.borderRadius,
              padding: `${theme.spacing[2]} ${theme.spacing[2]}`,
              fontSize: theme.typography.fontSize.sm,
              fontFamily: theme.typography.fontFamily.sans,
              cursor: 'pointer',
              transition: theme.transitions.default,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '2.25rem',
              height: '2.25rem',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.components.button.secondary.hoverBackground;
              e.currentTarget.style.color = theme.colors.text.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = theme.components.button.secondary.background;
              e.currentTarget.style.color = theme.colors.text.secondary;
            }}
            title="Back to uploads"
          >
            ←
          </button>

          <div style={{
            flex: 1,
            minWidth: 0,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing[2],
              marginBottom: theme.spacing[1],
              flexWrap: 'wrap',
            }}>
              <h1 style={{
                fontSize: theme.typography.fontSize['2xl'],
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.text.primary,
                margin: 0,
                lineHeight: theme.typography.lineHeight.tight,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '32rem',
              }}>
                {fileName}
              </h1>
              {status && renderStatusBadge(status)}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing[2],
              flexWrap: 'wrap',
            }}>
              {fileType && (
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
                  {fileType}
                </span>
              )}
              {fileSize > 0 && (
                <span style={{
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.text.tertiary,
                }}>
                  {formatFileSize(fileSize)}
                </span>
              )}
              {processedAt && (
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
                    Processed {formatTimestamp(processedAt)}
                  </span>
                </>
              )}
              {!processedAt && createdAt && (
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
                    Uploaded {formatTimestamp(createdAt)}
                  </span>
                </>
              )}
              {uploadId && (
                <>
                  <span style={{
                    fontSize: theme.typography.fontSize.xs,
                    color: theme.colors.text.disabled,
                  }}>
                    •
                  </span>
                  <span style={{
                    fontSize: theme.typography.fontSize.xs,
                    color: theme.colors.text.disabled,
                    fontFamily: theme.typography.fontFamily.mono,
                  }}
                  title={uploadId}
                  >
                    ID: {uploadId.substring(0, 8)}…
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing[2],
          flexShrink: 0,
        }}>
          {/* Refresh Button */}
          <button
            onClick={handleRetry}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing[1],
              background: theme.components.button.secondary.background,
              color: isLoading ? theme.colors.text.disabled : theme.colors.text.secondary,
              border: theme.components.button.secondary.border,
              borderRadius: theme.components.button.secondary.borderRadius,
              padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
              fontSize: theme.typography.fontSize.xs,
              fontWeight: theme.components.button.secondary.fontWeight,
              fontFamily: theme.typography.fontFamily.sans,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: theme.transitions.default,
              whiteSpace: 'nowrap',
              opacity: isLoading ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = theme.components.button.secondary.hoverBackground;
                e.currentTarget.style.color = theme.colors.text.primary;
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = theme.components.button.secondary.background;
                e.currentTarget.style.color = theme.colors.text.secondary;
              }
            }}
          >
            ⟳ Refresh
          </button>

          {/* Delete Button */}
          {(uploadStatus && (uploadStatus.status === 'completed' || uploadStatus.status === 'failed')) && (
            <button
              onClick={handleDeleteDocument}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing[1],
                background: theme.components.button.secondary.background,
                color: theme.colors.text.tertiary,
                border: theme.components.button.secondary.border,
                borderRadius: theme.components.button.secondary.borderRadius,
                padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.components.button.secondary.fontWeight,
                fontFamily: theme.typography.fontFamily.sans,
                cursor: 'pointer',
                transition: theme.transitions.default,
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = theme.colors.error[50];
                e.currentTarget.style.color = theme.colors.error[600];
                e.currentTarget.style.borderColor = theme.colors.error[200];
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = theme.components.button.secondary.background;
                e.currentTarget.style.color = theme.colors.text.tertiary;
                e.currentTarget.style.borderColor = theme.colors.border.default;
              }}
            >
              ✕ Delete
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderProcessingState = () => {
    if (!uploadStatus) return null;

    const status = uploadStatus.status;

    if (status === 'pending' || status === 'processing') {
      return (
        <div style={{
          background: theme.components.card.background,
          border: theme.components.card.border,
          borderRadius: theme.components.card.borderRadius,
          boxShadow: theme.components.card.shadow,
          padding: theme.spacing[8],
          textAlign: 'center',
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: theme.spacing[4],
          }}>
            <div style={{
              width: '3.5rem',
              height: '3.5rem',
              border: `3px solid ${theme.colors.neutral[200]}`,
              borderTopColor: theme.colors.primary[600],
              borderRadius: theme.borderRadius.full,
              animation: 'extractionResultPageSpin 0.8s linear infinite',
            }} />
            <div>
              <p style={{
                fontSize: theme.typography.fontSize.base,
                fontWeight: theme.typography.fontWeight.semibold,
                color: theme.colors.text.primary,
                margin: 0,
                marginBottom: theme.spacing[1],
              }}>
                {status === 'pending' ? 'Waiting to process...' : 'Extracting data...'}
              </p>
              <p style={{
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.text.tertiary,
                margin: 0,
                marginBottom: theme.spacing[2],
              }}>
                {status === 'pending'
                  ? 'Your document is queued for extraction. This should start shortly.'
                  : 'Your document is being processed. This may take a few moments depending on file size.'}
              </p>
              {uploadStatus.progress !== undefined && uploadStatus.progress > 0 && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: theme.spacing[2],
                  marginTop: theme.spacing[3],
                }}>
                  <div style={{
                    width: '16rem',
                    height: theme.components.progressBar.height,
                    background: theme.components.progressBar.background,
                    borderRadius: theme.components.progressBar.borderRadius,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${uploadStatus.progress}%`,
                      height: '100%',
                      background: theme.colors.primary[500],
                      borderRadius: theme.components.progressBar.borderRadius,
                      transition: `width ${theme.transitions.default}`,
                    }} />
                  </div>
                  <span style={{
                    fontSize: theme.typography.fontSize.xs,
                    fontWeight: theme.typography.fontWeight.medium,
                    color: theme.colors.primary[700],
                    fontFamily: theme.typography.fontFamily.mono,
                  }}>
                    {uploadStatus.progress}%
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={handleRetry}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing[1],
                background: theme.components.button.secondary.background,
                color: theme.colors.text.secondary,
                border: theme.components.button.secondary.border,
                borderRadius: theme.components.button.secondary.borderRadius,
                padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.components.button.secondary.fontWeight,
                fontFamily: theme.typography.fontFamily.sans,
                cursor: 'pointer',
                transition: theme.transitions.default,
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = theme.components.button.secondary.hoverBackground;
                e.currentTarget.style.color = theme.colors.text.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = theme.components.button.secondary.background;
                e.currentTarget.style.color = theme.colors.text.secondary;
              }}
            >
              ⟳ Check Status
            </button>
          </div>
        </div>
      );
    }

    if (status === 'failed' && !result) {
      const errorMessage = uploadStatus.error || uploadStatus.error_message || 'Extraction failed. Please try uploading the document again.';

      return (
        <div style={{
          background: theme.components.card.background,
          border: `1px solid ${theme.colors.error[200]}`,
          borderRadius: theme.components.card.borderRadius,
          boxShadow: theme.components.card.shadow,
          padding: theme.spacing[8],
          textAlign: 'center',
        }}>
          <div style={{
            width: '3.5rem',
            height: '3.5rem',
            borderRadius: theme.borderRadius.full,
            background: theme.colors.error[50],
            color: theme.colors.error[600],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            marginBottom: theme.spacing[3],
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.bold,
          }}>
            ✕
          </div>
          <p style={{
            fontSize: theme.typography.fontSize.base,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.error[800],
            margin: 0,
            marginBottom: theme.spacing[2],
          }}>
            Extraction Failed
          </p>
          <p style={{
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.error[600],
            margin: 0,
            marginBottom: theme.spacing[4],
            maxWidth: '28rem',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            {errorMessage}
          </p>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing[3],
          }}>
            <button
              onClick={handleNavigateBack}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing[1],
                background: theme.components.button.primary.background,
                color: theme.components.button.primary.color,
                border: 'none',
                borderRadius: theme.components.button.primary.borderRadius,
                padding: `${theme.components.button.primary.paddingY} ${theme.components.button.primary.paddingX}`,
                fontSize: theme.components.button.primary.fontSize,
                fontWeight: theme.components.button.primary.fontWeight,
                fontFamily: theme.typography.fontFamily.sans,
                cursor: 'pointer',
                transition: theme.transitions.default,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = theme.components.button.primary.hoverBackground;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = theme.components.button.primary.background;
              }}
            >
              ↑ Upload Again
            </button>
            <button
              onClick={handleDeleteDocument}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing[1],
                background: theme.components.button.secondary.background,
                color: theme.colors.text.tertiary,
                border: theme.components.button.secondary.border,
                borderRadius: theme.components.button.secondary.borderRadius,
                padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.components.button.secondary.fontWeight,
                fontFamily: theme.typography.fontFamily.sans,
                cursor: 'pointer',
                transition: theme.transitions.default,
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = theme.colors.error[50];
                e.currentTarget.style.color = theme.colors.error[600];
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = theme.components.button.secondary.background;
                e.currentTarget.style.color = theme.colors.text.tertiary;
              }}
            >
              ✕ Delete
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderNoUploadId = () => (
    <div style={{
      background: theme.components.card.background,
      border: theme.components.card.border,
      borderRadius: theme.components.card.borderRadius,
      boxShadow: theme.components.card.shadow,
      padding: theme.spacing[8],
      textAlign: 'center',
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
          ∅
        </span>
      </div>
      <p style={{
        fontSize: theme.typography.fontSize.base,
        fontWeight: theme.typography.fontWeight.semibold,
        color: theme.colors.text.secondary,
        margin: 0,
        marginBottom: theme.spacing[1],
      }}>
        No upload ID provided
      </p>
      <p style={{
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.text.tertiary,
        margin: 0,
        marginBottom: theme.spacing[4],
      }}>
        Please navigate to a valid extraction result from the uploads page
      </p>
      <button
        onClick={handleNavigateBack}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: theme.spacing[1],
          background: theme.components.button.primary.background,
          color: theme.components.button.primary.color,
          border: 'none',
          borderRadius: theme.components.button.primary.borderRadius,
          padding: `${theme.components.button.primary.paddingY} ${theme.components.button.primary.paddingX}`,
          fontSize: theme.components.button.primary.fontSize,
          fontWeight: theme.components.button.primary.fontWeight,
          fontFamily: theme.typography.fontFamily.sans,
          cursor: 'pointer',
          transition: theme.transitions.default,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = theme.components.button.primary.hoverBackground;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = theme.components.button.primary.background;
        }}
      >
        ← Go to Uploads
      </button>
    </div>
  );

  if (!uploadId) {
    return (
      <Layout>
        {renderBreadcrumb()}
        <div style={{ marginBottom: theme.spacing[6] }}>
          <h1 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.bold,
            color: theme.colors.text.primary,
            margin: 0,
            marginBottom: theme.spacing[1],
            lineHeight: theme.typography.lineHeight.tight,
          }}>
            Extraction Result
          </h1>
          <p style={{
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.text.tertiary,
            margin: 0,
          }}>
            View detailed extraction results for an uploaded document
          </p>
        </div>
        {renderNoUploadId()}
        <style>{`
          @keyframes extractionResultPageSpin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </Layout>
    );
  }

  if (isLoading && isLoadingStatus) {
    return (
      <Layout>
        {renderBreadcrumb()}
        <div style={{
          background: theme.components.card.background,
          border: theme.components.card.border,
          borderRadius: theme.components.card.borderRadius,
          padding: theme.spacing[8],
          boxShadow: theme.components.card.shadow,
        }}>
          <LoadingSpinner
            size="lg"
            message="Loading extraction result..."
          />
        </div>
        <style>{`
          @keyframes extractionResultPageSpin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </Layout>
    );
  }

  const isProcessing = uploadStatus && (uploadStatus.status === 'pending' || uploadStatus.status === 'processing');
  const isFailed = uploadStatus && uploadStatus.status === 'failed' && !result;

  return (
    <Layout>
      {renderBreadcrumb()}
      {renderPageHeader()}

      {/* Status Error */}
      {statusError && !error && (
        <div style={{ marginBottom: theme.spacing[4] }}>
          <ErrorMessage
            message={statusError}
            severity="warning"
            onRetry={handleRetry}
            onDismiss={() => setStatusError(null)}
            compact
          />
        </div>
      )}

      {/* Main Error */}
      {error && !isProcessing && !isFailed && (
        <div style={{ marginBottom: theme.spacing[4] }}>
          <ErrorMessage
            message={error}
            severity="error"
            title="Failed to Load Extraction Result"
            onRetry={handleRetry}
            onDismiss={handleDismissError}
          />
        </div>
      )}

      {/* Processing / Failed State */}
      {(isProcessing || isFailed) && !result && renderProcessingState()}

      {/* Extraction Result */}
      {result && (
        <ExtractionResultView
          result={result}
          isLoading={false}
          error={null}
          onRetry={handleRetry}
          onDismissError={handleDismissError}
        />
      )}

      {/* No result and no processing state and no error */}
      {!result && !isProcessing && !isFailed && !error && !isLoading && (
        <div style={{
          background: theme.components.card.background,
          border: theme.components.card.border,
          borderRadius: theme.components.card.borderRadius,
          boxShadow: theme.components.card.shadow,
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
            No extraction result available
          </p>
          <p style={{
            fontSize: theme.typography.fontSize.xs,
            color: theme.colors.text.tertiary,
            margin: 0,
            marginBottom: theme.spacing[4],
          }}>
            The extraction result for this document could not be found
          </p>
          <button
            onClick={handleNavigateBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: theme.spacing[1],
              background: theme.components.button.primary.background,
              color: theme.components.button.primary.color,
              border: 'none',
              borderRadius: theme.components.button.primary.borderRadius,
              padding: `${theme.components.button.primary.paddingY} ${theme.components.button.primary.paddingX}`,
              fontSize: theme.components.button.primary.fontSize,
              fontWeight: theme.components.button.primary.fontWeight,
              fontFamily: theme.typography.fontFamily.sans,
              cursor: 'pointer',
              transition: theme.transitions.default,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.components.button.primary.hoverBackground;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = theme.components.button.primary.background;
            }}
          >
            ← Back to Uploads
          </button>
        </div>
      )}

      <style>{`
        @keyframes extractionResultPageSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Layout>
  );
};

export default ExtractionResultPage;