const DocumentUploadRepository = require('../repositories/DocumentUploadRepository');
const ExtractionResultRepository = require('../repositories/ExtractionResultRepository');
const ExtractionEngineFactory = require('./ExtractionEngineFactory');
const ProgressNotifier = require('./ProgressNotifier');
const MonitoringService = require('./MonitoringService');
const LogIngestionService = require('./LogIngestionService');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const {
  UPLOAD_STATUS,
  MIME_TYPES,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
  EXTRACTION_SLA_TIMEOUT_MS,
  AUDIT_ACTIONS,
  AUDIT_STATUS,
  ERROR_MESSAGES,
} = require('../config/constants');
const { ADDITIONAL_MIME_TYPES } = require('../config/uploadConfig');

const resolveFileType = (file) => {
  if (!file) {
    return null;
  }

  const mimeType = file.mimetype ? file.mimetype.toLowerCase().trim() : null;

  if (mimeType && MIME_TYPES[mimeType]) {
    return MIME_TYPES[mimeType];
  }

  if (mimeType && ADDITIONAL_MIME_TYPES[mimeType]) {
    return ADDITIONAL_MIME_TYPES[mimeType];
  }

  if (file.originalname) {
    const lastDotIndex = file.originalname.lastIndexOf('.');
    if (lastDotIndex !== -1 && lastDotIndex < file.originalname.length - 1) {
      return file.originalname.substring(lastDotIndex + 1).toLowerCase().trim();
    }
  }

  return null;
};

const validateFile = (file) => {
  if (!file) {
    logger.warn('DocumentUploadService: no file provided');
    throw new AppError(ERROR_MESSAGES.FILE_REQUIRED, 400);
  }

  if (!file.buffer || file.buffer.length === 0) {
    logger.warn('DocumentUploadService: empty file buffer');
    throw new AppError(ERROR_MESSAGES.FILE_REQUIRED, 400);
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    logger.warn('DocumentUploadService: file too large', {
      size: file.size,
      maxSize: MAX_FILE_SIZE_BYTES,
    });
    throw new AppError(ERROR_MESSAGES.FILE_TOO_LARGE, 413);
  }

  const mimeType = file.mimetype ? file.mimetype.toLowerCase().trim() : null;
  const allAllowedMimes = [...ALLOWED_MIME_TYPES, ...Object.keys(ADDITIONAL_MIME_TYPES)];

  if (!mimeType || !allAllowedMimes.includes(mimeType)) {
    logger.warn('DocumentUploadService: unsupported file type', {
      mimetype: file.mimetype,
      originalname: file.originalname,
    });
    throw new AppError(ERROR_MESSAGES.FILE_TYPE_NOT_SUPPORTED, 400);
  }

  const fileType = resolveFileType(file);

  if (!fileType) {
    logger.warn('DocumentUploadService: could not resolve file type', {
      mimetype: file.mimetype,
      originalname: file.originalname,
    });
    throw new AppError(ERROR_MESSAGES.FILE_TYPE_NOT_SUPPORTED, 400);
  }

  if (!ExtractionEngineFactory.isSupported(fileType)) {
    logger.warn('DocumentUploadService: no extraction engine for file type', { fileType });
    throw new AppError(ERROR_MESSAGES.FILE_TYPE_NOT_SUPPORTED, 400);
  }

  return fileType;
};

const uploadDocument = async (file, userId) => {
  logger.info('DocumentUploadService: starting document upload', {
    userId,
    filename: file ? file.originalname : null,
    size: file ? file.size : null,
  });

  const fileType = validateFile(file);

  const filename = file.originalname || 'unknown';
  const size = file.size || file.buffer.length;

  let upload;
  try {
    upload = await DocumentUploadRepository.create({
      user_id: userId,
      filename,
      filetype: fileType,
      size,
      status: UPLOAD_STATUS.PENDING,
    });
  } catch (err) {
    logger.error('DocumentUploadService: failed to create upload record', {
      error: err.message,
      userId,
      filename,
    });
    throw new AppError(ERROR_MESSAGES.FILE_UPLOAD_FAILED, 500);
  }

  const uploadId = upload.id;

  logger.info('DocumentUploadService: upload record created', {
    uploadId,
    userId,
    filename,
    fileType,
  });

  await ProgressNotifier.notify(uploadId, 0, UPLOAD_STATUS.PENDING);

  LogIngestionService.ingestEvent({
    event_type: 'UPLOAD',
    timestamp: new Date().toISOString(),
    user_id: userId,
    details: {
      upload_id: uploadId,
      filename,
      filetype: fileType,
      size,
    },
    status: AUDIT_STATUS.SUCCESS,
  }, {
    user_id: userId,
  }).catch((err) => {
    logger.warn('DocumentUploadService: failed to log upload event', {
      error: err.message,
      uploadId,
    });
  });

  runExtraction(uploadId, file.buffer, fileType, userId).catch((err) => {
    logger.error('DocumentUploadService: extraction background task failed', {
      error: err.message,
      uploadId,
    });
  });

  return {
    upload_id: uploadId,
    status: UPLOAD_STATUS.PENDING,
    message: 'File uploaded and queued for extraction.',
  };
};

