const express = require('express');
const mongoose = require('mongoose');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const DiagnosticRecord = require('../models/DiagnosticRecord');
const MaintenanceRecord = require('../models/MaintenanceRecord');
const ServiceRequest = require('../models/ServiceRequest');
const PartsRequest = require('../models/PartsRequest');
const Notification = require('../models/Notification');

const router = express.Router();
router.use(authenticate, authorize({ roles: ['admin'] }));

function safeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role === 'admin' ? 'admin' : 'user',
    onboardingCompleted: user.onboardingCompleted !== false,
    createdAt: user.createdAt,
  };
}

function safeRecord(record) {
  const value = typeof record.toObject === 'function' ? record.toObject() : record;
  return {
    id: value._id.toString(),
    owner: value.owner?.toString() || value.requestedBy?.toString() || null,
    vehicle: value.vehicle?.toString() || null,
    status: value.status || null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

router.get('/summary', async (req, res, next) => {
  try {
    const [
      users,
      admins,
      vehicles,
      diagnostics,
      maintenance,
      serviceRequests,
      partsRequests,
      notifications,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'admin' }),
      Vehicle.countDocuments(),
      DiagnosticRecord.countDocuments(),
      MaintenanceRecord.countDocuments(),
      ServiceRequest.countDocuments(),
      PartsRequest.countDocuments(),
      Notification.countDocuments(),
    ]);
    return res.json({
      success: true,
      data: {
        users,
        admins,
        vehicles,
        diagnostics,
        maintenance,
        serviceRequests,
        partsRequests,
        notifications,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const users = await User.find({})
      .select('name email role onboardingCompleted createdAt')
      .sort({ createdAt: -1 })
      .limit(100);
    return res.json({ success: true, data: { users: users.map(safeUser) } });
  } catch (error) {
    return next(error);
  }
});

router.patch('/users/:id/role', async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_USER_ID', message: 'User ID is invalid' },
    });
  }
  if (
    !req.body ||
    Array.isArray(req.body) ||
    Object.keys(req.body).length !== 1 ||
    !['admin', 'user'].includes(req.body.role)
  ) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ROLE', message: 'role must be admin or user' },
    });
  }
  if (req.params.id === req.user.id && req.body.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: { code: 'SELF_ROLE_CHANGE_FORBIDDEN', message: 'You cannot remove your own admin access' },
    });
  }
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { role: req.body.role } },
      { new: true, runValidators: true },
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }
    return res.json({ success: true, data: { user: safeUser(user) } });
  } catch (error) {
    return next(error);
  }
});

const collections = {
  vehicles: Vehicle,
  diagnostics: DiagnosticRecord,
  maintenance: MaintenanceRecord,
  serviceRequests: ServiceRequest,
  partsRequests: PartsRequest,
  notifications: Notification,
};

for (const [name, Model] of Object.entries(collections)) {
  router.get(`/${name}`, async (req, res, next) => {
    try {
      const records = await Model.find({}).sort({ createdAt: -1 }).limit(100);
      return res.json({ success: true, data: { [name]: records.map(safeRecord) } });
    } catch (error) {
      return next(error);
    }
  });
}

module.exports = router;
