const logger = require('../utils/logger');
const DocumentUploadRepository = require('../repositories/DocumentUploadRepository');

const DEFAULT_TTL_MS = parseInt(process.env.PROGRESS_TTL_MS, 10) || 5 * 60 * 1000;
const CLEANUP_INTERVAL_MS = parseInt(process.env.PROGRESS_CLEANUP_INTERVAL_MS, 10) || 60000;

const progressStore = new Map();

let cleanupTimer = null;

const notify = async (uploadId, progress, status, error = null) => {
  if (!uploadId) {
    logger.warn('ProgressNotifier: notify called without uploadId');
    return;
  }

  const clampedProgress = Math.min(Math.max(0, Math.round(progress)), 100);
  const now = Date.now();

  const entry = {
    upload_id: uploadId,
    progress: clampedProgress,
    status,
    error: error || null,
    updated_at: new Date(now).toISOString(),
    timestamp: now,
  };

  progressStore.set(uploadId, entry);

  logger.debug('ProgressNotifier: progress updated', {
    uploadId,
    progress: clampedProgress,
    status,
    error: error || undefined,
  });

  try {
    await DocumentUploadRepository.updateStatus(uploadId, status, error);
  } catch (err) {
    logger.error('ProgressNotifier: failed to persist status to database', {
      uploadId,
      status,
      error: err.message,
    });
  }

  return entry;
};

const getProgress = (uploadId) => {
  if (!uploadId) {
    logger.warn('ProgressNotifier: getProgress called without uploadId');
    return null;
  }

  const entry = progressStore.get(uploadId);

  if (!entry) {
    logger.debug('ProgressNotifier: no progress entry found', { uploadId });
    return null;
  }

  logger.debug('ProgressNotifier: progress retrieved', {
    uploadId,
    progress: entry.progress,
    status: entry.status,
  });

  return {
    upload_id: entry.upload_id,
    progress: entry.progress,
    status: entry.status,
    error: entry.error,
    updated_at: entry.updated_at,
  };
};

const getAllProgress = () => {
  const entries = [];

  for (const [, entry] of progressStore) {
    entries.push({
      upload_id: entry.upload_id,
      progress: entry.progress,
      status: entry.status,
      error: entry.error,
      updated_at: entry.updated_at,
    });
  }

  logger.debug('ProgressNotifier: all progress entries retrieved', {
    count: entries.length,
  });

  return entries;
};

const getProgressByUserId = async (userId) => {
  if (!userId) {
    logger.warn('ProgressNotifier: getProgressByUserId called without userId');
    return [];
  }

  try {
    const uploads = await DocumentUploadRepository.findByUserId(userId);
    const results = [];

    for (const upload of uploads) {
      const inMemory = progressStore.get(upload.id);

      if (inMemory) {
        results.push({
          upload_id: inMemory.upload_id,
          progress: inMemory.progress,
          status: inMemory.status,
          error: inMemory.error,
          updated_at: inMemory.updated_at,
          filename: upload.filename,
        });
      } else {
        results.push({
          upload_id: upload.id,
          progress: upload.status === 'completed' ? 100 : upload.status === 'failed' ? 100 : 0,
          status: upload.status,
          error: upload.error_message || null,
          updated_at: upload.updated_at,
          filename: upload.filename,
        });
      }
    }

    logger.debug('ProgressNotifier: progress entries retrieved for user', {
      userId,
      count: results.length,
    });

    return results;
  } catch (err) {
    logger.error('ProgressNotifier: failed to get progress by user ID', {
      userId,
      error: err.message,
    });
    return [];
  }
};

const remove = (uploadId) => {
  if (!uploadId) {
    return false;
  }

  const deleted = progressStore.delete(uploadId);

  if (deleted) {
    logger.debug('ProgressNotifier: progress entry removed', { uploadId });
  }

  return deleted;
};

const cleanupCompleted = (ttlMs = DEFAULT_TTL_MS) => {
  const now = Date.now();
  let removedCount = 0;

  for (const [uploadId, entry] of progressStore) {
    const isTerminal = entry.status === 'completed' || entry.status === 'failed';
    const isExpired = (now - entry.timestamp) > ttlMs;

    if (isTerminal && isExpired) {
      progressStore.delete(uploadId);
      removedCount++;
    }
  }

  if (removedCount > 0) {
    logger.info('ProgressNotifier: cleaned up completed entries', {
      removedCount,
      remaining: progressStore.size,
      ttlMs,
    });
  }

  return removedCount;
};

const startCleanupTimer = () => {
  if (cleanupTimer) {
    return;
  }

  cleanupTimer = setInterval(() => {
    try {
      cleanupCompleted();
    } catch (err) {
      logger.error('ProgressNotifier: error during cleanup', { error: err.message });
    }
  }, CLEANUP_INTERVAL_MS);

  logger.info('ProgressNotifier: cleanup timer started', {
    intervalMs: CLEANUP_INTERVAL_MS,
    ttlMs: DEFAULT_TTL_MS,
  });
};

const stopCleanupTimer = () => {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
    logger.info('ProgressNotifier: cleanup timer stopped');
  }
};

const getStoreSize = () => {
  return progressStore.size;
};

const clear = () => {
  const size = progressStore.size;
  progressStore.clear();

  logger.info('ProgressNotifier: all progress entries cleared', { count: size });

  return size;
};

const shutdown = () => {
  logger.info('ProgressNotifier: shutting down');
  stopCleanupTimer();
  clear();
  logger.info('ProgressNotifier: shutdown complete');
};

module.exports = {
  notify,
  getProgress,
  getAllProgress,
  getProgressByUserId,
  remove,
  cleanupCompleted,
  startCleanupTimer,
  stopCleanupTimer,
  getStoreSize,
  clear,
  shutdown,
};