const runExtraction = async (uploadId, buffer, fileType, userId) => {
  logger.info('DocumentUploadService: starting extraction', {
    uploadId,
    fileType,
  });

  await ProgressNotifier.notify(uploadId, 10, UPLOAD_STATUS.PROCESSING);

  const startTime = Date.now();

  try {
    const engine = ExtractionEngineFactory.getEngine(fileType);

    await ProgressNotifier.notify(uploadId, 20, UPLOAD_STATUS.PROCESSING);

    const extractionPromise = engine.extract(buffer);

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new ExtractionTimeoutError(ERROR_MESSAGES.EXTRACTION_TIMEOUT));
      }, EXTRACTION_SLA_TIMEOUT_MS);
    });

    const result = await Promise.race([extractionPromise, timeoutPromise]);

    const duration = Date.now() - startTime;

    MonitoringService.recordExtractionTime(duration);

    await ProgressNotifier.notify(uploadId, 80, UPLOAD_STATUS.PROCESSING);

    const extractedData = {
      extracted_text: result.extracted_text || '',
      extracted_tables: result.extracted_tables || [],
      metadata: result.metadata || {},
      page_count: result.page_count || null,
    };

    if (result.extracted_html) {
      extractedData.extracted_html = result.extracted_html;
    }

    if (result.geospatial_data) {
      extractedData.geospatial_data = result.geospatial_data;
    }

    await ExtractionResultRepository.save({
      upload_id: uploadId,
      extracted_data: extractedData,
    });

    await ProgressNotifier.notify(uploadId, 100, UPLOAD_STATUS.COMPLETED);

    logger.info('DocumentUploadService: extraction completed successfully', {
      uploadId,
      fileType,
      duration: `${duration}ms`,
      textLength: extractedData.extracted_text.length,
    });

    LogIngestionService.ingestEvent({
      event_type: 'EXTRACTION',
      timestamp: new Date().toISOString(),
      user_id: userId,
      details: {
        upload_id: uploadId,
        filetype: fileType,
        duration_ms: duration,
        text_length: extractedData.extracted_text.length,
        table_count: extractedData.extracted_tables.length,
      },
      status: AUDIT_STATUS.SUCCESS,
    }, {
      user_id: userId,
    }).catch((err) => {
      logger.warn('DocumentUploadService: failed to log extraction success event', {
        error: err.message,
        uploadId,
      });
    });

    return extractedData;
  } catch (err) {
    const duration = Date.now() - startTime;

    MonitoringService.recordExtractionTime(duration);
    MonitoringService.recordError(`extraction_${fileType}`);

    let errorMessage;

    if (err instanceof ExtractionTimeoutError) {
      errorMessage = ERROR_MESSAGES.EXTRACTION_TIMEOUT;
      logger.error('DocumentUploadService: extraction timed out', {
        uploadId,
        fileType,
        duration: `${duration}ms`,
        slaTimeout: EXTRACTION_SLA_TIMEOUT_MS,
      });
    } else if (err.isOperational) {
      errorMessage = err.message;
      logger.error('DocumentUploadService: extraction engine error', {
        uploadId,
        fileType,
        error: err.message,
        duration: `${duration}ms`,
      });
    } else {
      errorMessage = ERROR_MESSAGES.EXTRACTION_FAILED;
      logger.error('DocumentUploadService: unexpected extraction error', {
        uploadId,
        fileType,
        error: err.message,
        stack: err.stack,
        duration: `${duration}ms`,
      });
    }

    await ProgressNotifier.notify(uploadId, 100, UPLOAD_STATUS.FAILED, errorMessage);

    LogIngestionService.ingestEvent({
      event_type: 'ERROR',
      timestamp: new Date().toISOString(),
      user_id: userId,
      details: {
        upload_id: uploadId,
        filetype: fileType,
        error: errorMessage,
        duration_ms: duration,
      },
      status: AUDIT_STATUS.FAILURE,
    }, {
      user_id: userId,
    }).catch((logErr) => {
      logger.warn('DocumentUploadService: failed to log extraction failure event', {
        error: logErr.message,
        uploadId,
      });
    });

    return null;
  }
};

