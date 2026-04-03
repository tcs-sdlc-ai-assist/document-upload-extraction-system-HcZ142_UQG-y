const PdfExtractionEngine = require('../engines/PdfExtractionEngine');
const CsvExtractionEngine = require('../engines/CsvExtractionEngine');
const DocxExtractionEngine = require('../engines/DocxExtractionEngine');
const XlsExtractionEngine = require('../engines/XlsExtractionEngine');
const KmlExtractionEngine = require('../engines/KmlExtractionEngine');
const TxtExtractionEngine = require('../engines/TxtExtractionEngine');
const { SUPPORTED_FILE_TYPES, MIME_TYPES, ERROR_MESSAGES } = require('../config/constants');
const { ADDITIONAL_MIME_TYPES } = require('../config/uploadConfig');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const ENGINE_MAP = {
  [SUPPORTED_FILE_TYPES.PDF]: PdfExtractionEngine,
  [SUPPORTED_FILE_TYPES.CSV]: CsvExtractionEngine,
  [SUPPORTED_FILE_TYPES.DOCX]: DocxExtractionEngine,
  [SUPPORTED_FILE_TYPES.XLSX]: XlsExtractionEngine,
  [SUPPORTED_FILE_TYPES.XLS]: XlsExtractionEngine,
  [SUPPORTED_FILE_TYPES.XML]: KmlExtractionEngine,
  kml: KmlExtractionEngine,
  txt: TxtExtractionEngine,
};

const getEngine = (fileType) => {
  if (!fileType) {
    logger.warn('ExtractionEngineFactory: no file type provided');
    throw new AppError(ERROR_MESSAGES.FILE_TYPE_NOT_SUPPORTED, 400);
  }

  const normalizedType = fileType.toLowerCase().trim();

  const engine = ENGINE_MAP[normalizedType];

  if (!engine) {
    logger.warn('ExtractionEngineFactory: unsupported file type', { fileType: normalizedType });
    throw new AppError(ERROR_MESSAGES.FILE_TYPE_NOT_SUPPORTED, 400);
  }

  logger.info('ExtractionEngineFactory: engine selected', { fileType: normalizedType });

  return engine;
};

const getEngineByMimeType = (mimeType) => {
  if (!mimeType) {
    logger.warn('ExtractionEngineFactory: no MIME type provided');
    throw new AppError(ERROR_MESSAGES.FILE_TYPE_NOT_SUPPORTED, 400);
  }

  const normalizedMime = mimeType.toLowerCase().trim();

  let fileType = MIME_TYPES[normalizedMime] || null;

  if (!fileType && ADDITIONAL_MIME_TYPES[normalizedMime]) {
    fileType = ADDITIONAL_MIME_TYPES[normalizedMime];
  }

  if (!fileType) {
    logger.warn('ExtractionEngineFactory: unsupported MIME type', { mimeType: normalizedMime });
    throw new AppError(ERROR_MESSAGES.FILE_TYPE_NOT_SUPPORTED, 400);
  }

  return getEngine(fileType);
};

const getEngineByFilename = (filename) => {
  if (!filename) {
    logger.warn('ExtractionEngineFactory: no filename provided');
    throw new AppError(ERROR_MESSAGES.FILE_TYPE_NOT_SUPPORTED, 400);
  }

  const lastDotIndex = filename.lastIndexOf('.');

  if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
    logger.warn('ExtractionEngineFactory: filename has no extension', { filename });
    throw new AppError(ERROR_MESSAGES.FILE_TYPE_NOT_SUPPORTED, 400);
  }

  const extension = filename.substring(lastDotIndex + 1).toLowerCase().trim();

  return getEngine(extension);
};

const getSupportedTypes = () => {
  return Object.keys(ENGINE_MAP);
};

const isSupported = (fileType) => {
  if (!fileType) {
    return false;
  }

  const normalizedType = fileType.toLowerCase().trim();
  return !!ENGINE_MAP[normalizedType];
};

module.exports = {
  getEngine,
  getEngineByMimeType,
  getEngineByFilename,
  getSupportedTypes,
  isSupported,
};