import { useState, useCallback, useRef } from 'react';
import { useUpload } from '../../context/UploadContext';
import theme from '../../config/theme';

const SUPPORTED_FILE_TYPES = {
  'application/pdf': { ext: 'PDF', icon: 'P' },
  'text/csv': { ext: 'CSV', icon: 'C' },
  'application/xml': { ext: 'XML', icon: 'X' },
  'text/xml': { ext: 'XML', icon: 'X' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: 'XLSX', icon: 'X' },
  'application/vnd.ms-excel': { ext: 'XLS', icon: 'X' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'DOCX', icon: 'D' },
  'application/vnd.google-earth.kml+xml': { ext: 'KML', icon: 'K' },
  'text/plain': { ext: 'TXT', icon: 'T' },
};

const ALLOWED_MIME_TYPES = Object.keys(SUPPORTED_FILE_TYPES);

const ALLOWED_EXTENSIONS = ['.pdf', '.csv', '.xml', '.xlsx', '.xls', '.docx', '.kml', '.txt'];

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const SUPPORTED_TYPES_DISPLAY = ['PDF', 'CSV', 'XML', 'XLSX', 'XLS', 'DOCX', 'KML', 'TXT'];

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const getFileExtension = (filename) => {
  if (!filename) return '';
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === filename.length - 1) return '';
  return filename.substring(lastDot).toLowerCase();
};

const getFileTypeInfo = (file) => {
  if (file.type && SUPPORTED_FILE_TYPES[file.type]) {
    return SUPPORTED_FILE_TYPES[file.type];
  }
  const ext = getFileExtension(file.name);
  for (const [, info] of Object.entries(SUPPORTED_FILE_TYPES)) {
    if (info.ext.toLowerCase() === ext.replace('.', '')) {
      return info;
    }
  }
  return { ext: ext.replace('.', '').toUpperCase() || '?', icon: '?' };
};

const validateFile = (file) => {
  const errors = [];

  if (!file) {
    errors.push('No file provided');
    return errors;
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    errors.push(`File size exceeds the maximum allowed size of ${MAX_FILE_SIZE_MB}MB`);
  }

  if (file.size === 0) {
    errors.push('File is empty');
  }

  const mimeType = file.type ? file.type.toLowerCase().trim() : '';
  const ext = getFileExtension(file.name);

  const isMimeValid = mimeType && ALLOWED_MIME_TYPES.includes(mimeType);
  const isExtValid = ext && ALLOWED_EXTENSIONS.includes(ext);

  if (!isMimeValid && !isExtValid) {
    errors.push(`File type is not supported. Supported types: ${SUPPORTED_TYPES_DISPLAY.join(', ')}`);
  }

  return errors;
};

