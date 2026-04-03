require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const documentRoutes = require('./routes/documentRoutes');
const logRoutes = require('./routes/logRoutes');
const monitoringRoutes = require('./routes/monitoringRoutes');

const { auditMiddleware } = require('./middleware/auditMiddleware');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
  : ['http://localhost:5173', 'http://localhost:3001'];

app.use(helmet());

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many requests. Please try again later.',
      statusCode: 429,
    },
  },
});

app.use('/api/', limiter);

app.use(auditMiddleware);

app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/monitoring', monitoringRoutes);

app.use(notFoundHandler);

app.use(errorHandler);

const PORT = parseInt(process.env.PORT, 10) || 3001;

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    logger.info('Server started', {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      allowedOrigins,
    });
  });
}

module.exports = app;