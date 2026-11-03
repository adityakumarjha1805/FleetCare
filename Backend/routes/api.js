const express = require('express');
const mongoose = require('mongoose');
const notFound = require('../middleware/notFound');
const authRouter = require('./auth');

const router = express.Router();

router.get('/health', (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    data: {
      status: databaseConnected ? 'ok' : 'degraded',
      database: {
        connected: databaseConnected,
      },
    },
  });
});

router.use('/auth', authRouter);
router.use(notFound);

module.exports = router;