const getStatus = async (uploadId, userId) => {
  logger.info('DocumentUploadService: getting upload status', { uploadId, userId });

  if (!uploadId) {
    throw new AppError(ERROR_MESSAGES.DOCUMENT_NOT_FOUND, 400);
  }

  const inMemoryProgress = ProgressNotifier.getProgress(uploadId);

  let upload;

  if (userId) {
    upload = await DocumentUploadRepository.findByIdAndUserId(uploadId, userId);
  } else {
    upload = await DocumentUploadRepository.findById(uploadId);
  }

  if (!upload) {
    logger.warn('DocumentUploadService: upload not found', { uploadId, userId });
    throw new AppError(ERROR_MESSAGES.DOCUMENT_NOT_FOUND, 404);
  }

  if (inMemoryProgress) {
    return {
      upload_id: upload.id,
      status: inMemoryProgress.status,
      progress: inMemoryProgress.progress,
      error: inMemoryProgress.error,
      filename: upload.filename,
      filetype: upload.filetype,
      size: upload.size,
      created_at: upload.created_at,
      updated_at: inMemoryProgress.updated_at || upload.updated_at,
    };
  }

  let progress = 0;
  if (upload.status === UPLOAD_STATUS.COMPLETED) {
    progress = 100;
  } else if (upload.status === UPLOAD_STATUS.FAILED) {
    progress = 100;
  } else if (upload.status === UPLOAD_STATUS.PROCESSING) {
    progress = 50;
  }

  return {
    upload_id: upload.id,
    status: upload.status,
    progress,
    error: upload.error_message || null,
    filename: upload.filename,
    filetype: upload.filetype,
    size: upload.size,
    created_at: upload.created_at,
    updated_at: upload.updated_at,
  };
};

const getResult = async (uploadId, userId) => {
  logger.info('DocumentUploadService: getting extraction result', { uploadId, userId });

  if (!uploadId) {
    throw new AppError(ERROR_MESSAGES.EXTRACTION_NOT_FOUND, 400);
  }

  let upload;

  if (userId) {
    upload = await DocumentUploadRepository.findByIdAndUserId(uploadId, userId);
  } else {
    upload = await DocumentUploadRepository.findById(uploadId);
  }

  if (!upload) {
    logger.warn('DocumentUploadService: upload not found for result retrieval', { uploadId, userId });
    throw new AppError(ERROR_MESSAGES.DOCUMENT_NOT_FOUND, 404);
  }

  const extractionResult = await ExtractionResultRepository.findByUploadId(uploadId);

  if (!extractionResult) {
    if (upload.status === UPLOAD_STATUS.FAILED) {
      logger.warn('DocumentUploadService: extraction failed, no result available', { uploadId });
      throw new AppError(upload.error_message || ERROR_MESSAGES.EXTRACTION_FAILED, 422);
    }

    if (upload.status === UPLOAD_STATUS.PENDING || upload.status === UPLOAD_STATUS.PROCESSING) {
      logger.info('DocumentUploadService: extraction still in progress', { uploadId, status: upload.status });
      throw new AppError(ERROR_MESSAGES.DOCUMENT_ALREADY_PROCESSING, 409);
    }

    logger.warn('DocumentUploadService: extraction result not found', { uploadId });
    throw new AppError(ERROR_MESSAGES.EXTRACTION_NOT_FOUND, 404);
  }

  const extractedData = extractionResult.extracted_data || {};

  logger.info('DocumentUploadService: extraction result retrieved', {
    uploadId,
    textLength: extractedData.extracted_text ? extractedData.extracted_text.length : 0,
  });

  return {
    upload_id: upload.id,
    file_name: upload.filename,
    filetype: upload.filetype,
    size: upload.size,
    status: upload.status,
    extracted_text: extractedData.extracted_text || '',
    extracted_tables: extractedData.extracted_tables || [],
    metadata: extractedData.metadata || {},
    page_count: extractedData.page_count || null,
    extracted_html: extractedData.extracted_html || undefined,
    geospatial_data: extractedData.geospatial_data || undefined,
    processed_at: extractionResult.processed_at,
    created_at: upload.created_at,
  };
};

