import theme from '../../config/theme';

const SIZE_CONFIG = {
  sm: {
    width: '1rem',
    height: '1rem',
    borderWidth: '2px',
  },
  md: {
    width: '2rem',
    height: '2rem',
    borderWidth: '3px',
  },
  lg: {
    width: '2.5rem',
    height: '2.5rem',
    borderWidth: '3px',
  },
  xl: {
    width: '3.5rem',
    height: '3.5rem',
    borderWidth: '4px',
  },
};

const LoadingSpinner = ({
  size = 'md',
  message = null,
  color = null,
  trackColor = null,
  fullScreen = false,
  overlay = false,
  style = {},
}) => {
  const normalizedSize = SIZE_CONFIG[size] ? size : 'md';
  const sizeConfig = SIZE_CONFIG[normalizedSize];

  const spinnerColor = color || theme.colors.primary[600];
  const spinnerTrackColor = trackColor || theme.colors.neutral[200];

  const spinner = (
    <div
      style={{
        width: sizeConfig.width,
        height: sizeConfig.height,
        border: `${sizeConfig.borderWidth} solid ${spinnerTrackColor}`,
        borderTopColor: spinnerColor,
        borderRadius: theme.borderRadius.full,
        animation: 'loadingSpinnerSpin 0.8s linear infinite',
        flexShrink: 0,
      }}
    />
  );

  if (fullScreen) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: theme.colors.background.secondary,
          fontFamily: theme.typography.fontFamily.sans,
          ...style,
        }}
      >
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: theme.spacing[4],
        }}>
          {spinner}
          {message && (
            <span style={{
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.text.secondary,
              fontFamily: theme.typography.fontFamily.sans,
              textAlign: 'center',
              lineHeight: theme.typography.lineHeight.normal,
            }}>
              {message}
            </span>
          )}
        </div>
        <style>{`
          @keyframes loadingSpinnerSpin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (overlay) {
    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          zIndex: theme.zIndex.overlay,
          fontFamily: theme.typography.fontFamily.sans,
          borderRadius: 'inherit',
          ...style,
        }}
      >
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: theme.spacing[3],
        }}>
          {spinner}
          {message && (
            <span style={{
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.text.secondary,
              fontFamily: theme.typography.fontFamily.sans,
              textAlign: 'center',
              lineHeight: theme.typography.lineHeight.normal,
            }}>
              {message}
            </span>
          )}
        </div>
        <style>{`
          @keyframes loadingSpinnerSpin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: message ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: message ? theme.spacing[3] : theme.spacing[2],
        fontFamily: theme.typography.fontFamily.sans,
        ...style,
      }}
    >
      {spinner}
      {message && (
        <span style={{
          fontSize: theme.typography.fontSize.sm,
          color: theme.colors.text.secondary,
          fontFamily: theme.typography.fontFamily.sans,
          textAlign: 'center',
          lineHeight: theme.typography.lineHeight.normal,
        }}>
          {message}
        </span>
      )}
      <style>{`
        @keyframes loadingSpinnerSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LoadingSpinner;