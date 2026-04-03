const multer = require('multer');
const { MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES, MIME_TYPES } = require('./constants');
const { AppError } = require('../middleware/errorHandler');
const { ERROR_MESSAGES } = require('./constants');

const ADDITIONAL_MIME_TYPES = {
  'application/vnd.google-earth.kml+xml': 'kml',
  'text/plain': 'txt',
};

const ALL_ALLOWED_MIME_TYPES = [
  ...ALLOWED_MIME_TYPES,
  ...Object.keys(ADDITIONAL_MIME_TYPES),
];

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  if (ALL_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(ERROR_MESSAGES.FILE_TYPE_NOT_SUPPORTED, 400), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter,
});

module.exports = {
  upload,
  ALL_ALLOWED_MIME_TYPES,
  ADDITIONAL_MIME_TYPES,
};