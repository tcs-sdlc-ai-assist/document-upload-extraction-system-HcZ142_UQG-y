import apiClient from './apiClient';

const login = async (username, password) => {
  const response = await apiClient.post('/auth/login', {
    username,
    password,
  });

  if (response.success && response.data) {
    const { access_token, refresh_token, user } = response.data;

    apiClient.setStoredTokens(access_token, refresh_token);

    return {
      success: true,
      data: {
        access_token,
        refresh_token,
        user,
        expires_in: response.data.expires_in,
      },
    };
  }

  return response;
};

const logout = async () => {
  const refreshToken = apiClient.getStoredRefreshToken();

  if (!refreshToken) {
    apiClient.clearStoredTokens();
    return { success: true, data: { message: 'Logged out successfully.' } };
  }

  try {
    const response = await apiClient.post('/auth/logout', {
      refresh_token: refreshToken,
    });

    apiClient.clearStoredTokens();

    return {
      success: true,
      data: response.data || { message: 'Logged out successfully.' },
    };
  } catch {
    apiClient.clearStoredTokens();

    return {
      success: true,
      data: { message: 'Logged out successfully.' },
    };
  }
};

const refreshToken = async () => {
  const storedRefreshToken = apiClient.getStoredRefreshToken();

  if (!storedRefreshToken) {
    return {
      success: false,
      message: 'No refresh token available',
    };
  }

  const response = await apiClient.post(
    '/auth/refresh',
    { refresh_token: storedRefreshToken },
    { retryOnUnauthorized: false }
  );

  if (response.success && response.data && response.data.access_token) {
    apiClient.setStoredTokens(response.data.access_token, null);

    return {
      success: true,
      data: {
        access_token: response.data.access_token,
        expires_in: response.data.expires_in,
      },
    };
  }

  return response;
};

const getSession = async () => {
  const token = apiClient.getStoredToken();

  if (!token) {
    return {
      success: false,
      message: 'No access token available',
    };
  }

  const response = await apiClient.get('/auth/session');

  if (response.success && response.data) {
    return {
      success: true,
      data: {
        active: response.data.active,
        user: response.data.user,
        expires_in: response.data.expires_in,
      },
    };
  }

  return response;
};

const isAuthenticated = () => {
  const token = apiClient.getStoredToken();
  return !!token;
};

const getUser = async () => {
  try {
    const session = await getSession();

    if (session.success && session.data && session.data.user) {
      return session.data.user;
    }

    return null;
  } catch {
    return null;
  }
};

const authService = {
  login,
  logout,
  refreshToken,
  getSession,
  isAuthenticated,
  getUser,
};

export default authService;