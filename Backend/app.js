const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const apiRouter = require('./routes/api');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

const app = express();

app.use(
  cors({
    origin: config.frontendOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use('/api', apiRouter);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
