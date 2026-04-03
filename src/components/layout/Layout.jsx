import { useAuth } from '../../context/AuthContext';
import Header from './Header';
import Sidebar from './Sidebar';
import theme from '../../config/theme';

const Layout = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

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
              animation: 'layoutSpin 0.8s linear infinite',
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
            @keyframes layoutSpin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return children || null;
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      backgroundColor: theme.colors.background.secondary,
      fontFamily: theme.typography.fontFamily.sans,
    }}>
      <Header />

      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
      }}>
        <Sidebar />

        <main style={{
          flex: 1,
          overflow: 'auto',
          padding: theme.spacing[6],
          backgroundColor: theme.colors.background.secondary,
          minHeight: `calc(100vh - ${theme.components.header.height})`,
        }}>
          <div style={{
            maxWidth: '72rem',
            margin: '0 auto',
            width: '100%',
          }}>
            {children}
          </div>
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          main {
            padding: ${theme.spacing[4]} !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Layout;