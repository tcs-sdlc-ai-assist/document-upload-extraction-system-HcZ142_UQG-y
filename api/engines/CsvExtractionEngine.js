const { parse } = require('csv-parse/sync');
const logger = require('../utils/logger');

const extract = async (buffer) => {
  logger.info('Starting CSV extraction');

  if (!buffer || buffer.length === 0) {
    logger.warn('CSV extraction failed: empty buffer provided');
    throw new CsvExtractionError('CSV buffer is empty or not provided');
  }

  try {
    const startTime = Date.now();

    const csvString = buffer.toString('utf-8');

    const records = parse(csvString, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      relax_quotes: true,
    });

    const duration = Date.now() - startTime;

    const headers = records.length > 0 ? Object.keys(records[0]) : [];
    const rowCount = records.length;

    const extractedText = csvToText(headers, records);

    const extractedTables = [
      {
        headers,
        rows: records,
        row_count: rowCount,
        column_count: headers.length,
      },
    ];

    const metadata = {
      format: 'CSV',
      row_count: rowCount,
      column_count: headers.length,
      headers,
      text_length: extractedText.length,
    };

    logger.info('CSV extraction completed successfully', {
      rowCount,
      columnCount: headers.length,
      textLength: extractedText.length,
      duration: `${duration}ms`,
    });

    return {
      extracted_text: extractedText,
      extracted_tables: extractedTables,
      metadata,
      page_count: null,
    };
  } catch (err) {
    if (err instanceof CsvExtractionError) {
      throw err;
    }

    logger.error('CSV extraction failed', {
      error: err.message,
      stack: err.stack,
    });

    if (
      err.message &&
      (err.message.includes('Invalid Record Length') ||
        err.message.includes('Invalid Opening Quote') ||
        err.message.includes('Invalid Closing Quote') ||
        err.message.includes('invalid') ||
        err.message.includes('Quote Not Closed') ||
        err.message.includes('RECORD_INCONSISTENT_FIELDS_LENGTH') ||
        err.message.includes('INVALID_OPENING_QUOTE') ||
        err.message.includes('CSV_QUOTE_NOT_CLOSED'))
    ) {
      throw new CsvExtractionError(
        'The CSV file appears to be malformed or contains invalid formatting and cannot be processed'
      );
    }

    throw new CsvExtractionError(
      `Failed to extract data from CSV: ${err.message}`
    );
  }
};

const csvToText = (headers, records) => {
  if (!headers || headers.length === 0) {
    return '';
  }

  const lines = [headers.join(', ')];

  for (const record of records) {
    const values = headers.map((header) => {
      const val = record[header];
      if (val === null || val === undefined) {
        return '';
      }
      return String(val);
    });
    lines.push(values.join(', '));
  }

  return lines.join('\n');
};

class CsvExtractionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CsvExtractionError';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  extract,
  CsvExtractionError,
};