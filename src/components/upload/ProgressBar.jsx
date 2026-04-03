import { useState, useEffect, useRef } from 'react';
import theme from '../../config/theme';

const STATUS_CONFIG = {
  idle: {
    label: 'Waiting',
    color: theme.colors.neutral[400],
    fillColor: theme.colors.neutral[300],
    background: theme.colors.neutral[100],
    textColor: theme.colors.text.tertiary,
    badgeBg: theme.colors.neutral[100],
    badgeColor: theme.colors.neutral[600],
  },
  uploading: {
    label: 'Uploading',
    color: theme.colors.primary[600],
    fillColor: theme.colors.primary[500],
    background: theme.colors.primary[50],
    textColor: theme.colors.primary[700],
    badgeBg: theme.components.badge.processing.background,
    badgeColor: theme.components.badge.processing.color,
  },
  processing: {
    label: 'Extracting',
    color: theme.colors.info[600],
    fillColor: theme.colors.info[500],
    background: theme.colors.info[50],
    textColor: theme.colors.info[700],
    badgeBg: theme.components.badge.processing.background,
    badgeColor: theme.components.badge.processing.color,
  },
  completed: {
    label: 'Completed',
    color: theme.colors.success[600],
    fillColor: theme.colors.success[500],
    background: theme.colors.success[50],
    textColor: theme.colors.success[700],
    badgeBg: theme.components.badge.completed.background,
    badgeColor: theme.components.badge.completed.color,
  },
  failed: {
    label: 'Failed',
    color: theme.colors.error[600],
    fillColor: theme.colors.error[500],
    background: theme.colors.error[50],
    textColor: theme.colors.error[700],
    badgeBg: theme.components.badge.failed.background,
    badgeColor: theme.components.badge.failed.color,
  },
};

