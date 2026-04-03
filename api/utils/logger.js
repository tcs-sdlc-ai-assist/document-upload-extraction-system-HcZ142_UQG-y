const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLevel = (process.env.LOG_LEVEL || 'debug').toLowerCase();
const currentLevelValue = LOG_LEVELS[currentLevel] !== undefined ? LOG_LEVELS[currentLevel] : LOG_LEVELS.debug;

const formatEntry = (level, message, context = {}) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  if (process.env.NODE_ENV === 'development') {
    return entry;
  }

  return JSON.stringify(entry);
};

const shouldLog = (level) => {
  const levelValue = LOG_LEVELS[level];
  return levelValue !== undefined && levelValue <= currentLevelValue;
};

const error = (message, context = {}) => {
  if (shouldLog('error')) {
    console.error(formatEntry('error', message, context));
  }
};

const warn = (message, context = {}) => {
  if (shouldLog('warn')) {
    console.warn(formatEntry('warn', message, context));
  }
};

const info = (message, context = {}) => {
  if (shouldLog('info')) {
    console.log(formatEntry('info', message, context));
  }
};

const debug = (message, context = {}) => {
  if (shouldLog('debug')) {
    console.log(formatEntry('debug', message, context));
  }
};

module.exports = {
  error,
  warn,
  info,
  debug,
  LOG_LEVELS,
};