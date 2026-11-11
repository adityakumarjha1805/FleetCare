const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const apiRouter = require('./routes/api');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

const app = express();

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
    if (config.isAllowedFrontendOrigin(origin)) {
      callback(null, true);
    } else {
      const error = new Error('Origin not allowed by CORS');
      error.statusCode = 403;
      error.code = 'CORS_ORIGIN_DENIED';
      callback(error);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use('/api', apiRouter);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
