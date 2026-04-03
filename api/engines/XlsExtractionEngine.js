const XLSX = require('xlsx');
const logger = require('../utils/logger');

const extract = async (buffer) => {
  logger.info('Starting XLS/XLSX extraction');

  if (!buffer || buffer.length === 0) {
    logger.warn('XLS/XLSX extraction failed: empty buffer provided');
    throw new XlsExtractionError('XLS/XLSX buffer is empty or not provided');
  }

  try {
    const startTime = Date.now();

    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
      cellNF: true,
      cellText: true,
    });

    const duration = Date.now() - startTime;

    const sheetNames = workbook.SheetNames || [];

    if (sheetNames.length === 0) {
      logger.warn('XLS/XLSX extraction: workbook contains no sheets');
      throw new XlsExtractionError('The spreadsheet contains no sheets');
    }

    const extractedTables = [];
    const sheetData = {};
    let totalRows = 0;
    let totalColumns = 0;
    const textParts = [];

    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName];

      const records = XLSX.utils.sheet_to_json(worksheet, {
        defval: '',
        raw: false,
      });

      sheetData[sheetName] = records;

      const headers = records.length > 0 ? Object.keys(records[0]) : [];
      const rowCount = records.length;
      const columnCount = headers.length;

      totalRows += rowCount;
      if (columnCount > totalColumns) {
        totalColumns = columnCount;
      }

      extractedTables.push({
        sheet_name: sheetName,
        headers,
        rows: records,
        row_count: rowCount,
        column_count: columnCount,
      });

      const sheetText = sheetToText(sheetName, headers, records);
      if (sheetText) {
        textParts.push(sheetText);
      }
    }

    const extractedText = textParts.join('\n\n');

    const metadata = {
      format: sheetNames.length > 0 && workbook.bookType ? workbook.bookType.toUpperCase() : 'XLSX',
      sheet_count: sheetNames.length,
      sheet_names: sheetNames,
      total_row_count: totalRows,
      max_column_count: totalColumns,
      text_length: extractedText.length,
    };

    logger.info('XLS/XLSX extraction completed successfully', {
      sheetCount: sheetNames.length,
      totalRows,
      maxColumns: totalColumns,
      textLength: extractedText.length,
      duration: `${duration}ms`,
    });

    return {
      extracted_text: extractedText,
      extracted_tables: extractedTables,
      metadata,
      page_count: sheetNames.length,
    };
  } catch (err) {
    if (err instanceof XlsExtractionError) {
      throw err;
    }

    logger.error('XLS/XLSX extraction failed', {
      error: err.message,
      stack: err.stack,
    });

    if (
      err.message &&
      (err.message.includes('File is password-protected') ||
        err.message.includes('password') ||
        err.message.includes('encrypt') ||
        err.message.includes('Encrypted') ||
        err.message.includes('corrupted') ||
        err.message.includes('invalid') ||
        err.message.includes('Unexpected') ||
        err.message.includes('not a valid') ||
        err.message.includes('CFB') ||
        err.message.includes('Cannot read') ||
        err.message.includes('Failed to read') ||
        err.message.includes('Unsupported file'))
    ) {
      throw new XlsExtractionError(
        'The spreadsheet file appears to be corrupted, password-protected, or invalid and cannot be processed'
      );
    }

    throw new XlsExtractionError(
      `Failed to extract data from spreadsheet: ${err.message}`
    );
  }
};

const sheetToText = (sheetName, headers, records) => {
  if (!headers || headers.length === 0) {
    return '';
  }

  const lines = [`Sheet: ${sheetName}`, headers.join(', ')];

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

class XlsExtractionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'XlsExtractionError';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  extract,
  XlsExtractionError,
};