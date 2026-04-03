const API_BASE_URL = '/api';

const TOKEN_STORAGE_KEY = 'access_token';
const REFRESH_TOKEN_STORAGE_KEY = 'refresh_token';

let isRefreshing = false;
let pendingRequests = [];

const getStoredToken = () => {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

const getStoredRefreshToken = () => {
  try {
    return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

const setStoredTokens = (accessToken, refreshToken) => {
  try {
    if (accessToken) {
      localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
    }
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
    }
  } catch {
    // Storage unavailable
  }
};

const clearStoredTokens = () => {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    // Storage unavailable
  }
};

const redirectToLogin = () => {
  clearStoredTokens();
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
};

const formatError = (error) => {
  if (error && error.response && error.response.data) {
    const data = error.response.data;
    return {
      success: false,
      status: error.response.status,
      message: data.error ? data.error.message : 'An unexpected error occurred',
      details: data.error ? data.error.details || null : null,
    };
  }

  if (error && error.message) {
    return {
      success: false,
      status: 0,
      message: error.message === 'Failed to fetch'
        ? 'Unable to connect to the server. Please check your connection.'
        : error.message,
      details: null,
    };
  }

  return {
    success: false,
    status: 0,
    message: 'An unexpected error occurred. Please try again later.',
    details: null,
  };
};

const buildHeaders = (customHeaders = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

const buildUploadHeaders = (customHeaders = {}) => {
  const headers = { ...customHeaders };

  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

const refreshAccessToken = async () => {
  const refreshToken = getStoredRefreshToken();

  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.success && data.data && data.data.access_token) {
      setStoredTokens(data.data.access_token, null);
      return data.data.access_token;
    }

    return null;
  } catch {
    return null;
  }
};

const processQueue = (newToken) => {
  for (const pending of pendingRequests) {
    if (newToken) {
      pending.resolve(newToken);
    } else {
      pending.reject(new Error('Token refresh failed'));
    }
  }
  pendingRequests = [];
};

const handleUnauthorized = async () => {
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      pendingRequests.push({ resolve, reject });
    });
  }

  isRefreshing = true;

  try {
    const newToken = await refreshAccessToken();

    if (newToken) {
      processQueue(newToken);
      return newToken;
    }

    processQueue(null);
    redirectToLogin();
    return null;
  } finally {
    isRefreshing = false;
  }
};

const makeRequest = async (method, url, options = {}) => {
  const {
    body = null,
    headers = {},
    isUpload = false,
    retryOnUnauthorized = true,
  } = options;

  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

  const requestHeaders = isUpload
    ? buildUploadHeaders(headers)
    : buildHeaders(headers);

  const fetchOptions = {
    method,
    headers: requestHeaders,
  };

  if (body !== null && body !== undefined) {
    if (isUpload) {
      fetchOptions.body = body;
    } else {
      fetchOptions.body = JSON.stringify(body);
    }
  }

  try {
    let response = await fetch(fullUrl, fetchOptions);

    if (response.status === 401 && retryOnUnauthorized) {
      const newToken = await handleUnauthorized();

      if (newToken) {
        if (isUpload) {
          fetchOptions.headers = buildUploadHeaders(headers);
        } else {
          fetchOptions.headers = buildHeaders(headers);
        }

        response = await fetch(fullUrl, fetchOptions);
      } else {
        const errorData = await parseResponse(response);
        throw {
          response: {
            status: 401,
            data: errorData,
          },
          message: 'Authentication failed',
        };
      }
    }

    const data = await parseResponse(response);

    if (!response.ok) {
      throw {
        response: {
          status: response.status,
          data,
        },
        message: data.error ? data.error.message : `Request failed with status ${response.status}`,
      };
    }

    return data;
  } catch (error) {
    if (error && error.response) {
      throw formatError(error);
    }
    throw formatError(error);
  }
};

const parseResponse = async (response) => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  if (contentType.includes('text/csv') || contentType.includes('text/plain')) {
    const text = await response.text();
    return { data: text };
  }

  try {
    return await response.json();
  } catch {
    const text = await response.text();
    return { data: text };
  }
};

const get = (url, options = {}) => {
  return makeRequest('GET', url, options);
};

const post = (url, body = null, options = {}) => {
  return makeRequest('POST', url, { ...options, body });
};

const put = (url, body = null, options = {}) => {
  return makeRequest('PUT', url, { ...options, body });
};

const patch = (url, body = null, options = {}) => {
  return makeRequest('PATCH', url, { ...options, body });
};

const del = (url, options = {}) => {
  return makeRequest('DELETE', url, options);
};

const upload = (url, formData, options = {}) => {
  return makeRequest('POST', url, {
    ...options,
    body: formData,
    isUpload: true,
  });
};

const apiClient = {
  get,
  post,
  put,
  patch,
  delete: del,
  upload,
  getStoredToken,
  getStoredRefreshToken,
  setStoredTokens,
  clearStoredTokens,
  formatError,
};

export default apiClient;