const express = require('express');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const Vehicle = require('../models/Vehicle');
const DiagnosticRecord = require('../models/DiagnosticRecord');
const MaintenanceRecord = require('../models/MaintenanceRecord');
const ServiceRequest = require('../models/ServiceRequest');
const PartsRequest = require('../models/PartsRequest');
const { parseDateOnly } = require('../utils/dateOnly');

const router = express.Router();
const reportAccess = authorize({
  roles: ['admin', 'user'],
  organization: false,
});

function sendError(res, status, code, message) {
  return res.status(status).json({
    success: false,
    error: { code, message },
  });
}

function parseDateRange(query) {
  const from = query.from === undefined ? null : parseDateOnly(query.from);
  const to = query.to === undefined ? null : parseDateOnly(query.to);
  if ((query.from !== undefined && !from) || (query.to !== undefined && !to)) {
    return { error: 'from and to must be valid YYYY-MM-DD dates' };
  }
  if (from && to && from > to) {
    return { error: 'from cannot be later than to' };
  }
  const end = to ? new Date(to) : new Date();
  end.setUTCDate(end.getUTCDate() + 1);
  return {
    from: from || new Date(0),
    to: end,
    fromDate: from ? query.from : null,
    toDate: to ? query.to : null,
  };
}

function rangeMatch(field, range) {
  return range.from || range.to
    ? { [field]: { ...(range.from ? { $gte: range.from } : {}), ...(range.to ? { $lt: range.to } : {}) } }
    : {};
}

function distribution(rows) {
  return rows.map((row) => ({ label: row._id || 'Unknown', count: row.count }));
}

function monthLabel(row) {
  return `${row._id.year}-${String(row._id.month).padStart(2, '0')}`;
}

router.use(authenticate, reportAccess);

router.get('/summary', async (req, res, next) => {
  const range = parseDateRange(req.query);
  if (range.error) return sendError(res, 400, 'INVALID_DATE_RANGE', range.error);

  const ownershipMatch = req.user.role === 'admin' ? {} : { owner: req.user.id };
  const partsOwnershipMatch = req.user.role === 'admin' ? {} : { requestedBy: req.user.id };
  try {
    const [
      vehicleTotal,
      vehicleStatuses,
      diagnosticTotal,
      diagnosticSeverities,
      maintenanceRecords,
      maintenanceStatuses,
      maintenanceTrend,
      serviceRequestTotal,
      serviceRequestStatuses,
      partsRequestTotal,
      partsRequestStatuses,
    ] = await Promise.all([
      Vehicle.countDocuments(ownershipMatch),
      Vehicle.aggregate([
        { $match: ownershipMatch },
        { $group: { _id: '$healthStatus', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      DiagnosticRecord.countDocuments({
        ...ownershipMatch,
        ...rangeMatch('dateDetected', range),
      }),
      DiagnosticRecord.aggregate([
        { $match: { ...ownershipMatch, ...rangeMatch('dateDetected', range) } },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      MaintenanceRecord.countDocuments({
        ...ownershipMatch,
        ...rangeMatch('maintenanceDate', range),
      }),
      MaintenanceRecord.aggregate([
        { $match: { ...ownershipMatch, ...rangeMatch('maintenanceDate', range) } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      MaintenanceRecord.aggregate([
        { $match: { ...ownershipMatch, ...rangeMatch('maintenanceDate', range) } },
        {
          $group: {
            _id: {
              year: { $year: '$maintenanceDate' },
              month: { $month: '$maintenanceDate' },
            },
            count: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] },
            },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      ServiceRequest.countDocuments({
        ...ownershipMatch,
        ...rangeMatch('requestedDate', range),
      }),
      ServiceRequest.aggregate([
        { $match: { ...ownershipMatch, ...rangeMatch('requestedDate', range) } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      PartsRequest.countDocuments({
        ...partsOwnershipMatch,
        ...rangeMatch('createdAt', range),
      }),
      PartsRequest.aggregate([
        { $match: { ...partsOwnershipMatch, ...rangeMatch('createdAt', range) } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    return res.json({
      success: true,
      data: {
        range: { from: range.fromDate, to: range.toDate },
        vehicles: {
          total: vehicleTotal,
          status: distribution(vehicleStatuses),
        },
        diagnostics: {
          total: diagnosticTotal,
          severity: distribution(diagnosticSeverities),
        },
        maintenance: {
          total: maintenanceRecords,
          status: distribution(maintenanceStatuses),
          trend: maintenanceTrend.map((row) => ({
            month: monthLabel(row),
            count: row.count,
            completed: row.completed,
          })),
          costs: { available: false, total: null, reason: 'Maintenance records do not store cost values.' },
        },
        serviceRequests: {
          total: serviceRequestTotal,
          status: distribution(serviceRequestStatuses),
        },
        partsRequests: {
          total: partsRequestTotal,
          status: distribution(partsRequestStatuses),
          costs: { available: false, total: null, reason: 'Parts requests do not store reliable cost snapshots.' },
        },
      },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
