'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { config } = require('./config/env');
const db = require('./config/db');
const requestId = require('./middleware/requestId');
const { apiLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1 === Number(process.env.TRUST_PROXY || 0) ? 1 : false);

app.use(requestId);
app.use(helmet());
app.use(
  cors({
    origin: config.clientOrigin, // only the React app may call this API from a browser
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Idempotency-Key'],
    exposedHeaders: ['X-Request-Id', 'Content-Disposition'],
  })
);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// Public health check: says whether the API and the database are up. Nothing sensitive.
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ success: true, data: { status: 'ok', database: 'up' } });
  } catch (err) {
    res.status(503).json({ success: false, error: { code: 'DATABASE_UNAVAILABLE', message: 'The API is running but the database is not reachable.', requestId: req.id } });
  }
});

app.use('/api', apiLimiter, routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
