import apiClient from './apiClient';

const sendLogEvent = async (event) => {
  if (!event || !event.event_type || !event.timestamp) {
    return {
      success: false,
      status: 400,
      message: 'event_type and timestamp are required',
      details: null,
    };
  }

  try {
    const response = await apiClient.post('/logs/event', event);
    return response;
  } catch (error) {
    return error;
  }
};

const getAuditLogs = async (filters = {}) => {
  const {
    user_id,
    action,
    status,
    ip_address,
    start_time,
    end_time,
    page,
    page_size,
  } = filters;

  const params = new URLSearchParams();

  if (user_id) params.append('user_id', user_id);
  if (action) params.append('action', action);
  if (status) params.append('status', status);
  if (ip_address) params.append('ip_address', ip_address);
  if (start_time) params.append('start_time', start_time);
  if (end_time) params.append('end_time', end_time);
  if (page) params.append('page', String(page));
  if (page_size) params.append('page_size', String(page_size));

  const queryString = params.toString();
  const url = queryString ? `/logs/audit?${queryString}` : '/logs/audit';

  try {
    const response = await apiClient.get(url);
    return response;
  } catch (error) {
    return error;
  }
};

const exportAuditLogs = async (filters = {}, format = 'json') => {
  const {
    user_id,
    action,
    status,
    start_time,
    end_time,
  } = filters;

  const params = new URLSearchParams();

  if (format) params.append('format', format);
  if (user_id) params.append('user_id', user_id);
  if (action) params.append('action', action);
  if (status) params.append('status', status);
  if (start_time) params.append('start_time', start_time);
  if (end_time) params.append('end_time', end_time);

  const queryString = params.toString();
  const url = queryString ? `/logs/audit/export?${queryString}` : '/logs/audit/export';

  try {
    const response = await apiClient.get(url);
    return response;
  } catch (error) {
    return error;
  }
};

const getAuditLogById = async (id) => {
  if (!id) {
    return {
      success: false,
      status: 400,
      message: 'Log ID is required',
      details: null,
    };
  }

  try {
    const response = await apiClient.get(`/logs/audit/${id}`);
    return response;
  } catch (error) {
    return error;
  }
};

const logService = {
  sendLogEvent,
  getAuditLogs,
  exportAuditLogs,
  getAuditLogById,
};

export default logService;