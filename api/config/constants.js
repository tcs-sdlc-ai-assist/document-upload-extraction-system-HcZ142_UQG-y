const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const SUPPORTED_FILE_TYPES = {
  PDF: 'pdf',
  CSV: 'csv',
  XML: 'xml',
  XLSX: 'xlsx',
  XLS: 'xls',
  DOCX: 'docx',
};

const MIME_TYPES = {
  'application/pdf': SUPPORTED_FILE_TYPES.PDF,
  'text/csv': SUPPORTED_FILE_TYPES.CSV,
  'application/xml': SUPPORTED_FILE_TYPES.XML,
  'text/xml': SUPPORTED_FILE_TYPES.XML,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': SUPPORTED_FILE_TYPES.XLSX,
  'application/vnd.ms-excel': SUPPORTED_FILE_TYPES.XLS,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': SUPPORTED_FILE_TYPES.DOCX,
};

const ALLOWED_MIME_TYPES = Object.keys(MIME_TYPES);

const UPLOAD_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
};

const EXTRACTION_SLA_TIMEOUT_MS = 30000;

const TOKEN_EXPIRY = {
  ACCESS: process.env.JWT_EXPIRY || '15m',
  REFRESH: process.env.REFRESH_TOKEN_EXPIRY || '7d',
};

const AUDIT_ACTIONS = {
  USER_REGISTER: 'user.register',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  TOKEN_REFRESH: 'token.refresh',
  DOCUMENT_UPLOAD: 'document.upload',
  DOCUMENT_DELETE: 'document.delete',
  EXTRACTION_START: 'extraction.start',
  EXTRACTION_COMPLETE: 'extraction.complete',
  EXTRACTION_FAIL: 'extraction.fail',
};

const AUDIT_STATUS = {
  SUCCESS: 'success',
  FAILURE: 'failure',
};

const ERROR_MESSAGES = {
  // Authentication errors
  INVALID_CREDENTIALS: 'Invalid username or password',
  TOKEN_EXPIRED: 'Token has expired',
  TOKEN_INVALID: 'Invalid or malformed token',
  TOKEN_MISSING: 'Authentication token is required',
  REFRESH_TOKEN_INVALID: 'Invalid or expired refresh token',
  UNAUTHORIZED: 'You are not authorized to perform this action',
  FORBIDDEN: 'Access denied',

  // User errors
  USER_NOT_FOUND: 'User not found',
  USER_ALREADY_EXISTS: 'A user with this username or email already exists',
  USERNAME_TAKEN: 'Username is already taken',
  EMAIL_TAKEN: 'Email is already registered',

  // File upload errors
  FILE_REQUIRED: 'A file is required for upload',
  FILE_TOO_LARGE: `File size exceeds the maximum allowed size of ${MAX_FILE_SIZE_MB}MB`,
  FILE_TYPE_NOT_SUPPORTED: 'File type is not supported. Supported types: PDF, CSV, XML, XLSX, XLS, DOCX',
  FILE_UPLOAD_FAILED: 'File upload failed. Please try again',

  // Document errors
  DOCUMENT_NOT_FOUND: 'Document not found',
  DOCUMENT_ALREADY_PROCESSING: 'Document is already being processed',

  // Extraction errors
  EXTRACTION_FAILED: 'Data extraction failed. Please try again',
  EXTRACTION_TIMEOUT: 'Extraction timed out. Please try again',
  EXTRACTION_NOT_FOUND: 'Extraction result not found',

  // General errors
  INTERNAL_SERVER_ERROR: 'An unexpected error occurred. Please try again later',
  VALIDATION_ERROR: 'Validation failed. Please check your input',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later',
  NOT_FOUND: 'The requested resource was not found',
};

module.exports = {
  MAX_FILE_SIZE_MB,
  MAX_FILE_SIZE_BYTES,
  SUPPORTED_FILE_TYPES,
  MIME_TYPES,
  ALLOWED_MIME_TYPES,
  UPLOAD_STATUS,
  USER_ROLES,
  EXTRACTION_SLA_TIMEOUT_MS,
  TOKEN_EXPIRY,
  AUDIT_ACTIONS,
  AUDIT_STATUS,
  ERROR_MESSAGES,
};