const STATUS_ICONS = {
  idle: '○',
  uploading: '↑',
  processing: '⟳',
  completed: '✓',
  failed: '✕',
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const ProgressBar = ({
  progress = 0,
  status = 'idle',
  fileName = null,
  fileSize = null,
  error = null,
  showPercentage = true,
  showStatus = true,
  showFileName = true,
  animated = true,
  compact = false,
  onRetry = null,
  onCancel = null,
  onRemove = null,
}) => {
  const [displayProgress, setDisplayProgress] = useState(0);
  const animationRef = useRef(null);
  const prevProgressRef = useRef(0);

  const clampedProgress = Math.min(Math.max(0, Math.round(progress)), 100);

  useEffect(() => {
    if (!animated) {
      setDisplayProgress(clampedProgress);
      return;
    }

    const startValue = prevProgressRef.current;
    const endValue = clampedProgress;
    const duration = 400;
    const startTime = performance.now();

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const fraction = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - fraction, 3);
      const currentValue = Math.round(startValue + (endValue - startValue) * eased);

      setDisplayProgress(currentValue);

      if (fraction < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        prevProgressRef.current = endValue;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [clampedProgress, animated]);

  const normalizedStatus = STATUS_CONFIG[status] ? status : 'idle';
  const config = STATUS_CONFIG[normalizedStatus];
  const icon = STATUS_ICONS[normalizedStatus];
  const isActive = normalizedStatus === 'uploading' || normalizedStatus === 'processing';
  const isTerminal = normalizedStatus === 'completed' || normalizedStatus === 'failed';

  if (compact) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing[3],
        fontFamily: theme.typography.fontFamily.sans,
        width: '100%',
      }}>
        {/* Compact progress bar */}
        <div style={{
          flex: 1,
          height: theme.components.progressBar.height,
          background: theme.components.progressBar.background,
          borderRadius: theme.components.progressBar.borderRadius,
          overflow: 'hidden',
          position: 'relative',
        }}>
          <div style={{
            width: `${displayProgress}%`,
            height: '100%',
            background: config.fillColor,
            borderRadius: theme.components.progressBar.borderRadius,
            transition: animated ? 'none' : `width ${theme.transitions.default}`,
            position: 'relative',
            overflow: 'hidden',
          }}>
            {isActive && animated && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                animation: 'progressBarShimmer 1.5s ease-in-out infinite',
              }} />
            )}
          </div>
        </div>

        {/* Compact percentage */}
        {showPercentage && (
          <span style={{
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.medium,
            color: config.textColor,
            fontFamily: theme.typography.fontFamily.mono,
            minWidth: '2.5rem',
            textAlign: 'right',
            flexShrink: 0,
          }}>
            {displayProgress}%
          </span>
        )}

        <style>{`
          @keyframes progressBarShimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: theme.typography.fontFamily.sans,
      width: '100%',
    }}>
      {/* Header row: file name, status badge, percentage */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: theme.spacing[2],
        gap: theme.spacing[2],
      }}>
        {/* Left side: icon + file name + file size */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing[2],
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
        }}>
          {/* Status icon */}
          <span style={{
            width: '1.5rem',
            height: '1.5rem',
            borderRadius: theme.borderRadius.full,
            background: config.background,
            color: config.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.bold,
            flexShrink: 0,
            animation: isActive ? 'progressBarIconPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
          }}>
            {icon}
          </span>

          {/* File name */}
          {showFileName && fileName && (
            <span style={{
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.medium,
              color: theme.colors.text.primary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
            }}>
              {fileName}
            </span>
          )}

          {/* File size */}
          {fileSize && (
            <span style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.tertiary,
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}>
              {formatFileSize(fileSize)}
            </span>
          )}
        </div>

        {/* Right side: status badge + percentage */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing[2],
          flexShrink: 0,
        }}>
          {/* Status badge */}
          {showStatus && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
              borderRadius: theme.borderRadius.full,
              background: config.badgeBg,
              color: config.badgeColor,
              fontSize: theme.typography.fontSize.xs,
              fontWeight: theme.typography.fontWeight.medium,
              whiteSpace: 'nowrap',
              lineHeight: 1.2,
            }}>
              {config.label}
            </span>
          )}

          {/* Percentage */}
          {showPercentage && (
            <span style={{
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.semibold,
              color: config.textColor,
              fontFamily: theme.typography.fontFamily.mono,
              minWidth: '2.5rem',
              textAlign: 'right',
            }}>
              {displayProgress}%
            </span>
          )}
        </div>
      </div>

      {/* Progress bar track */}
      <div style={{
        width: '100%',
        height: theme.components.progressBar.height,
        background: theme.components.progressBar.background,
        borderRadius: theme.components.progressBar.borderRadius,
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{
          width: `${displayProgress}%`,
          height: '100%',
          background: config.fillColor,
          borderRadius: theme.components.progressBar.borderRadius,
          transition: animated ? 'none' : `width ${theme.transitions.default}`,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {isActive && animated && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
              animation: 'progressBarShimmer 1.5s ease-in-out infinite',
            }} />
          )}
        </div>
      </div>

      {/* Error message */}
      {normalizedStatus === 'failed' && error && (
        <div style={{
          marginTop: theme.spacing[2],
          display: 'flex',
          alignItems: 'flex-start',
          gap: theme.spacing[2],
        }}>
          <span style={{
            fontSize: theme.typography.fontSize.xs,
            color: theme.colors.error[600],
            lineHeight: theme.typography.lineHeight.normal,
            flex: 1,
          }}>
            {error}
          </span>
        </div>
      )}

      {/* Action buttons */}
      {(onRetry || onCancel || onRemove) && (
        <div style={{
          marginTop: theme.spacing[2],
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing[2],
          justifyContent: 'flex-end',
        }}>
          {/* Retry button (only for failed) */}
          {normalizedStatus === 'failed' && onRetry && (
            <button
              onClick={onRetry}
              style={{
                background: 'transparent',
                border: 'none',
                color: theme.colors.primary[600],
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.medium,
                fontFamily: theme.typography.fontFamily.sans,
                cursor: 'pointer',
                padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                borderRadius: theme.borderRadius.md,
                transition: theme.transitions.default,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = theme.colors.primary[50];
                e.currentTarget.style.color = theme.colors.primary[700];
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = theme.colors.primary[600];
              }}
            >
              Retry
            </button>
          )}

          {/* Cancel button (only for active) */}
          {isActive && onCancel && (
            <button
              onClick={onCancel}
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
                e.currentTarget.style.background = theme.colors.error[50];
                e.currentTarget.style.color = theme.colors.error[600];
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = theme.colors.text.tertiary;
              }}
            >
              Cancel
            </button>
          )}

          {/* Remove button (only for terminal states) */}
          {isTerminal && onRemove && (
            <button
              onClick={onRemove}
              style={{
                background: 'transparent',
                border: 'none',
                color: theme.colors.text.disabled,
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.medium,
                fontFamily: theme.typography.fontFamily.sans,
                cursor: 'pointer',
                padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                borderRadius: theme.borderRadius.md,
                transition: theme.transitions.default,
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
              Remove
            </button>
          )}
        </div>
      )}

      <style>{`
        @keyframes progressBarShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes progressBarIconPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default ProgressBar;