const listUploads = async (userId, filters = {}) => {
  logger.info('DocumentUploadService: listing uploads', { userId, filters });

  if (!userId) {
    throw new AppError(ERROR_MESSAGES.UNAUTHORIZED, 401);
  }

  const {
    status,
    filetype,
    start_date,
    end_date,
    page = 1,
    page_size = 50,
    sort_by = 'created_at',
    sort_order = 'DESC',
  } = filters;

  const result = await DocumentUploadRepository.list(userId, {
    status,
    filetype,
    start_date,
    end_date,
    page,
    page_size,
    sort_by,
    sort_order,
  });

  logger.info('DocumentUploadService: uploads listed', {
    userId,
    total: result.total,
    returned: result.uploads.length,
    page: result.page,
  });

  return {
    uploads: result.uploads.map((upload) => ({
      upload_id: upload.id,
      file_name: upload.filename,
      filetype: upload.filetype,
      size: upload.size,
      status: upload.status,
      error: upload.error_message || null,
      created_at: upload.created_at,
      updated_at: upload.updated_at,
    })),
    page: result.page,
    page_size: result.page_size,
    total: result.total,
  };
};

const deleteDocument = async (uploadId, userId) => {
  logger.info('DocumentUploadService: deleting document', { uploadId, userId });

  if (!uploadId) {
    throw new AppError(ERROR_MESSAGES.DOCUMENT_NOT_FOUND, 400);
  }

  const upload = await DocumentUploadRepository.findByIdAndUserId(uploadId, userId);

  if (!upload) {
    logger.warn('DocumentUploadService: document not found for deletion', { uploadId, userId });
    throw new AppError(ERROR_MESSAGES.DOCUMENT_NOT_FOUND, 404);
  }

  if (upload.status === UPLOAD_STATUS.PROCESSING) {
    logger.warn('DocumentUploadService: cannot delete document while processing', { uploadId });
    throw new AppError(ERROR_MESSAGES.DOCUMENT_ALREADY_PROCESSING, 409);
  }

  await ExtractionResultRepository.deleteByUploadId(uploadId);
  await DocumentUploadRepository.deleteById(uploadId);

  ProgressNotifier.remove(uploadId);

  logger.info('DocumentUploadService: document deleted', { uploadId, userId });

  LogIngestionService.ingestEvent({
    event_type: 'SYSTEM',
    timestamp: new Date().toISOString(),
    user_id: userId,
    details: {
      upload_id: uploadId,
      filename: upload.filename,
      action: AUDIT_ACTIONS.DOCUMENT_DELETE,
    },
    status: AUDIT_STATUS.SUCCESS,
  }, {
    user_id: userId,
  }).catch((err) => {
    logger.warn('DocumentUploadService: failed to log delete event', {
      error: err.message,
      uploadId,
    });
  });

  return {
    message: 'Document deleted successfully.',
    upload_id: uploadId,
  };
};

const getUploadStats = async (userId) => {
  logger.info('DocumentUploadService: getting upload stats', { userId });

  if (!userId) {
    throw new AppError(ERROR_MESSAGES.UNAUTHORIZED, 401);
  }

  const totalCount = await DocumentUploadRepository.countByUserId(userId);
  const pendingCount = await DocumentUploadRepository.countByStatus(UPLOAD_STATUS.PENDING);
  const processingCount = await DocumentUploadRepository.countByStatus(UPLOAD_STATUS.PROCESSING);
  const completedCount = await DocumentUploadRepository.countByStatus(UPLOAD_STATUS.COMPLETED);
  const failedCount = await DocumentUploadRepository.countByStatus(UPLOAD_STATUS.FAILED);

  return {
    total: totalCount,
    pending: pendingCount,
    processing: processingCount,
    completed: completedCount,
    failed: failedCount,
  };
};

class ExtractionTimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ExtractionTimeoutError';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  uploadDocument,
  getStatus,
  getResult,
  listUploads,
  deleteDocument,
  getUploadStats,
  ExtractionTimeoutError,
};