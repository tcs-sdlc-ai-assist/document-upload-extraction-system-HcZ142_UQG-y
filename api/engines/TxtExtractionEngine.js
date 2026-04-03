const logger = require('../utils/logger');

const extract = async (buffer) => {
  logger.info('Starting TXT extraction');

  if (!buffer || buffer.length === 0) {
    logger.warn('TXT extraction failed: empty buffer provided');
    throw new TxtExtractionError('TXT buffer is empty or not provided');
  }

  try {
    const startTime = Date.now();

    if (isBinaryContent(buffer)) {
      throw new TxtExtractionError(
        'The file appears to contain binary data and cannot be processed as plain text'
      );
    }

    const extractedText = decodeBuffer(buffer);

    const duration = Date.now() - startTime;

    const lineCount = extractedText.split('\n').length;
    const wordCount = extractedText
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
    const charCount = extractedText.length;

    const metadata = {
      format: 'TXT',
      line_count: lineCount,
      word_count: wordCount,
      character_count: charCount,
      text_length: charCount,
    };

    logger.info('TXT extraction completed successfully', {
      lineCount,
      wordCount,
      charCount,
      duration: `${duration}ms`,
    });

    return {
      extracted_text: extractedText,
      extracted_tables: [],
      metadata,
      page_count: null,
    };
  } catch (err) {
    if (err instanceof TxtExtractionError) {
      throw err;
    }

    logger.error('TXT extraction failed', {
      error: err.message,
      stack: err.stack,
    });

    if (
      err.message &&
      (err.message.includes('encoding') ||
        err.message.includes('decode') ||
        err.message.includes('invalid') ||
        err.message.includes('malformed'))
    ) {
      throw new TxtExtractionError(
        'The text file contains invalid encoding and cannot be processed'
      );
    }

    throw new TxtExtractionError(
      `Failed to extract data from text file: ${err.message}`
    );
  }
};

const decodeBuffer = (buffer) => {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.slice(3).toString('utf-8');
  }

  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.slice(2).toString('utf16le');
  }

  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.alloc(buffer.length - 2);
    for (let i = 2; i < buffer.length - 1; i += 2) {
      swapped[i - 2] = buffer[i + 1];
      swapped[i - 1] = buffer[i];
    }
    return swapped.toString('utf16le');
  }

  return buffer.toString('utf-8');
};

const isBinaryContent = (buffer) => {
  const checkLength = Math.min(buffer.length, 8192);
  let nullCount = 0;
  let controlCount = 0;

  for (let i = 0; i < checkLength; i++) {
    const byte = buffer[i];

    if (byte === 0x00) {
      nullCount++;
    }

    if (
      byte < 0x08 ||
      (byte > 0x0d && byte < 0x1b) ||
      (byte > 0x1b && byte < 0x20)
    ) {
      if (byte !== 0x00) {
        controlCount++;
      }
    }
  }

  const nullRatio = nullCount / checkLength;
  const controlRatio = controlCount / checkLength;

  if (nullRatio > 0.01) {
    return true;
  }

  if (controlRatio > 0.1) {
    return true;
  }

  return false;
};

class TxtExtractionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TxtExtractionError';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  extract,
  TxtExtractionError,
};