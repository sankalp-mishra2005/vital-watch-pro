const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const logger = require('./config/logger');
const { apiLimiter } = require('./middlewares/rateLimiter');
const errorHandler = require('./middlewares/errorHandler');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const patientRoutes = require('./routes/patient');
const vitalsRoutes = require('./routes/vitals');

const app = express();

// Security headers
app.use(helmet());

// CORS whitelist
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:8080').split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// Global rate limit
app.use('/api', apiLimiter);

// Health check (no auth)
app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  version: '2.0.0',
  uptime: process.uptime(),
  timestamp: new Date(),
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/vitals', vitalsRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Global error handler
app.use(errorHandler);

module.exports = app;
