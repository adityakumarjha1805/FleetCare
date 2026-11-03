const express = require('express');
const mongoose = require('mongoose');
const authenticate = require('../middleware/authenticate');
const ServiceRequest = require('../models/ServiceRequest');
const Vehicle = require('../models/Vehicle');
const { parseDateOnly, toDateOnly } = require('../utils/dateOnly');

const router = express.Router();
const serviceTypes = [
  'General inspection',
  'Engine repair',
  'Oil change',
  'Brake inspection',
  'Tire service',
  'Other',
];
const priorities = ['Low', 'Medium', 'High', 'Critical'];
const allowedStatusTransitions = {
  Pending: ['Approved', 'Rejected'],
  Approved: ['In Progress', 'Rejected'],
  'In Progress': ['Completed'],
  Completed: [],
  Rejected: [],
};
const editableFields = [
  'vehicleId',
  'serviceType',
  'description',
  'priority',
  'preferredDate',
  'notes',
];

router.use(authenticate);

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
  if (Object.keys(body).some((field) => !editableFields.includes(field))) {
    return { error: 'Request contains unsupported fields' };
  }
  if (editableFields.some((field) => !Object.hasOwn(body, field))) {
    return { error: 'All required service request fields must be provided' };
  }
  if (typeof body.vehicleId !== 'string' || !mongoose.isValidObjectId(body.vehicleId)) {
    return { error: 'vehicleId must be a valid vehicle ID' };
  }
  if (!serviceTypes.includes(body.serviceType)) {
    return { error: 'serviceType is not supported' };
  }
  if (
    typeof body.description !== 'string' ||
    !body.description.trim() ||
    body.description.trim().length > 1000
  ) {
    return { error: 'description must be a non-empty string of at most 1000 characters' };
  }
  if (!priorities.includes(body.priority)) {
    return { error: 'priority is not supported' };
  }

  const preferredDate = parseDateOnly(body.preferredDate);
  if (!preferredDate) {
    return { error: 'preferredDate must be a valid YYYY-MM-DD date' };
  }
  const preferredDateString = toDateOnly(preferredDate);
  if (preferredDateString < new Date().toISOString().slice(0, 10)) {
    return { error: 'preferredDate cannot be in the past' };
  }
  if (
    body.notes !== undefined &&
    (typeof body.notes !== 'string' || body.notes.trim().length > 1000)
  ) {
    return { error: 'notes must be a string of at most 1000 characters' };
  }

  return {
    values: {
      vehicleId: body.vehicleId,
      serviceType: body.serviceType,
      description: body.description.trim(),
      priority: body.priority,
      preferredDate,
      notes: body.notes?.trim() || '',
    },
  };
}

