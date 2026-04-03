import { useAuth } from '../context/AuthContext';
import LoginForm from '../components/auth/LoginForm';
import theme from '../config/theme';

const LoginPage = () => {
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
              animation: 'loginPageSpin 0.8s linear infinite',
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
            @keyframes loginPageSpin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    window.location.href = '/dashboard';
    return null;
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: theme.colors.background.secondary,
      fontFamily: theme.typography.fontFamily.sans,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <LoginForm />
    </div>
  );
};

export default LoginPage;