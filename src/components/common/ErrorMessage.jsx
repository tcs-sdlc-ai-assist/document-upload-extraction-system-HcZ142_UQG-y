import { useCallback } from 'react';
import theme from '../../config/theme';

const SEVERITY_CONFIG = {
  error: {
    background: theme.components.toast.error.background,
    border: theme.components.toast.error.border,
    color: theme.components.toast.error.color,
    iconBg: theme.colors.error[100],
    iconColor: theme.colors.error[700],
    icon: '✕',
    defaultTitle: 'Error',
  },
  warning: {
    background: theme.components.toast.warning.background,
    border: theme.components.toast.warning.border,
    color: theme.components.toast.warning.color,
    iconBg: theme.colors.warning[100],
    iconColor: theme.colors.warning[700],
    icon: '⚠',
    defaultTitle: 'Warning',
  },
  info: {
    background: theme.components.toast.info.background,
    border: theme.components.toast.info.border,
    color: theme.components.toast.info.color,
    iconBg: theme.colors.info[100],
    iconColor: theme.colors.info[700],
    icon: 'ℹ',
    defaultTitle: 'Info',
  },
};

const ErrorMessage = ({
  message = null,
  severity = 'error',
  title = null,
  details = null,
  onRetry = null,
  onDismiss = null,
  retryLabel = 'Retry',
  dismissLabel = 'Dismiss',
  showIcon = true,
  compact = false,
  style = {},
}) => {
  const normalizedSeverity = SEVERITY_CONFIG[severity] ? severity : 'error';
  const config = SEVERITY_CONFIG[normalizedSeverity];

  const handleRetry = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onRetry && typeof onRetry === 'function') {
      onRetry();
    }
  }, [onRetry]);

  const handleDismiss = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDismiss && typeof onDismiss === 'function') {
      onDismiss();
    }
  }, [onDismiss]);

  if (!message && !title && (!details || details.length === 0)) {
    return null;
  }

  const displayTitle = title || (compact ? null : config.defaultTitle);

  const detailsList = details
    ? (Array.isArray(details) ? details : [details])
    : [];

  if (compact) {
    return (
      <div
        role="alert"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing[2],
          padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
          background: config.background,
          border: config.border,
          borderRadius: theme.components.toast.borderRadius,
          fontFamily: theme.typography.fontFamily.sans,
          ...style,
        }}
      >
        {showIcon && (
          <span style={{
            width: '1.25rem',
            height: '1.25rem',
            borderRadius: theme.borderRadius.full,
            background: config.iconBg,
            color: config.iconColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.bold,
            flexShrink: 0,
            lineHeight: 1,
          }}>
            {config.icon}
          </span>
        )}

        <span style={{
          flex: 1,
          fontSize: theme.typography.fontSize.sm,
          color: config.color,
          lineHeight: theme.typography.lineHeight.normal,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {message}
        </span>

        {onRetry && (
          <button
            onClick={handleRetry}
            style={{
              background: 'transparent',
              border: 'none',
              color: config.iconColor,
              fontSize: theme.typography.fontSize.xs,
              fontWeight: theme.typography.fontWeight.medium,
              fontFamily: theme.typography.fontFamily.sans,
              cursor: 'pointer',
              padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
              borderRadius: theme.borderRadius.md,
              transition: theme.transitions.default,
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = config.iconBg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {retryLabel}
          </button>
        )}

        {onDismiss && (
          <button
            onClick={handleDismiss}
            aria-label={dismissLabel}
            style={{
              background: 'transparent',
              border: 'none',
              color: config.color,
              fontSize: theme.typography.fontSize.sm,
              cursor: 'pointer',
              padding: theme.spacing[1],
              borderRadius: theme.borderRadius.md,
              transition: theme.transitions.default,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '1.5rem',
              height: '1.5rem',
              lineHeight: 1,
              opacity: 0.6,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.background = config.iconBg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.6';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            ✕
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: theme.spacing[3],
        padding: theme.components.toast.padding,
        background: config.background,
        border: config.border,
        borderRadius: theme.components.toast.borderRadius,
        fontFamily: theme.typography.fontFamily.sans,
        ...style,
      }}
    >
      {/* Icon */}
      {showIcon && (
        <span style={{
          width: '1.5rem',
          height: '1.5rem',
          borderRadius: theme.borderRadius.full,
          background: config.iconBg,
          color: config.iconColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: theme.typography.fontSize.xs,
          fontWeight: theme.typography.fontWeight.bold,
          flexShrink: 0,
          lineHeight: 1,
          marginTop: '1px',
        }}>
          {config.icon}
        </span>
      )}

      {/* Content */}
      <div style={{
        flex: 1,
        minWidth: 0,
      }}>
        {/* Title */}
        {displayTitle && (
          <p style={{
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.semibold,
            color: config.color,
            margin: 0,
            marginBottom: message || detailsList.length > 0 ? theme.spacing[1] : 0,
            lineHeight: theme.typography.lineHeight.tight,
          }}>
            {displayTitle}
          </p>
        )}

        {/* Message */}
        {message && (
          <p style={{
            fontSize: theme.typography.fontSize.sm,
            color: config.color,
            margin: 0,
            marginBottom: detailsList.length > 0 ? theme.spacing[2] : 0,
            lineHeight: theme.typography.lineHeight.normal,
            wordBreak: 'break-word',
          }}>
            {message}
          </p>
        )}

        {/* Details List */}
        {detailsList.length > 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            marginBottom: (onRetry || onDismiss) ? theme.spacing[3] : 0,
          }}>
            {detailsList.map((detail, idx) => {
              const detailText = typeof detail === 'object' && detail !== null
                ? (detail.message || detail.field
                  ? `${detail.field ? detail.field + ': ' : ''}${detail.message || ''}`
                  : JSON.stringify(detail))
                : String(detail);

              return (
                <p
                  key={idx}
                  style={{
                    fontSize: theme.typography.fontSize.xs,
                    color: config.color,
                    margin: 0,
                    lineHeight: theme.typography.lineHeight.normal,
                    opacity: 0.85,
                  }}
                >
                  • {detailText}
                </p>
              );
            })}
          </div>
        )}

        {/* Action Buttons */}
        {(onRetry || onDismiss) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[2],
            marginTop: (message || detailsList.length > 0) ? theme.spacing[2] : 0,
          }}>
            {onRetry && (
              <button
                onClick={handleRetry}
                style={{
                  background: config.iconBg,
                  border: 'none',
                  color: config.iconColor,
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.medium,
                  fontFamily: theme.typography.fontFamily.sans,
                  cursor: 'pointer',
                  padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
                  borderRadius: theme.borderRadius.md,
                  transition: theme.transitions.default,
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                {retryLabel}
              </button>
            )}

            {onDismiss && (
              <button
                onClick={handleDismiss}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: config.color,
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.medium,
                  fontFamily: theme.typography.fontFamily.sans,
                  cursor: 'pointer',
                  padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
                  borderRadius: theme.borderRadius.md,
                  transition: theme.transitions.default,
                  whiteSpace: 'nowrap',
                  opacity: 0.7,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.background = config.iconBg;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.7';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {dismissLabel}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Dismiss X Button (top right, non-compact) */}
      {onDismiss && !onRetry && (
        <button
          onClick={handleDismiss}
          aria-label={dismissLabel}
          style={{
            background: 'transparent',
            border: 'none',
            color: config.color,
            fontSize: theme.typography.fontSize.sm,
            cursor: 'pointer',
            padding: theme.spacing[1],
            borderRadius: theme.borderRadius.md,
            transition: theme.transitions.default,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '1.5rem',
            height: '1.5rem',
            lineHeight: 1,
            opacity: 0.6,
            marginTop: '1px',
            position: 'relative',
            display: 'none',
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
};

export default ErrorMessage;