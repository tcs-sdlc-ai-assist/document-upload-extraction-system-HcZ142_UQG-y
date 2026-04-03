import { useAuth } from '../context/AuthContext';
import Layout from '../components/layout/Layout';
import SystemHealthPanel from '../components/monitoring/SystemHealthPanel';
import ErrorMessage from '../components/common/ErrorMessage';
import theme from '../config/theme';

const MonitoringPage = () => {
  const { user } = useAuth();

  const isAdmin = user && (user.role === 'admin' || user.role === 'sa');

  const handleNavigate = (href) => {
    window.location.href = href;
  };

  const renderPageHeader = () => (
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
            System Monitoring
          </h1>
          <p style={{
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.text.tertiary,
            margin: 0,
          }}>
            Real-time system health metrics, performance data, and status indicators
          </p>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing[2],
          flexWrap: 'wrap',
        }}>
          {user && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: theme.spacing[1],
              padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
              borderRadius: theme.borderRadius.full,
              background: theme.colors.primary[50],
              fontSize: theme.typography.fontSize.xs,
              fontWeight: theme.typography.fontWeight.medium,
              color: theme.colors.primary[700],
              textTransform: 'capitalize',
            }}>
              {user.role || 'user'}
            </span>
          )}
          <button
            onClick={() => handleNavigate('/dashboard')}
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
            ← Dashboard
          </button>
          {isAdmin && (
            <button
              onClick={() => handleNavigate('/logs')}
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
              Audit Logs →
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const renderAccessDenied = () => (
    <div style={{
      background: theme.components.card.background,
      border: theme.components.card.border,
      borderRadius: theme.components.card.borderRadius,
      padding: theme.spacing[8],
      boxShadow: theme.components.card.shadow,
      textAlign: 'center',
    }}>
      <div style={{
        width: '4rem',
        height: '4rem',
        borderRadius: theme.borderRadius.full,
        background: theme.colors.error[50],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto',
        marginBottom: theme.spacing[4],
      }}>
        <span style={{
          fontSize: theme.typography.fontSize['2xl'],
          color: theme.colors.error[600],
          lineHeight: 1,
          fontWeight: theme.typography.fontWeight.bold,
        }}>
          ✕
        </span>
      </div>
      <p style={{
        fontSize: theme.typography.fontSize.base,
        fontWeight: theme.typography.fontWeight.semibold,
        color: theme.colors.text.primary,
        margin: 0,
        marginBottom: theme.spacing[2],
      }}>
        Access Denied
      </p>
      <p style={{
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.text.tertiary,
        margin: 0,
        marginBottom: theme.spacing[6],
        maxWidth: '28rem',
        marginLeft: 'auto',
        marginRight: 'auto',
      }}>
        You do not have permission to view system monitoring data. This page is restricted to administrators and system administrators.
      </p>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing[3],
        flexWrap: 'wrap',
      }}>
        <button
          onClick={() => handleNavigate('/dashboard')}
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
        >
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );

  if (!isAdmin) {
    return (
      <Layout>
        {renderPageHeader()}
        <ErrorMessage
          message="You do not have the required permissions to access system monitoring."
          severity="error"
          title="Insufficient Permissions"
          style={{ marginBottom: theme.spacing[4] }}
        />
        {renderAccessDenied()}
      </Layout>
    );
  }

  return (
    <Layout>
      {renderPageHeader()}

      <SystemHealthPanel
        refreshInterval={30000}
        showMetrics={true}
        showHealth={true}
        compact={false}
        title="System Health"
        subtitle="Real-time system monitoring and performance metrics"
      />
    </Layout>
  );
};

export default MonitoringPage;