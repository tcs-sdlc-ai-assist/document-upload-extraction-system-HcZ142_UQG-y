import { useAuth } from '../../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#fafafa',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <div
            style={{
              width: '2.5rem',
              height: '2.5rem',
              border: '3px solid #e5e5e5',
              borderTopColor: '#4f46e5',
              borderRadius: '50%',
              animation: 'protectedRouteSpin 0.8s linear infinite',
            }}
          />
          <style>{`
            @keyframes protectedRouteSpin {
              to { transform: rotate(360deg); }
            }
          `}</style>
          <span style={{
            fontSize: '0.875rem',
            color: '#525252',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          }}>
            Loading...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = '/login';
    return null;
  }

  return children;
};

export default ProtectedRoute;