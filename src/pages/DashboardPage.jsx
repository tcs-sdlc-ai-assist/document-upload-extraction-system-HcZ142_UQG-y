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

const DashboardPage = () => {
  const { user } = useAuth();
  const { results, queue, uploads, getUploadsList } = useUpload();

  const [recentUploads, setRecentUploads] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoadingUploads, setIsLoadingUploads] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [uploadsError, setUploadsError] = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [selectedUploadId, setSelectedUploadId] = useState(null);
  const [selectedResult, setSelectedResult] = useState(null);
  const [isLoadingResult, setIsLoadingResult] = useState(false);
  const [resultError, setResultError] = useState(null);
  const [showQuickUpload, setShowQuickUpload] = useState(false);

  const fetchRecentUploads = useCallback(async () => {
    setIsLoadingUploads(true);
    setUploadsError(null);

    try {
      const response = await documentService.listUploads({
        page: 1,
        page_size: 10,
        sort_by: 'created_at',
        sort_order: 'DESC',
      });

      if (response.success && response.data) {
        setRecentUploads(response.data.uploads || []);
      } else {
        setUploadsError(response.message || 'Failed to load recent uploads.');
        setRecentUploads([]);
      }
    } catch (err) {
      setUploadsError(err.message || 'An unexpected error occurred while loading uploads.');
      setRecentUploads([]);
    } finally {
      setIsLoadingUploads(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    setIsLoadingStats(true);
    setStatsError(null);

    try {
      const response = await documentService.getUploadStats();

      if (response.success && response.data) {
        setStats(response.data);
      } else {
        setStatsError(response.message || 'Failed to load upload statistics.');
        setStats(null);
      }
    } catch (err) {
      setStatsError(err.message || 'An unexpected error occurred while loading statistics.');
      setStats(null);
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentUploads();
    fetchStats();
  }, [fetchRecentUploads, fetchStats]);

  const activeUploads = useMemo(() => {
    return getUploadsList().filter(
      (u) => u.status === 'uploading' || u.status === 'processing'
    );
  }, [getUploadsList]);

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
    fetchRecentUploads();
  }, [fetchRecentUploads]);

  const handleRetryStats = useCallback(() => {
    fetchStats();
  }, [fetchStats]);

  const handleDismissUploadsError = useCallback(() => {
    setUploadsError(null);
  }, []);

  const handleDismissStatsError = useCallback(() => {
    setStatsError(null);
  }, []);

  const handleNavigate = useCallback((href) => {
    window.location.href = href;
  }, []);

  const handleToggleQuickUpload = useCallback(() => {
    setShowQuickUpload((prev) => !prev);
  }, []);

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

  const renderStatsCards = () => {
    if (isLoadingStats) {
      return (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: theme.spacing[4],
          marginBottom: theme.spacing[6],
        }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                background: theme.components.card.background,
                border: theme.components.card.border,
                borderRadius: theme.components.card.borderRadius,
                padding: theme.spacing[4],
                boxShadow: theme.components.card.shadow,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '5rem',
              }}
            >
              <LoadingSpinner size="sm" />
            </div>
          ))}
        </div>
      );
    }

    if (statsError) {
      return (
        <div style={{ marginBottom: theme.spacing[4] }}>
          <ErrorMessage
            message={statsError}
            severity="warning"
            onRetry={handleRetryStats}
            onDismiss={handleDismissStatsError}
            compact
          />
        </div>
      );
    }

    const statCards = [
      {
        label: 'Total Uploads',
        value: stats ? stats.total : 0,
        icon: '↑',
        color: theme.colors.primary[700],
        bg: theme.colors.primary[50],
      },
      {
        label: 'Completed',
        value: stats ? stats.completed : 0,
        icon: '✓',
        color: theme.colors.success[700],
        bg: theme.colors.success[50],
      },
      {
        label: 'Processing',
        value: stats ? (stats.pending || 0) + (stats.processing || 0) : 0,
        icon: '⟳',
        color: theme.colors.info[700],
        bg: theme.colors.info[50],
      },
      {
        label: 'Failed',
        value: stats ? stats.failed : 0,
        icon: '✕',
        color: theme.colors.error[700],
        bg: theme.colors.error[50],
      },
    ];

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: theme.spacing[4],
        marginBottom: theme.spacing[6],
      }}>
        {statCards.map((card) => (
          <div
            key={card.label}
            style={{
              background: theme.components.card.background,
              border: theme.components.card.border,
              borderRadius: theme.components.card.borderRadius,
              padding: theme.spacing[4],
              boxShadow: theme.components.card.shadow,
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing[3],
              transition: theme.transitions.default,
            }}
          >
            <div style={{
              width: '2.5rem',
              height: '2.5rem',
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
                color: theme.colors.text.primary,
                margin: 0,
                lineHeight: theme.typography.lineHeight.tight,
                fontFamily: theme.typography.fontFamily.mono,
              }}>
                {card.value}
              </p>
              <p style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.tertiary,
                margin: 0,
                marginTop: '2px',
              }}>
                {card.label}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderQuickActions = () => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: theme.spacing[4],
      marginBottom: theme.spacing[6],
    }}>
      {/* Upload Documents */}
      <button
        onClick={() => handleNavigate('/upload')}
        style={{
          background: theme.components.card.background,
          border: theme.components.card.border,
          borderRadius: theme.components.card.borderRadius,
          padding: theme.spacing[4],
          boxShadow: theme.components.card.shadow,
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing[3],
          cursor: 'pointer',
          transition: theme.transitions.default,
          fontFamily: theme.typography.fontFamily.sans,
          textAlign: 'left',
          width: '100%',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = theme.colors.primary[300];
          e.currentTarget.style.boxShadow = theme.shadows.md;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = theme.colors.border.light;
          e.currentTarget.style.boxShadow = theme.components.card.shadow;
        }}
      >
        <div style={{
          width: '2.5rem',
          height: '2.5rem',
          borderRadius: theme.borderRadius.lg,
          background: theme.colors.primary[50],
          color: theme.colors.primary[700],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: theme.typography.fontSize.lg,
          fontWeight: theme.typography.fontWeight.bold,
          flexShrink: 0,
        }}>
          ↑
        </div>
        <div>
          <p style={{
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.text.primary,
            margin: 0,
            marginBottom: '2px',
          }}>
            Upload Documents
          </p>
          <p style={{
            fontSize: theme.typography.fontSize.xs,
            color: theme.colors.text.tertiary,
            margin: 0,
          }}>
            Upload and extract data from files
          </p>
        </div>
      </button>

      {/* Atlas View */}
      <button
        onClick={() => handleNavigate('/atlas')}
        style={{
          background: theme.components.card.background,
          border: theme.components.card.border,
          borderRadius: theme.components.card.borderRadius,
          padding: theme.spacing[4],
          boxShadow: theme.components.card.shadow,
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing[3],
          cursor: 'pointer',
          transition: theme.transitions.default,
          fontFamily: theme.typography.fontFamily.sans,
          textAlign: 'left',
          width: '100%',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = theme.colors.info[300];
          e.currentTarget.style.boxShadow = theme.shadows.md;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = theme.colors.border.light;
          e.currentTarget.style.boxShadow = theme.components.card.shadow;
        }}
      >
        <div style={{
          width: '2.5rem',
          height: '2.5rem',
          borderRadius: theme.borderRadius.lg,
          background: theme.colors.info[50],
          color: theme.colors.info[700],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: theme.typography.fontSize.lg,
          fontWeight: theme.typography.fontWeight.bold,
          flexShrink: 0,
        }}>
          A
        </div>
        <div>
          <p style={{
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.text.primary,
            margin: 0,
            marginBottom: '2px',
          }}>
            Atlas View
          </p>
          <p style={{
            fontSize: theme.typography.fontSize.xs,
            color: theme.colors.text.tertiary,
            margin: 0,
          }}>
            Visualize geospatial cell site data
          </p>
        </div>
      </button>

      {/* Health Check */}
      <button
        onClick={() => handleNavigate('/health')}
        style={{
          background: theme.components.card.background,
          border: theme.components.card.border,
          borderRadius: theme.components.card.borderRadius,
          padding: theme.spacing[4],
          boxShadow: theme.components.card.shadow,
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing[3],
          cursor: 'pointer',
          transition: theme.transitions.default,
          fontFamily: theme.typography.fontFamily.sans,
          textAlign: 'left',
          width: '100%',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = theme.colors.success[300];
          e.currentTarget.style.boxShadow = theme.shadows.md;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = theme.colors.border.light;
          e.currentTarget.style.boxShadow = theme.components.card.shadow;
        }}
      >
        <div style={{
          width: '2.5rem',
          height: '2.5rem',
          borderRadius: theme.borderRadius.lg,
          background: theme.colors.success[50],
          color: theme.colors.success[700],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: theme.typography.fontSize.lg,
          fontWeight: theme.typography.fontWeight.bold,
          flexShrink: 0,
        }}>
          H
        </div>
        <div>
          <p style={{
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.text.primary,
            margin: 0,
            marginBottom: '2px',
          }}>
            Health Check
          </p>
          <p style={{
            fontSize: theme.typography.fontSize.xs,
            color: theme.colors.text.tertiary,
            margin: 0,
          }}>
            View eNodeB health status directory
          </p>
        </div>
      </button>
    </div>
  );

  const renderActiveUploads = () => {
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
              animation: 'dashboardSpin 0.8s linear infinite',
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
          <button
            onClick={() => handleNavigate('/upload')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing[1],
              background: theme.colors.info[100],
              color: theme.colors.info[700],
              border: `1px solid ${theme.colors.info[300]}`,
              borderRadius: theme.components.button.secondary.borderRadius,
              padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
              fontSize: theme.typography.fontSize.xs,
              fontWeight: theme.typography.fontWeight.medium,
              fontFamily: theme.typography.fontFamily.sans,
              cursor: 'pointer',
              transition: theme.transitions.default,
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.colors.info[200];
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = theme.colors.info[100];
            }}
          >
            View Details →
          </button>
        </div>
      </div>
    );
  };

  const renderQuickUpload = () => (
    <div style={{
      background: theme.components.card.background,
      border: theme.components.card.border,
      borderRadius: theme.components.card.borderRadius,
      boxShadow: theme.components.card.shadow,
      marginBottom: theme.spacing[6],
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${theme.spacing[4]} ${theme.spacing[4]} ${theme.spacing[3]}`,
        borderBottom: showQuickUpload ? `1px solid ${theme.colors.border.light}` : 'none',
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
            Quick Upload
          </h3>
          <p style={{
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.text.tertiary,
            margin: 0,
          }}>
            Drag and drop files to start extraction
          </p>
        </div>
        <button
          onClick={handleToggleQuickUpload}
          style={{
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
          {showQuickUpload ? 'Hide' : 'Show'}
        </button>
      </div>
      {showQuickUpload && (
        <div style={{ padding: theme.spacing[4] }}>
          <FileDropzone />
        </div>
      )}
    </div>
  );

  const renderRecentUploads = () => {
    if (isLoadingUploads) {
      return (
        <div style={{
          background: theme.components.card.background,
          border: theme.components.card.border,
          borderRadius: theme.components.card.borderRadius,
          padding: theme.spacing[8],
          boxShadow: theme.components.card.shadow,
          marginBottom: theme.spacing[6],
        }}>
          <LoadingSpinner size="md" message="Loading recent uploads..." />
        </div>
      );
    }

    if (uploadsError) {
      return (
        <div style={{ marginBottom: theme.spacing[6] }}>
          <ErrorMessage
            message={uploadsError}
            severity="error"
            title="Failed to Load Uploads"
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
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${theme.spacing[4]} ${theme.spacing[4]} ${theme.spacing[3]}`,
          borderBottom: `1px solid ${theme.colors.border.light}`,
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
              Recent Uploads
            </h3>
            <p style={{
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.text.tertiary,
              margin: 0,
            }}>
              Your most recent document uploads and extraction results
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
              {recentUploads.length} {recentUploads.length === 1 ? 'file' : 'files'}
            </span>
            <button
              onClick={handleRetryUploads}
              style={{
                background: 'transparent',
                border: 'none',
                color: theme.colors.text.tertiary,
                fontSize: theme.typography.fontSize.sm,
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
                e.currentTarget.style.color = theme.colors.text.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = theme.colors.text.tertiary;
              }}
              title="Refresh"
            >
              ⟳
            </button>
            <button
              onClick={() => handleNavigate('/upload')}
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
              View All →
            </button>
          </div>
        </div>

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
              marginBottom: theme.spacing[4],
            }}>
              Upload your first document to get started with data extraction
            </p>
            <button
              onClick={() => handleNavigate('/upload')}
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
              ↑ Upload Document
            </button>
          </div>
        ) : (
          <div>
            {recentUploads.map((upload, idx) => {
              const isSelected = selectedUploadId === upload.upload_id;
              const isCompleted = upload.status === 'completed';

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
                    background: upload.status === 'failed'
                      ? theme.colors.error[50]
                      : upload.status === 'completed'
                        ? theme.colors.success[50]
                        : theme.colors.primary[50],
                    color: upload.status === 'failed'
                      ? theme.colors.error[700]
                      : upload.status === 'completed'
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
                  </div>

                  {/* Status Badge */}
                  {renderStatusBadge(upload.status)}

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
                </div>
              );
            })}
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

  const renderUploadStatusSection = () => {
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
              {user ? `Welcome back, ${user.username}` : 'Dashboard'}
            </h1>
            <p style={{
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.text.tertiary,
              margin: 0,
            }}>
              Overview of your document uploads and extraction activity
            </p>
          </div>
          <button
            onClick={() => handleNavigate('/upload')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing[2],
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
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.components.button.primary.hoverBackground;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = theme.components.button.primary.background;
            }}
          >
            ↑ New Upload
          </button>
        </div>
      </div>

      {/* Active Uploads Banner */}
      {renderActiveUploads()}

      {/* Stats Cards */}
      {renderStatsCards()}

      {/* Quick Actions */}
      {renderQuickActions()}

      {/* Quick Upload */}
      {renderQuickUpload()}

      {/* Upload Queue */}
      {renderUploadStatusSection()}

      {/* Recent Uploads */}
      {renderRecentUploads()}

      {/* Selected Extraction Result */}
      {renderSelectedResult()}

      <style>{`
        @keyframes dashboardSpin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          div[style*="grid-template-columns: repeat(4"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          div[style*="grid-template-columns: repeat(3"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </Layout>
  );
};

export default DashboardPage;