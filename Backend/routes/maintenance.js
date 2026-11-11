const express = require('express');
const mongoose = require('mongoose');
const authenticate = require('../middleware/authenticate');
const MaintenanceRecord = require('../models/MaintenanceRecord');
const Vehicle = require('../models/Vehicle');
const { parseDateOnly, toDateOnly } = require('../utils/dateOnly');
const { requireOperationalRole } = require('../middleware/authorize');
const {
  organizationValue,
  withOrganizationFilter,
} = require('../utils/organizationAccess');
const {
  createWorkflowNotifications,
  platformRecipients,
} = require('../services/notifications');

const router = express.Router();
const maintenanceTypes = [
  'Oil change',
  'Tire rotation',
  'Brake inspection',
  'General servicing',
  'Other',
];
const maintenanceStatuses = ['Upcoming', 'Overdue', 'Completed'];
const createFields = [
  'vehicleId',
  'type',
  'description',
  'maintenanceDate',
  'odometer',
  'odometerUnit',
  'status',
];

router.use(authenticate);
const maintenanceAccess = requireOperationalRole('user');

function sendError(res, status, code, message) {
  return res.status(status).json({
    success: false,
    error: { code, message },
  });
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateInput(body) {
  if (!isRecord(body)) {
    return { error: 'Request body must be a JSON object' };
  }
  if (Object.keys(body).some((field) => !createFields.includes(field))) {
    return { error: 'Request contains unsupported fields' };
  }
  if (createFields.some((field) => !Object.hasOwn(body, field))) {
    return { error: 'All required maintenance fields must be provided' };
  }
  if (typeof body.vehicleId !== 'string' || !mongoose.isValidObjectId(body.vehicleId)) {
    return { error: 'vehicleId must be a valid vehicle ID' };
  }
  if (!maintenanceTypes.includes(body.type)) {
    return { error: 'type is not supported' };
  }
  if (
    typeof body.description !== 'string' ||
    !body.description.trim() ||
    body.description.trim().length > 1000
  ) {
    return { error: 'description must be a non-empty string of at most 1000 characters' };
  }

  const maintenanceDate = parseDateOnly(body.maintenanceDate);
  if (!maintenanceDate) {
    return { error: 'maintenanceDate must be a valid YYYY-MM-DD date' };
  }
  if (
    typeof body.odometer !== 'number' ||
    !Number.isInteger(body.odometer) ||
    body.odometer < 0 ||
    body.odometer > 2_000_000
  ) {
    return { error: 'odometer must be a whole number from 0 to 2000000' };
  }
  if (!['km', 'miles'].includes(body.odometerUnit)) {
    return { error: 'odometerUnit must be km or miles' };
  }
  if (!maintenanceStatuses.includes(body.status)) {
    return { error: 'status is not supported' };
  }

  const date = toDateOnly(maintenanceDate);
  const today = new Date().toISOString().slice(0, 10);
  if (body.status === 'Completed' && date > today) {
    return { error: 'Completed maintenance cannot have a future date' };
  }
  if (
    body.status === 'Upcoming' && date < today ||
    body.status === 'Overdue' && date >= today
  ) {
    return { error: 'Maintenance status must match the scheduled date' };
  }

  return {
    values: {
      vehicleId: body.vehicleId,
      type: body.type,
      description: body.description.trim(),
      maintenanceDate,
      odometer: body.odometer,
      odometerUnit: body.odometerUnit,
      status: body.status,
      completedAt: body.status === 'Completed' ? maintenanceDate : null,
    },
  };
}

function safeMaintenance(record) {
  const vehicle =
    record.vehicle && typeof record.vehicle === 'object' && record.vehicle._id
      ? record.vehicle
      : null;
  const vehicleId = vehicle ? vehicle._id : record.vehicle?._id || record.vehicle;
  const scheduledDate = toDateOnly(record.maintenanceDate);
  const today = new Date().toISOString().slice(0, 10);
  const status =
    record.status === 'Completed'
      ? 'Completed'
      : scheduledDate < today
        ? 'Overdue'
        : 'Upcoming';

  return {
    id: record._id.toString(),
    vehicleId: vehicleId ? vehicleId.toString() : null,
    vehicleName: vehicle?.vehicleName || 'Vehicle unavailable',
    registrationNumber: vehicle?.registrationNumber || '—',
    type: record.type,
    description: record.description,
    maintenanceDate: scheduledDate,
    completedAt: toDateOnly(record.completedAt),
    odometer: record.odometer,
    odometerUnit: record.odometerUnit,
    status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function invalidId(res) {
  return sendError(res, 400, 'INVALID_MAINTENANCE_ID', 'Maintenance record ID is invalid');
}

function notFound(res) {
  return sendError(res, 404, 'NOT_FOUND', 'Maintenance record not found');
}

router.post('/', maintenanceAccess, async (req, res, next) => {
  const { values, error } = validateInput(req.body);
  if (error) {
    return sendError(res, 400, 'INVALID_MAINTENANCE', error);
  }

  try {
    const vehicle = await Vehicle.findOne(
      withOrganizationFilter(req, { _id: values.vehicleId }),
    );
    if (!vehicle) {
      return sendError(res, 404, 'VEHICLE_NOT_FOUND', 'Vehicle not found');
    }
    if (vehicle.odometerUnit !== values.odometerUnit) {
      return sendError(
        res,
        400,
        'INVALID_MAINTENANCE',
        'odometerUnit must match the vehicle odometer unit',
      );
    }

    const record = await MaintenanceRecord.create({
      ...values,
      vehicle: vehicle._id,
      owner: req.user.id,
      organization: organizationValue(req),
    });
    return res.status(201).json({
      success: true,
      data: { maintenance: safeMaintenance({ ...record.toObject(), vehicle }) },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/', maintenanceAccess, async (req, res, next) => {
  let filter = withOrganizationFilter(req);
  if (req.query.vehicleId !== undefined) {
    if (!mongoose.isValidObjectId(req.query.vehicleId)) {
      return sendError(res, 400, 'INVALID_VEHICLE_ID', 'Vehicle ID is invalid');
    }
    filter = withOrganizationFilter(req, { vehicle: req.query.vehicleId });
  }

  try {
    const records = await MaintenanceRecord.find(filter)
      .populate('vehicle', 'vehicleName registrationNumber')
      .sort({ maintenanceDate: 1, createdAt: -1 });
    return res.json({
      success: true,
      data: { maintenance: records.map(safeMaintenance) },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', maintenanceAccess, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);

  try {
    const record = await MaintenanceRecord.findOne(
      withOrganizationFilter(req, { _id: req.params.id }),
    ).populate('vehicle', 'vehicleName registrationNumber');
    if (!record) return notFound(res);
    return res.json({
      success: true,
      data: { maintenance: safeMaintenance(record) },
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', maintenanceAccess, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);
  if (!isRecord(req.body) || Object.keys(req.body).length !== 1) {
    return sendError(
      res,
      400,
      'INVALID_MAINTENANCE',
      'Only the maintenance status can be updated',
    );
  }
  if (req.body.status !== 'Completed') {
    return sendError(
      res,
      400,
      'INVALID_MAINTENANCE',
      'Only scheduled maintenance can be marked Completed',
    );
  }

  try {
    const record = await MaintenanceRecord.findOneAndUpdate(
      withOrganizationFilter(req, {
        _id: req.params.id,
        status: { $in: ['Upcoming', 'Overdue'] },
      }),
      { $set: { status: 'Completed', completedAt: new Date() } },
      { new: true, runValidators: true },
    ).populate('vehicle', 'vehicleName registrationNumber');
    if (!record) return notFound(res);
    const recipients = await platformRecipients(['admin'], req.user.id);
    await createWorkflowNotifications({
      recipientIds: recipients,
      title: 'Maintenance completed',
      message: `${record.vehicle?.vehicleName || 'A vehicle'} maintenance was marked completed.`,
      type: 'maintenance',
      relatedResourceType: 'MaintenanceRecord',
      relatedResourceId: record._id,
      dedupeKey: `maintenance-completed:${record._id}`,
    });
    return res.json({
      success: true,
      data: { maintenance: safeMaintenance(record) },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
