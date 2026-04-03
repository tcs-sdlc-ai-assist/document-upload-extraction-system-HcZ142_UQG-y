const pdfParse = require('pdf-parse');
const logger = require('../utils/logger');

const extract = async (buffer) => {
  logger.info('Starting PDF extraction');

  if (!buffer || buffer.length === 0) {
    logger.warn('PDF extraction failed: empty buffer provided');
    throw new PdfExtractionError('PDF buffer is empty or not provided');
  }

  try {
    const startTime = Date.now();

    const data = await pdfParse(buffer, {
      max: 0,
    });

    const duration = Date.now() - startTime;

    const extractedText = data.text || '';
    const pageCount = data.numpages || 0;

    const metadata = {
      pages: pageCount,
      format: 'PDF',
      info: data.info || {},
      version: data.version || null,
    };

    if (data.info) {
      if (data.info.Title) {
        metadata.title = data.info.Title;
      }
      if (data.info.Author) {
        metadata.author = data.info.Author;
      }
      if (data.info.CreationDate) {
        metadata.creation_date = data.info.CreationDate;
      }
      if (data.info.ModDate) {
        metadata.modification_date = data.info.ModDate;
      }
      if (data.info.Producer) {
        metadata.producer = data.info.Producer;
      }
      if (data.info.Creator) {
        metadata.creator = data.info.Creator;
      }
    }

    logger.info('PDF extraction completed successfully', {
      pages: pageCount,
      textLength: extractedText.length,
      duration: `${duration}ms`,
    });

    return {
      extracted_text: extractedText,
      extracted_tables: [],
      metadata,
      page_count: pageCount,
    };
  } catch (err) {
    if (err instanceof PdfExtractionError) {
      throw err;
    }

    logger.error('PDF extraction failed', {
      error: err.message,
      stack: err.stack,
    });

    if (
      err.message &&
      (err.message.includes('Invalid PDF') ||
        err.message.includes('bad XRef') ||
        err.message.includes('XRef') ||
        err.message.includes('stream') ||
        err.message.includes('encrypt') ||
        err.message.includes('password'))
    ) {
      throw new PdfExtractionError(
        'The PDF file appears to be corrupted or password-protected and cannot be processed'
      );
    }

    throw new PdfExtractionError(
      `Failed to extract data from PDF: ${err.message}`
    );
  }
};

class PdfExtractionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PdfExtractionError';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  extract,
  PdfExtractionError,
};