function safeRequest(record) {
  const vehicle =
    record.vehicle && typeof record.vehicle === 'object' && record.vehicle._id
      ? record.vehicle
      : null;
  const vehicleId = vehicle ? vehicle._id : record.vehicle?._id || record.vehicle;
  const id = record._id.toString();
  const requestedDate = toDateOnly(record.requestedDate);

  return {
    id,
    requestId: `SR-${requestedDate.slice(0, 4)}-${id.toUpperCase()}`,
    vehicleId: vehicleId ? vehicleId.toString() : null,
    vehicleName: vehicle?.vehicleName || 'Vehicle unavailable',
    registrationNumber: vehicle?.registrationNumber || '—',
    serviceType: record.serviceType,
    description: record.description,
    requestedDate,
    preferredDate: toDateOnly(record.preferredDate),
    priority: record.priority,
    status: record.status,
    notes: record.notes,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function invalidId(res) {
  return sendError(res, 400, 'INVALID_SERVICE_REQUEST_ID', 'Service request ID is invalid');
}

function notFound(res) {
  return sendError(res, 404, 'NOT_FOUND', 'Service request not found');
}

async function findOwnedVehicle(vehicleId, ownerId) {
  return Vehicle.findOne({ _id: vehicleId, owner: ownerId });
}

router.post('/', async (req, res, next) => {
  const { values, error } = validateInput(req.body);
  if (error) {
    return sendError(res, 400, 'INVALID_SERVICE_REQUEST', error);
  }

  try {
    const vehicle = await findOwnedVehicle(values.vehicleId, req.user.id);
    if (!vehicle) {
      return sendError(res, 404, 'VEHICLE_NOT_FOUND', 'Vehicle not found');
    }

    const record = await ServiceRequest.create({
      ...values,
      vehicle: vehicle._id,
      owner: req.user.id,
      requestedDate: new Date(),
      status: 'Pending',
    });
    return res.status(201).json({
      success: true,
      data: { request: safeRequest({ ...record.toObject(), vehicle }) },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/', async (req, res, next) => {
  const filter = { owner: req.user.id };
  if (req.query.vehicleId !== undefined) {
    if (!mongoose.isValidObjectId(req.query.vehicleId)) {
      return sendError(res, 400, 'INVALID_VEHICLE_ID', 'Vehicle ID is invalid');
    }
    filter.vehicle = req.query.vehicleId;
  }

  try {
    const requests = await ServiceRequest.find(filter)
      .populate('vehicle', 'vehicleName registrationNumber')
      .sort({ requestedDate: -1 });
    return res.json({
      success: true,
      data: { requests: requests.map(safeRequest) },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);

  try {
    const record = await ServiceRequest.findOne({
      _id: req.params.id,
      owner: req.user.id,
    }).populate('vehicle', 'vehicleName registrationNumber');
    if (!record) return notFound(res);
    return res.json({
      success: true,
      data: { request: safeRequest(record) },
    });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);
  const { values, error } = validateInput(req.body);
  if (error) {
    return sendError(res, 400, 'INVALID_SERVICE_REQUEST', error);
  }

  try {
    const vehicle = await findOwnedVehicle(values.vehicleId, req.user.id);
    if (!vehicle) {
      return sendError(res, 404, 'VEHICLE_NOT_FOUND', 'Vehicle not found');
    }

    const record = await ServiceRequest.findOneAndUpdate(
      { _id: req.params.id, owner: req.user.id, status: 'Pending' },
      {
        $set: {
          vehicle: vehicle._id,
          serviceType: values.serviceType,
          description: values.description,
          priority: values.priority,
          preferredDate: values.preferredDate,
          notes: values.notes,
        },
      },
      { new: true, runValidators: true },
    ).populate('vehicle', 'vehicleName registrationNumber');
    if (!record) return notFound(res);
    return res.json({
      success: true,
      data: { request: safeRequest(record) },
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);
  if (!isRecord(req.body) || Object.keys(req.body).length !== 1) {
    return sendError(
      res,
      400,
      'INVALID_STATUS_TRANSITION',
      'Only the service request status can be updated',
    );
  }
  if (typeof req.body.status !== 'string') {
    return sendError(
      res,
      400,
      'INVALID_STATUS_TRANSITION',
      'A valid next status must be provided',
    );
  }

  try {
    const current = await ServiceRequest.findOne({
      _id: req.params.id,
      owner: req.user.id,
    });
    if (!current) return notFound(res);

    const allowed = allowedStatusTransitions[current.status] || [];
    if (!allowed.includes(req.body.status)) {
      return sendError(
        res,
        400,
        'INVALID_STATUS_TRANSITION',
        `Cannot transition a ${current.status} request to ${req.body.status}`,
      );
    }

    const updated = await ServiceRequest.findOneAndUpdate(
      { _id: req.params.id, owner: req.user.id, status: current.status },
      { $set: { status: req.body.status } },
      { new: true, runValidators: true },
    ).populate('vehicle', 'vehicleName registrationNumber');
    if (!updated) {
      return sendError(
        res,
        409,
        'INVALID_STATUS_TRANSITION',
        'The service request status changed before this update could be applied',
      );
    }
    return res.json({
      success: true,
      data: { request: safeRequest(updated) },
    });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);

  try {
    const record = await ServiceRequest.findOneAndDelete({
      _id: req.params.id,
      owner: req.user.id,
      status: 'Pending',
    }).populate('vehicle', 'vehicleName registrationNumber');
    if (!record) return notFound(res);
    return res.json({
      success: true,
      data: { request: safeRequest(record) },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