const FileDropzone = () => {
  const { uploadDocument, UPLOAD_STATES } = useUpload();
  const fileInputRef = useRef(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileErrors, setFileErrors] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState([]);

  const dragCounterRef = useRef(0);

  const processFiles = useCallback((fileList) => {
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    const newFiles = [];
    const newErrors = {};

    for (const file of files) {
      const fileId = `${file.name}_${file.size}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const errors = validateFile(file);

      const fileEntry = {
        id: fileId,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        typeInfo: getFileTypeInfo(file),
        hasErrors: errors.length > 0,
      };

      newFiles.push(fileEntry);

      if (errors.length > 0) {
        newErrors[fileId] = errors;
      }
    }

    setSelectedFiles((prev) => [...prev, ...newFiles]);
    setFileErrors((prev) => ({ ...prev, ...newErrors }));
  }, []);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounterRef.current = 0;

    const files = e.dataTransfer.files;
    processFiles(files);
  }, [processFiles]);

  const handleBrowseClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }, []);

  const handleFileInputChange = useCallback((e) => {
    const files = e.target.files;
    processFiles(files);
  }, [processFiles]);

  const handleRemoveFile = useCallback((fileId) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== fileId));
    setFileErrors((prev) => {
      const next = { ...prev };
      delete next[fileId];
      return next;
    });
    setUploadResults((prev) => prev.filter((r) => r.fileId !== fileId));
  }, []);

  const handleClearAll = useCallback(() => {
    setSelectedFiles([]);
    setFileErrors({});
    setUploadResults([]);
  }, []);

  const handleUploadAll = useCallback(async () => {
    const validFiles = selectedFiles.filter((f) => !f.hasErrors);

    if (validFiles.length === 0) return;

    setIsUploading(true);
    setUploadResults([]);

    const results = [];

    for (const fileEntry of validFiles) {
      try {
        const result = await uploadDocument(fileEntry.file);
        results.push({
          fileId: fileEntry.id,
          fileName: fileEntry.name,
          success: result.success,
          message: result.success
            ? 'Upload started successfully'
            : (result.message || 'Upload failed'),
          uploadFileId: result.fileId || null,
          uploadId: result.upload_id || null,
        });
      } catch (err) {
        results.push({
          fileId: fileEntry.id,
          fileName: fileEntry.name,
          success: false,
          message: err.message || 'An unexpected error occurred during upload',
          uploadFileId: null,
          uploadId: null,
        });
      }
    }

    setUploadResults(results);

    const successFileIds = results.filter((r) => r.success).map((r) => r.fileId);
    if (successFileIds.length > 0) {
      setSelectedFiles((prev) => prev.filter((f) => !successFileIds.includes(f.id)));
      setFileErrors((prev) => {
        const next = { ...prev };
        for (const id of successFileIds) {
          delete next[id];
        }
        return next;
      });
    }

    setIsUploading(false);
  }, [selectedFiles, uploadDocument]);

  const validFileCount = selectedFiles.filter((f) => !f.hasErrors).length;
  const invalidFileCount = selectedFiles.filter((f) => f.hasErrors).length;
  const hasFiles = selectedFiles.length > 0;
  const canUpload = validFileCount > 0 && !isUploading;

  const acceptString = ALLOWED_EXTENSIONS.join(',');

  return (
    <div style={{
      fontFamily: theme.typography.fontFamily.sans,
    }}>
      {/* Dropzone Area */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
        style={{
          border: isDragOver
            ? `2px dashed ${theme.colors.primary[500]}`
            : `2px dashed ${theme.colors.border.default}`,
          borderRadius: theme.borderRadius.xl,
          padding: theme.spacing[10],
          textAlign: 'center',
          cursor: isUploading ? 'not-allowed' : 'pointer',
          transition: theme.transitions.default,
          background: isDragOver
            ? theme.colors.primary[50]
            : theme.colors.background.primary,
          opacity: isUploading ? 0.6 : 1,
          position: 'relative',
        }}
        onMouseEnter={(e) => {
          if (!isDragOver && !isUploading) {
            e.currentTarget.style.borderColor = theme.colors.primary[400];
            e.currentTarget.style.background = theme.colors.neutral[50];
          }
        }}
        onMouseLeave={(e) => {
          if (!isDragOver && !isUploading) {
            e.currentTarget.style.borderColor = theme.colors.border.default;
            e.currentTarget.style.background = theme.colors.background.primary;
          }
        }}
      >
        {/* Upload Icon */}
        <div style={{
          width: '3.5rem',
          height: '3.5rem',
          borderRadius: theme.borderRadius.full,
          background: isDragOver ? theme.colors.primary[100] : theme.colors.neutral[100],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto',
          marginBottom: theme.spacing[4],
          transition: theme.transitions.default,
        }}>
          <span style={{
            fontSize: theme.typography.fontSize['2xl'],
            color: isDragOver ? theme.colors.primary[600] : theme.colors.text.tertiary,
            lineHeight: 1,
          }}>
            ↑
          </span>
        </div>

        {/* Main Text */}
        <p style={{
          fontSize: theme.typography.fontSize.base,
          fontWeight: theme.typography.fontWeight.semibold,
          color: isDragOver ? theme.colors.primary[700] : theme.colors.text.primary,
          margin: 0,
          marginBottom: theme.spacing[1],
        }}>
          {isDragOver ? 'Drop files here' : 'Drag & drop files here'}
        </p>

        <p style={{
          fontSize: theme.typography.fontSize.sm,
          color: theme.colors.text.secondary,
          margin: 0,
          marginBottom: theme.spacing[3],
        }}>
          or <span style={{
            color: theme.colors.text.link,
            fontWeight: theme.typography.fontWeight.medium,
            textDecoration: 'underline',
          }}>browse files</span> from your computer
        </p>

        {/* Supported Types */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: theme.spacing[1],
          marginBottom: theme.spacing[2],
        }}>
          {SUPPORTED_TYPES_DISPLAY.map((type) => (
            <span
              key={type}
              style={{
                display: 'inline-block',
                padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                background: theme.colors.neutral[100],
                color: theme.colors.text.tertiary,
                borderRadius: theme.borderRadius.md,
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.medium,
                fontFamily: theme.typography.fontFamily.mono,
              }}
            >
              {type}
            </span>
          ))}
        </div>

        <p style={{
          fontSize: theme.typography.fontSize.xs,
          color: theme.colors.text.disabled,
          margin: 0,
        }}>
          Maximum file size: {MAX_FILE_SIZE_MB}MB
        </p>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptString}
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
          aria-label="Select files to upload"
        />
      </div>

      {/* Upload Results (success/failure messages) */}
      {uploadResults.length > 0 && (
        <div style={{
          marginTop: theme.spacing[4],
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing[2],
        }}>
          {uploadResults.map((result) => (
            <div
              key={result.fileId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing[3],
                padding: theme.spacing[3],
                borderRadius: theme.borderRadius.lg,
                background: result.success
                  ? theme.components.toast.success.background
                  : theme.components.toast.error.background,
                border: result.success
                  ? theme.components.toast.success.border
                  : theme.components.toast.error.border,
              }}
            >
              <span style={{
                width: '1.5rem',
                height: '1.5rem',
                borderRadius: theme.borderRadius.full,
                background: result.success
                  ? theme.colors.success[100]
                  : theme.colors.error[100],
                color: result.success
                  ? theme.colors.success[700]
                  : theme.colors.error[700],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.bold,
                flexShrink: 0,
              }}>
                {result.success ? '✓' : '✕'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: theme.typography.fontWeight.medium,
                  color: result.success
                    ? theme.components.toast.success.color
                    : theme.components.toast.error.color,
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {result.fileName}
                </p>
                <p style={{
                  fontSize: theme.typography.fontSize.xs,
                  color: result.success
                    ? theme.colors.success[600]
                    : theme.colors.error[600],
                  margin: 0,
                  marginTop: '2px',
                }}>
                  {result.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected Files List */}
      {hasFiles && (
        <div style={{
          marginTop: theme.spacing[4],
        }}>
          {/* File List Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: theme.spacing[3],
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing[2],
            }}>
              <span style={{
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold,
                color: theme.colors.text.primary,
              }}>
                Selected Files
              </span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '1.25rem',
                height: '1.25rem',
                padding: `0 ${theme.spacing[1]}`,
                borderRadius: theme.borderRadius.full,
                background: theme.colors.primary[100],
                color: theme.colors.primary[700],
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.semibold,
              }}>
                {selectedFiles.length}
              </span>
              {invalidFileCount > 0 && (
                <span style={{
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.error[600],
                  fontWeight: theme.typography.fontWeight.medium,
                }}>
                  ({invalidFileCount} invalid)
                </span>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClearAll();
              }}
              disabled={isUploading}
              style={{
                background: 'transparent',
                border: 'none',
                color: theme.colors.text.tertiary,
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.medium,
                fontFamily: theme.typography.fontFamily.sans,
                cursor: isUploading ? 'not-allowed' : 'pointer',
                padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                borderRadius: theme.borderRadius.md,
                transition: theme.transitions.default,
                opacity: isUploading ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isUploading) {
                  e.currentTarget.style.color = theme.colors.error[600];
                  e.currentTarget.style.background = theme.colors.error[50];
                }
              }}
              onMouseLeave={(e) => {
                if (!isUploading) {
                  e.currentTarget.style.color = theme.colors.text.tertiary;
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              Clear all
            </button>
          </div>

          {/* File Items */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: theme.spacing[2],
          }}>
            {selectedFiles.map((fileEntry) => {
              const errors = fileErrors[fileEntry.id] || [];
              const hasError = errors.length > 0;

              return (
                <div
                  key={fileEntry.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: theme.spacing[3],
                    padding: theme.spacing[3],
                    background: hasError
                      ? theme.colors.error[50]
                      : theme.colors.background.primary,
                    border: hasError
                      ? `1px solid ${theme.colors.error[200]}`
                      : theme.components.card.border,
                    borderRadius: theme.borderRadius.lg,
                    transition: theme.transitions.default,
                  }}
                >
                  {/* File Type Icon */}
                  <div style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: theme.borderRadius.lg,
                    background: hasError
                      ? theme.colors.error[100]
                      : theme.colors.primary[50],
                    color: hasError
                      ? theme.colors.error[700]
                      : theme.colors.primary[700],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: theme.typography.fontSize.xs,
                    fontWeight: theme.typography.fontWeight.bold,
                    fontFamily: theme.typography.fontFamily.mono,
                    flexShrink: 0,
                  }}>
                    {fileEntry.typeInfo.icon}
                  </div>

                  {/* File Info */}
                  <div style={{
                    flex: 1,
                    minWidth: 0,
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: theme.spacing[2],
                      marginBottom: '2px',
                    }}>
                      <span style={{
                        fontSize: theme.typography.fontSize.sm,
                        fontWeight: theme.typography.fontWeight.medium,
                        color: hasError
                          ? theme.colors.error[800]
                          : theme.colors.text.primary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {fileEntry.name}
                      </span>
                      <span style={{
                        display: 'inline-block',
                        padding: `0 ${theme.spacing[2]}`,
                        background: hasError
                          ? theme.colors.error[100]
                          : theme.colors.neutral[100],
                        color: hasError
                          ? theme.colors.error[700]
                          : theme.colors.text.tertiary,
                        borderRadius: theme.borderRadius.md,
                        fontSize: theme.typography.fontSize.xs,
                        fontWeight: theme.typography.fontWeight.medium,
                        fontFamily: theme.typography.fontFamily.mono,
                        flexShrink: 0,
                        lineHeight: '1.5',
                      }}>
                        {fileEntry.typeInfo.ext}
                      </span>
                    </div>
                    <span style={{
                      fontSize: theme.typography.fontSize.xs,
                      color: hasError
                        ? theme.colors.error[600]
                        : theme.colors.text.tertiary,
                    }}>
                      {formatFileSize(fileEntry.size)}
                    </span>

                    {/* Validation Errors */}
                    {hasError && (
                      <div style={{
                        marginTop: theme.spacing[2],
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                      }}>
                        {errors.map((err, idx) => (
                          <p
                            key={idx}
                            style={{
                              fontSize: theme.typography.fontSize.xs,
                              color: theme.colors.error[600],
                              margin: 0,
                              lineHeight: theme.typography.lineHeight.normal,
                            }}
                          >
                            • {err}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile(fileEntry.id);
                    }}
                    disabled={isUploading}
                    aria-label={`Remove ${fileEntry.name}`}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: isUploading ? 'not-allowed' : 'pointer',
                      padding: theme.spacing[1],
                      borderRadius: theme.borderRadius.md,
                      color: theme.colors.text.disabled,
                      fontSize: theme.typography.fontSize.base,
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '1.75rem',
                      height: '1.75rem',
                      flexShrink: 0,
                      transition: theme.transitions.default,
                      opacity: isUploading ? 0.4 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isUploading) {
                        e.currentTarget.style.background = theme.colors.error[50];
                        e.currentTarget.style.color = theme.colors.error[600];
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isUploading) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = theme.colors.text.disabled;
                      }
                    }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>

          {/* Upload Button */}
          <div style={{
            marginTop: theme.spacing[4],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing[3],
          }}>
            <span style={{
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.text.secondary,
            }}>
              {validFileCount} {validFileCount === 1 ? 'file' : 'files'} ready to upload
            </span>
            <button
              onClick={handleUploadAll}
              disabled={!canUpload}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: theme.spacing[2],
                background: canUpload
                  ? theme.components.button.primary.background
                  : theme.components.button.primary.disabledBackground,
                color: canUpload
                  ? theme.components.button.primary.color
                  : theme.components.button.primary.disabledColor,
                border: 'none',
                borderRadius: theme.components.button.primary.borderRadius,
                padding: `${theme.components.button.primary.paddingY} ${theme.spacing[6]}`,
                fontSize: theme.components.button.primary.fontSize,
                fontWeight: theme.components.button.primary.fontWeight,
                fontFamily: theme.typography.fontFamily.sans,
                cursor: canUpload ? 'pointer' : 'not-allowed',
                transition: theme.transitions.default,
                outline: 'none',
                minWidth: '8rem',
              }}
              onMouseEnter={(e) => {
                if (canUpload) {
                  e.currentTarget.style.background = theme.components.button.primary.hoverBackground;
                }
              }}
              onMouseLeave={(e) => {
                if (canUpload) {
                  e.currentTarget.style.background = theme.components.button.primary.background;
                }
              }}
              onMouseDown={(e) => {
                if (canUpload) {
                  e.currentTarget.style.background = theme.components.button.primary.activeBackground;
                }
              }}
              onMouseUp={(e) => {
                if (canUpload) {
                  e.currentTarget.style.background = theme.components.button.primary.hoverBackground;
                }
              }}
            >
              {isUploading && (
                <span style={{
                  display: 'inline-block',
                  width: '1rem',
                  height: '1rem',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderTopColor: '#ffffff',
                  borderRadius: '50%',
                  animation: 'fileDropzoneSpin 0.8s linear infinite',
                }} />
              )}
              {isUploading ? 'Uploading...' : `Upload ${validFileCount > 1 ? `${validFileCount} Files` : 'File'}`}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fileDropzoneSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default FileDropzone;