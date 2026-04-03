import apiClient from './apiClient';

const API_BASE_URL = '/api';
const TOKEN_STORAGE_KEY = 'access_token';

const getStoredToken = () => {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

const uploadDocument = async (file, onProgress = null) => {
  if (!file) {
    return {
      success: false,
      status: 400,
      message: 'A file is required for upload',
      details: null,
    };
  }

  const formData = new FormData();
  formData.append('file', file);

  if (onProgress && typeof onProgress === 'function') {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percent: percentComplete,
          });
        }
      });

      xhr.addEventListener('load', () => {
        try {
          const data = JSON.parse(xhr.responseText);

          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(data);
          } else {
            resolve({
              success: false,
              status: xhr.status,
              message: data.error ? data.error.message : `Upload failed with status ${xhr.status}`,
              details: data.error ? data.error.details || null : null,
            });
          }
        } catch {
          resolve({
            success: false,
            status: xhr.status,
            message: 'Failed to parse server response',
            details: null,
          });
        }
      });

      xhr.addEventListener('error', () => {
        resolve({
          success: false,
          status: 0,
          message: 'Unable to connect to the server. Please check your connection.',
          details: null,
        });
      });

      xhr.addEventListener('abort', () => {
        resolve({
          success: false,
          status: 0,
          message: 'Upload was cancelled',
          details: null,
        });
      });

      xhr.addEventListener('timeout', () => {
        resolve({
          success: false,
          status: 0,
          message: 'Upload timed out. Please try again.',
          details: null,
        });
      });

      xhr.open('POST', `${API_BASE_URL}/documents/upload`);

      const token = getStoredToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.send(formData);
    });
  }

  try {
    const response = await apiClient.upload('/documents/upload', formData);
    return response;
  } catch (error) {
    return error;
  }
};

const getUploadStatus = async (uploadId) => {
  if (!uploadId) {
    return {
      success: false,
      status: 400,
      message: 'Upload ID is required',
      details: null,
    };
  }

  try {
    const response = await apiClient.get(`/documents/status/${uploadId}`);
    return response;
  } catch (error) {
    return error;
  }
};

const getExtractionResult = async (uploadId) => {
  if (!uploadId) {
    return {
      success: false,
      status: 400,
      message: 'Upload ID is required',
      details: null,
    };
  }

  try {
    const response = await apiClient.get(`/documents/result/${uploadId}`);
    return response;
  } catch (error) {
    return error;
  }
};

const listUploads = async (filters = {}) => {
  const {
    status,
    filetype,
    start_date,
    end_date,
    page,
    page_size,
    sort_by,
    sort_order,
  } = filters;

  const params = new URLSearchParams();

  if (status) params.append('status', status);
  if (filetype) params.append('filetype', filetype);
  if (start_date) params.append('start_date', start_date);
  if (end_date) params.append('end_date', end_date);
  if (page) params.append('page', String(page));
  if (page_size) params.append('page_size', String(page_size));
  if (sort_by) params.append('sort_by', sort_by);
  if (sort_order) params.append('sort_order', sort_order);

  const queryString = params.toString();
  const url = queryString ? `/documents/list?${queryString}` : '/documents/list';

  try {
    const response = await apiClient.get(url);
    return response;
  } catch (error) {
    return error;
  }
};

const deleteDocument = async (uploadId) => {
  if (!uploadId) {
    return {
      success: false,
      status: 400,
      message: 'Upload ID is required',
      details: null,
    };
  }

  try {
    const response = await apiClient.delete(`/documents/${uploadId}`);
    return response;
  } catch (error) {
    return error;
  }
};

const getUploadStats = async () => {
  try {
    const response = await apiClient.get('/documents/stats');
    return response;
  } catch (error) {
    return error;
  }
};

const pollUploadStatus = async (uploadId, options = {}) => {
  const {
    interval = 2000,
    maxAttempts = 60,
    onStatusChange = null,
  } = options;

  if (!uploadId) {
    return {
      success: false,
      status: 400,
      message: 'Upload ID is required',
      details: null,
    };
  }

  let attempts = 0;
  let lastStatus = null;

  return new Promise((resolve) => {
    const poll = async () => {
      attempts++;

      const response = await getUploadStatus(uploadId);

      if (!response.success) {
        if (attempts >= maxAttempts) {
          resolve({
            success: false,
            status: 0,
            message: 'Polling timed out. Please check the status manually.',
            details: null,
          });
          return;
        }

        setTimeout(poll, interval);
        return;
      }

      const currentStatus = response.data ? response.data.status : null;

      if (currentStatus !== lastStatus) {
        lastStatus = currentStatus;
        if (onStatusChange && typeof onStatusChange === 'function') {
          onStatusChange(response.data);
        }
      }

      if (currentStatus === 'completed' || currentStatus === 'failed') {
        resolve(response);
        return;
      }

      if (attempts >= maxAttempts) {
        resolve({
          success: false,
          status: 0,
          message: 'Polling timed out. Please check the status manually.',
          details: null,
        });
        return;
      }

      setTimeout(poll, interval);
    };

    poll();
  });
};

const documentService = {
  uploadDocument,
  getUploadStatus,
  getExtractionResult,
  listUploads,
  deleteDocument,
  getUploadStats,
  pollUploadStatus,
};

export default documentService;