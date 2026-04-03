const mammoth = require('mammoth');
const logger = require('../utils/logger');

const extract = async (buffer) => {
  logger.info('Starting DOCX extraction');

  if (!buffer || buffer.length === 0) {
    logger.warn('DOCX extraction failed: empty buffer provided');
    throw new DocxExtractionError('DOCX buffer is empty or not provided');
  }

  try {
    const startTime = Date.now();

    const [textResult, htmlResult] = await Promise.all([
      mammoth.extractRawText({ buffer }),
      mammoth.convertToHtml({ buffer }),
    ]);

    const duration = Date.now() - startTime;

    const extractedText = textResult.value || '';
    const extractedHtml = htmlResult.value || '';

    const warnings = [
      ...(textResult.messages || []),
      ...(htmlResult.messages || []),
    ].filter((msg) => msg.type === 'warning').map((msg) => msg.message);

    if (warnings.length > 0) {
      logger.warn('DOCX extraction completed with warnings', {
        warningCount: warnings.length,
        warnings: warnings.slice(0, 10),
      });
    }

    const metadata = {
      format: 'DOCX',
      text_length: extractedText.length,
      html_length: extractedHtml.length,
      warnings: warnings.length > 0 ? warnings : undefined,
    };

    logger.info('DOCX extraction completed successfully', {
      textLength: extractedText.length,
      htmlLength: extractedHtml.length,
      warningCount: warnings.length,
      duration: `${duration}ms`,
    });

    return {
      extracted_text: extractedText,
      extracted_html: extractedHtml,
      extracted_tables: [],
      metadata,
      page_count: null,
    };
  } catch (err) {
    if (err instanceof DocxExtractionError) {
      throw err;
    }

    logger.error('DOCX extraction failed', {
      error: err.message,
      stack: err.stack,
    });

    if (
      err.message &&
      (err.message.includes('Could not find') ||
        err.message.includes('End of data') ||
        err.message.includes('corrupted') ||
        err.message.includes('invalid') ||
        err.message.includes('Can\'t find end of central directory') ||
        err.message.includes('Unexpected end') ||
        err.message.includes('not a valid zip'))
    ) {
      throw new DocxExtractionError(
        'The DOCX file appears to be corrupted or invalid and cannot be processed'
      );
    }

    throw new DocxExtractionError(
      `Failed to extract data from DOCX: ${err.message}`
    );
  }
};

class DocxExtractionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DocxExtractionError';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  extract,
  DocxExtractionError,
};