import { createContext, useState, useCallback, useContext, useRef } from 'react';
import documentService from '../services/documentService';

const UploadContext = createContext(null);

const UPLOAD_STATES = {
  IDLE: 'idle',
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

const UploadProvider = ({ children }) => {
  const [uploads, setUploads] = useState({});
  const [results, setResults] = useState({});
  const [errors, setErrors] = useState({});
  const [queue, setQueue] = useState([]);
  const activeUploadsRef = useRef(new Set());

  const generateFileId = useCallback(() => {
    return `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  const updateUploadState = useCallback((fileId, updates) => {
    setUploads((prev) => ({
      ...prev,
      [fileId]: {
        ...prev[fileId],
        ...updates,
        updated_at: new Date().toISOString(),
      },
    }));
  }, []);

  const setUploadError = useCallback((fileId, errorMessage) => {
    setErrors((prev) => ({
      ...prev,
      [fileId]: errorMessage,
    }));
  }, []);

  const clearUploadError = useCallback((fileId) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[fileId];
      return next;
    });
  }, []);

  const pollForResult = useCallback(async (fileId, uploadId) => {
    updateUploadState(fileId, {
      status: UPLOAD_STATES.PROCESSING,
      upload_id: uploadId,
    });

    const pollResponse = await documentService.pollUploadStatus(uploadId, {
      interval: 2000,
      maxAttempts: 60,
      onStatusChange: (statusData) => {
        if (statusData) {
          updateUploadState(fileId, {
            status: statusData.status === 'completed'
              ? UPLOAD_STATES.COMPLETED
              : statusData.status === 'failed'
                ? UPLOAD_STATES.FAILED
                : UPLOAD_STATES.PROCESSING,
            progress: statusData.progress || 0,
            serverStatus: statusData.status,
          });
        }
      },
    });

    if (pollResponse.success && pollResponse.data) {
      const finalStatus = pollResponse.data.status;

      if (finalStatus === 'completed') {
        const resultResponse = await documentService.getExtractionResult(uploadId);

        if (resultResponse.success && resultResponse.data) {
          setResults((prev) => ({
            ...prev,
            [fileId]: resultResponse.data,
          }));

          updateUploadState(fileId, {
            status: UPLOAD_STATES.COMPLETED,
            progress: 100,
            serverStatus: 'completed',
          });
        } else {
          const errorMsg = resultResponse.message || 'Failed to retrieve extraction result.';
          setUploadError(fileId, errorMsg);
          updateUploadState(fileId, {
            status: UPLOAD_STATES.FAILED,
            progress: 100,
            serverStatus: 'failed',
          });
        }
      } else if (finalStatus === 'failed') {
        const errorMsg = pollResponse.data.error || 'Extraction failed. Please try again.';
        setUploadError(fileId, errorMsg);
        updateUploadState(fileId, {
          status: UPLOAD_STATES.FAILED,
          progress: 100,
          serverStatus: 'failed',
        });
      }
    } else {
      const errorMsg = pollResponse.message || 'Failed to track upload status.';
      setUploadError(fileId, errorMsg);
      updateUploadState(fileId, {
        status: UPLOAD_STATES.FAILED,
        progress: 100,
      });
    }

    activeUploadsRef.current.delete(fileId);
  }, [updateUploadState, setUploadError]);

  const uploadDocument = useCallback(async (file) => {
    if (!file) {
      return {
        success: false,
        message: 'A file is required for upload.',
      };
    }

    const fileId = generateFileId();

    const uploadEntry = {
      fileId,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      status: UPLOAD_STATES.UPLOADING,
      progress: 0,
      upload_id: null,
      serverStatus: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setUploads((prev) => ({
      ...prev,
      [fileId]: uploadEntry,
    }));

    setQueue((prev) => [...prev, fileId]);
    activeUploadsRef.current.add(fileId);
    clearUploadError(fileId);

    try {
      const response = await documentService.uploadDocument(file, (progressData) => {
        updateUploadState(fileId, {
          progress: progressData.percent || 0,
          status: UPLOAD_STATES.UPLOADING,
        });
      });

      if (response.success && response.data) {
        const uploadId = response.data.upload_id;

        updateUploadState(fileId, {
          upload_id: uploadId,
          status: UPLOAD_STATES.PROCESSING,
          progress: 100,
          serverStatus: response.data.status || 'pending',
        });

        pollForResult(fileId, uploadId).catch((err) => {
          setUploadError(fileId, err.message || 'An unexpected error occurred during processing.');
          updateUploadState(fileId, {
            status: UPLOAD_STATES.FAILED,
            progress: 100,
          });
          activeUploadsRef.current.delete(fileId);
        });

        return {
          success: true,
          fileId,
          upload_id: uploadId,
        };
      }

      const errorMsg = response.message || 'File upload failed. Please try again.';
      setUploadError(fileId, errorMsg);
      updateUploadState(fileId, {
        status: UPLOAD_STATES.FAILED,
        progress: 0,
      });
      activeUploadsRef.current.delete(fileId);

      return {
        success: false,
        fileId,
        message: errorMsg,
        details: response.details || null,
      };
    } catch (err) {
      const errorMsg = err.message || 'An unexpected error occurred during upload.';
      setUploadError(fileId, errorMsg);
      updateUploadState(fileId, {
        status: UPLOAD_STATES.FAILED,
        progress: 0,
      });
      activeUploadsRef.current.delete(fileId);

      return {
        success: false,
        fileId,
        message: errorMsg,
        details: err.details || null,
      };
    }
  }, [generateFileId, updateUploadState, clearUploadError, setUploadError, pollForResult]);

  const retry = useCallback(async (fileId) => {
    const existingUpload = uploads[fileId];

    if (!existingUpload) {
      return {
        success: false,
        message: 'Upload not found.',
      };
    }

    if (existingUpload.status !== UPLOAD_STATES.FAILED) {
      return {
        success: false,
        message: 'Only failed uploads can be retried.',
      };
    }

    clearUploadError(fileId);

    if (existingUpload.upload_id) {
      activeUploadsRef.current.add(fileId);
      updateUploadState(fileId, {
        status: UPLOAD_STATES.PROCESSING,
        progress: 0,
      });

      const statusResponse = await documentService.getUploadStatus(existingUpload.upload_id);

      if (statusResponse.success && statusResponse.data) {
        const currentStatus = statusResponse.data.status;

        if (currentStatus === 'completed') {
          const resultResponse = await documentService.getExtractionResult(existingUpload.upload_id);

          if (resultResponse.success && resultResponse.data) {
            setResults((prev) => ({
              ...prev,
              [fileId]: resultResponse.data,
            }));

            updateUploadState(fileId, {
              status: UPLOAD_STATES.COMPLETED,
              progress: 100,
              serverStatus: 'completed',
            });

            activeUploadsRef.current.delete(fileId);

            return {
              success: true,
              fileId,
              upload_id: existingUpload.upload_id,
            };
          }
        }

        if (currentStatus === 'pending' || currentStatus === 'processing') {
          pollForResult(fileId, existingUpload.upload_id).catch((err) => {
            setUploadError(fileId, err.message || 'An unexpected error occurred during retry.');
            updateUploadState(fileId, {
              status: UPLOAD_STATES.FAILED,
              progress: 100,
            });
            activeUploadsRef.current.delete(fileId);
          });

          return {
            success: true,
            fileId,
            upload_id: existingUpload.upload_id,
          };
        }
      }

      activeUploadsRef.current.delete(fileId);
    }

    setUploadError(fileId, 'Cannot retry this upload. Please upload the file again.');
    updateUploadState(fileId, {
      status: UPLOAD_STATES.FAILED,
    });

    return {
      success: false,
      fileId,
      message: 'Cannot retry this upload. Please upload the file again.',
    };
  }, [uploads, clearUploadError, updateUploadState, setUploadError, pollForResult]);

  const clearResults = useCallback((fileId) => {
    if (fileId) {
      setResults((prev) => {
        const next = { ...prev };
        delete next[fileId];
        return next;
      });

      setErrors((prev) => {
        const next = { ...prev };
        delete next[fileId];
        return next;
      });

      setUploads((prev) => {
        const next = { ...prev };
        delete next[fileId];
        return next;
      });

      setQueue((prev) => prev.filter((id) => id !== fileId));
      activeUploadsRef.current.delete(fileId);
    } else {
      setResults({});
      setErrors({});
      setUploads({});
      setQueue([]);
      activeUploadsRef.current.clear();
    }
  }, []);

  const getUploadByFileId = useCallback((fileId) => {
    return uploads[fileId] || null;
  }, [uploads]);

  const getResultByFileId = useCallback((fileId) => {
    return results[fileId] || null;
  }, [results]);

  const getErrorByFileId = useCallback((fileId) => {
    return errors[fileId] || null;
  }, [errors]);

  const getUploadsList = useCallback(() => {
    return queue.map((fileId) => ({
      fileId,
      ...uploads[fileId],
      error: errors[fileId] || null,
      hasResult: !!results[fileId],
    })).filter(Boolean);
  }, [queue, uploads, errors, results]);

  const hasActiveUploads = useCallback(() => {
    return activeUploadsRef.current.size > 0;
  }, []);

  const value = {
    uploads,
    results,
    errors,
    queue,
    uploadDocument,
    retry,
    clearResults,
    getUploadByFileId,
    getResultByFileId,
    getErrorByFileId,
    getUploadsList,
    hasActiveUploads,
    clearUploadError,
    UPLOAD_STATES,
  };

  return (
    <UploadContext.Provider value={value}>
      {children}
    </UploadContext.Provider>
  );
};

const useUpload = () => {
  const context = useContext(UploadContext);

  if (!context) {
    throw new Error('useUpload must be used within an UploadProvider');
  }

  return context;
};

export { UploadContext, UploadProvider, useUpload, UPLOAD_STATES };
export default UploadContext;