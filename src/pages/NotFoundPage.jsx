import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/layout/Layout';
import theme from '../config/theme';

const NotFoundPage = () => {
  const { isAuthenticated, isLoading } = useAuth();

  const handleNavigate = useCallback((href) => {
    window.location.href = href;
  }, []);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: theme.colors.background.secondary,
        fontFamily: theme.typography.fontFamily.sans,
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: theme.spacing[4],
        }}>
          <div
            style={{
              width: '2.5rem',
              height: '2.5rem',
              border: `3px solid ${theme.colors.neutral[200]}`,
              borderTopColor: theme.colors.primary[600],
              borderRadius: theme.borderRadius.full,
              animation: 'notFoundPageSpin 0.8s linear infinite',
            }}
          />
          <span style={{
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.text.secondary,
            fontFamily: theme.typography.fontFamily.sans,
          }}>
            Loading...
          </span>
          <style>{`
            @keyframes notFoundPageSpin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  const renderContent = () => (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: isAuthenticated ? `calc(100vh - ${theme.components.header.height} - ${theme.spacing[12]})` : '100vh',
      fontFamily: theme.typography.fontFamily.sans,
    }}>
      <div style={{
        background: theme.components.card.background,
        border: theme.components.card.border,
        borderRadius: theme.components.card.borderRadius,
        padding: theme.spacing[8],
        boxShadow: theme.components.card.shadow,
        textAlign: 'center',
        maxWidth: '28rem',
        width: '100%',
      }}>
        {/* 404 Icon */}
        <div style={{
          width: '4rem',
          height: '4rem',
          borderRadius: theme.borderRadius.full,
          background: theme.colors.neutral[100],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto',
          marginBottom: theme.spacing[4],
        }}>
          <span style={{
            fontSize: theme.typography.fontSize['2xl'],
            color: theme.colors.text.tertiary,
            lineHeight: 1,
            fontWeight: theme.typography.fontWeight.bold,
          }}>
            ?
          </span>
        </div>

        {/* Error Code */}
        <p style={{
          fontSize: theme.typography.fontSize['4xl'],
          fontWeight: theme.typography.fontWeight.bold,
          color: theme.colors.text.primary,
          margin: 0,
          marginBottom: theme.spacing[2],
          lineHeight: theme.typography.lineHeight.tight,
          fontFamily: theme.typography.fontFamily.mono,
        }}>
          404
        </p>

        {/* Title */}
        <p style={{
          fontSize: theme.typography.fontSize.lg,
          fontWeight: theme.typography.fontWeight.semibold,
          color: theme.colors.text.primary,
          margin: 0,
          marginBottom: theme.spacing[2],
          lineHeight: theme.typography.lineHeight.tight,
        }}>
          Page Not Found
        </p>

        {/* Description */}
        <p style={{
          fontSize: theme.typography.fontSize.sm,
          color: theme.colors.text.tertiary,
          margin: 0,
          marginBottom: theme.spacing[6],
          lineHeight: theme.typography.lineHeight.normal,
        }}>
          The page you are looking for does not exist or has been moved. Please check the URL or navigate back to the dashboard.
        </p>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing[3],
          flexWrap: 'wrap',
        }}>
          <button
            onClick={() => handleNavigate(isAuthenticated ? '/dashboard' : '/login')}
            style={{
              display: 'inline-flex',
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
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.components.button.primary.hoverBackground;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = theme.components.button.primary.background;
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.background = theme.components.button.primary.activeBackground;
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.background = theme.components.button.primary.hoverBackground;
            }}
          >
            ← {isAuthenticated ? 'Back to Dashboard' : 'Go to Login'}
          </button>

          {isAuthenticated && (
            <button
              onClick={() => handleNavigate('/upload')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: theme.spacing[1],
                background: theme.components.button.secondary.background,
                color: theme.colors.text.secondary,
                border: theme.components.button.secondary.border,
                borderRadius: theme.components.button.secondary.borderRadius,
                padding: `${theme.components.button.secondary.paddingY} ${theme.components.button.secondary.paddingX}`,
                fontSize: theme.components.button.secondary.fontSize,
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
              ↑ Upload Documents
            </button>
          )}
        </div>

        {/* Current Path Hint */}
        <div style={{
          marginTop: theme.spacing[6],
          paddingTop: theme.spacing[4],
          borderTop: `1px solid ${theme.colors.border.light}`,
        }}>
          <p style={{
            fontSize: theme.typography.fontSize.xs,
            color: theme.colors.text.disabled,
            margin: 0,
            marginBottom: theme.spacing[1],
          }}>
            Requested URL
          </p>
          <p style={{
            fontSize: theme.typography.fontSize.xs,
            color: theme.colors.text.tertiary,
            fontFamily: theme.typography.fontFamily.mono,
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {window.location.pathname}
          </p>
        </div>
      </div>
    </div>
  );

  if (isAuthenticated) {
    return (
      <Layout>
        {renderContent()}
      </Layout>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: theme.colors.background.secondary,
      fontFamily: theme.typography.fontFamily.sans,
    }}>
      {renderContent()}
    </div>
  );
};

export default NotFoundPage;