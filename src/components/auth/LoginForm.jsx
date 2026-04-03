import { useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';

const LoginForm = () => {
  const { login, isLoading, error, clearError, isAuthenticated } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);

  if (isAuthenticated) {
    window.location.href = '/dashboard';
    return null;
  }

  const validate = useCallback(() => {
    const errors = {};

    if (!username.trim()) {
      errors.username = 'Username is required';
    } else if (username.trim().length > 64) {
      errors.username = 'Username must be at most 64 characters';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (password.length > 128) {
      errors.password = 'Password must be at most 128 characters';
    }

    return errors;
  }, [username, password]);

  const handleUsernameChange = useCallback((e) => {
    setUsername(e.target.value);
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next.username;
      return next;
    });
    setSubmitError(null);
    clearError();
  }, [clearError]);

  const handlePasswordChange = useCallback((e) => {
    setPassword(e.target.value);
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next.password;
      return next;
    });
    setSubmitError(null);
    clearError();
  }, [clearError]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    setSubmitError(null);
    clearError();

    const errors = validate();

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});

    const result = await login(username.trim(), password);

    if (result.success) {
      window.location.href = '/dashboard';
    } else {
      setSubmitError(result.message || 'Login failed. Please try again.');
    }
  }, [username, password, login, clearError, validate]);

  const displayError = submitError || error || null;

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
        width: '100%',
        maxWidth: '24rem',
        padding: theme.spacing[8],
      }}>
        <div style={{
          background: theme.components.card.background,
          border: theme.components.card.border,
          borderRadius: theme.components.card.borderRadius,
          padding: theme.components.card.padding,
          boxShadow: theme.components.card.shadow,
        }}>
          <div style={{
            textAlign: 'center',
            marginBottom: theme.spacing[6],
          }}>
            <h1 style={{
              fontSize: theme.typography.fontSize['2xl'],
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.text.primary,
              margin: 0,
              marginBottom: theme.spacing[2],
            }}>
              Sign In
            </h1>
            <p style={{
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.text.secondary,
              margin: 0,
            }}>
              Enter your credentials to access your account
            </p>
          </div>

          {displayError && (
            <div style={{
              background: theme.components.toast.error.background,
              border: theme.components.toast.error.border,
              color: theme.components.toast.error.color,
              borderRadius: theme.components.toast.borderRadius,
              padding: theme.components.toast.padding,
              marginBottom: theme.spacing[4],
              fontSize: theme.typography.fontSize.sm,
            }}>
              {displayError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: theme.spacing[4] }}>
              <label
                htmlFor="username"
                style={{
                  display: 'block',
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: theme.typography.fontWeight.medium,
                  color: theme.colors.text.primary,
                  marginBottom: theme.spacing[1],
                }}
              >
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={handleUsernameChange}
                disabled={isLoading}
                placeholder="Enter your username"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: theme.components.input.background,
                  color: theme.components.input.color,
                  border: validationErrors.username
                    ? theme.components.input.borderError
                    : theme.components.input.border,
                  borderRadius: theme.components.input.borderRadius,
                  padding: `${theme.components.input.paddingY} ${theme.components.input.paddingX}`,
                  fontSize: theme.components.input.fontSize,
                  outline: 'none',
                  transition: theme.transitions.default,
                  opacity: isLoading ? 0.7 : 1,
                }}
                onFocus={(e) => {
                  if (!validationErrors.username) {
                    e.target.style.border = theme.components.input.borderFocus;
                    e.target.style.boxShadow = theme.components.input.boxShadowFocus;
                  }
                }}
                onBlur={(e) => {
                  e.target.style.border = validationErrors.username
                    ? theme.components.input.borderError
                    : theme.components.input.border;
                  e.target.style.boxShadow = 'none';
                }}
              />
              {validationErrors.username && (
                <p style={{
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.error[600],
                  margin: 0,
                  marginTop: theme.spacing[1],
                }}>
                  {validationErrors.username}
                </p>
              )}
            </div>

            <div style={{ marginBottom: theme.spacing[6] }}>
              <label
                htmlFor="password"
                style={{
                  display: 'block',
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: theme.typography.fontWeight.medium,
                  color: theme.colors.text.primary,
                  marginBottom: theme.spacing[1],
                }}
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={handlePasswordChange}
                disabled={isLoading}
                placeholder="Enter your password"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: theme.components.input.background,
                  color: theme.components.input.color,
                  border: validationErrors.password
                    ? theme.components.input.borderError
                    : theme.components.input.border,
                  borderRadius: theme.components.input.borderRadius,
                  padding: `${theme.components.input.paddingY} ${theme.components.input.paddingX}`,
                  fontSize: theme.components.input.fontSize,
                  outline: 'none',
                  transition: theme.transitions.default,
                  opacity: isLoading ? 0.7 : 1,
                }}
                onFocus={(e) => {
                  if (!validationErrors.password) {
                    e.target.style.border = theme.components.input.borderFocus;
                    e.target.style.boxShadow = theme.components.input.boxShadowFocus;
                  }
                }}
                onBlur={(e) => {
                  e.target.style.border = validationErrors.password
                    ? theme.components.input.borderError
                    : theme.components.input.border;
                  e.target.style.boxShadow = 'none';
                }}
              />
              {validationErrors.password && (
                <p style={{
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.error[600],
                  margin: 0,
                  marginTop: theme.spacing[1],
                }}>
                  {validationErrors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: theme.spacing[2],
                background: isLoading
                  ? theme.components.button.primary.disabledBackground
                  : theme.components.button.primary.background,
                color: isLoading
                  ? theme.components.button.primary.disabledColor
                  : theme.components.button.primary.color,
                border: 'none',
                borderRadius: theme.components.button.primary.borderRadius,
                padding: `${theme.components.button.primary.paddingY} ${theme.components.button.primary.paddingX}`,
                fontSize: theme.components.button.primary.fontSize,
                fontWeight: theme.components.button.primary.fontWeight,
                fontFamily: theme.typography.fontFamily.sans,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: theme.transitions.default,
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.target.style.background = theme.components.button.primary.hoverBackground;
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  e.target.style.background = theme.components.button.primary.background;
                }
              }}
              onMouseDown={(e) => {
                if (!isLoading) {
                  e.target.style.background = theme.components.button.primary.activeBackground;
                }
              }}
              onMouseUp={(e) => {
                if (!isLoading) {
                  e.target.style.background = theme.components.button.primary.hoverBackground;
                }
              }}
            >
              {isLoading && (
                <span style={{
                  display: 'inline-block',
                  width: '1rem',
                  height: '1rem',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderTopColor: '#ffffff',
                  borderRadius: '50%',
                  animation: 'loginFormSpin 0.8s linear infinite',
                }} />
              )}
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <style>{`
          @keyframes loginFormSpin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default LoginForm;