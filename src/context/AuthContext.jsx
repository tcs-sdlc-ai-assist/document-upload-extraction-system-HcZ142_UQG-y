import { createContext, useState, useEffect, useCallback, useContext } from 'react';
import authService from '../services/authService';
import apiClient from '../services/apiClient';

const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const token = apiClient.getStoredToken();

    if (!token) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }

    try {
      const response = await authService.getSession();

      if (response.success && response.data && response.data.active) {
        setUser(response.data.user);
        setIsAuthenticated(true);
      } else {
        const refreshResult = await authService.refreshToken();

        if (refreshResult.success) {
          const retrySession = await authService.getSession();

          if (retrySession.success && retrySession.data && retrySession.data.active) {
            setUser(retrySession.data.user);
            setIsAuthenticated(true);
          } else {
            setUser(null);
            setIsAuthenticated(false);
            apiClient.clearStoredTokens();
          }
        } else {
          setUser(null);
          setIsAuthenticated(false);
          apiClient.clearStoredTokens();
        }
      }
    } catch {
      setUser(null);
      setIsAuthenticated(false);
      apiClient.clearStoredTokens();
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = useCallback(async (username, password) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.login(username, password);

      if (response.success && response.data) {
        setUser(response.data.user);
        setIsAuthenticated(true);
        setIsLoading(false);

        return {
          success: true,
          data: response.data,
        };
      }

      const errorMessage = response.message || 'Login failed. Please try again.';
      setError(errorMessage);
      setIsLoading(false);

      return {
        success: false,
        message: errorMessage,
        details: response.details || null,
      };
    } catch (err) {
      const errorMessage = err.message || 'An unexpected error occurred during login.';
      setError(errorMessage);
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);

      return {
        success: false,
        message: errorMessage,
        details: err.details || null,
      };
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await authService.logout();
    } catch {
      // Logout should always succeed from the client perspective
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      apiClient.clearStoredTokens();
      setIsLoading(false);
    }
  }, []);

  const refreshToken = useCallback(async () => {
    setError(null);

    try {
      const response = await authService.refreshToken();

      if (response.success && response.data && response.data.access_token) {
        return {
          success: true,
          data: response.data,
        };
      }

      setUser(null);
      setIsAuthenticated(false);
      apiClient.clearStoredTokens();

      return {
        success: false,
        message: response.message || 'Token refresh failed.',
      };
    } catch (err) {
      setUser(null);
      setIsAuthenticated(false);
      apiClient.clearStoredTokens();

      return {
        success: false,
        message: err.message || 'An unexpected error occurred during token refresh.',
      };
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    refreshToken,
    checkSession,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

export { AuthContext, AuthProvider, useAuth };
export default AuthContext;