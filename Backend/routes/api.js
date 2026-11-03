const express = require('express');
const mongoose = require('mongoose');
const notFound = require('../middleware/notFound');
const authRouter = require('./auth');
const diagnosticsRouter = require('./diagnostics');
const maintenanceRouter = require('./maintenance');
const serviceRequestsRouter = require('./serviceRequests');
const vehiclesRouter = require('./vehicles');

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
router.use('/vehicles', vehiclesRouter);
router.use('/diagnostics', diagnosticsRouter);
router.use('/maintenance', maintenanceRouter);
router.use('/service-requests', serviceRequestsRouter);
router.use(notFound);

module.exports = router;
