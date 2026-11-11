const express = require('express');
const mongoose = require('mongoose');
const authenticate = require('../middleware/authenticate');
const { requireOperationalRole } = require('../middleware/authorize');
const Vehicle = require('../models/Vehicle');
const {
  organizationFilter,
  organizationValue,
  withOrganizationFilter,
} = require('../utils/organizationAccess');

const router = express.Router();
const editableFields = [
  'vehicleName',
  'registrationNumber',
  'make',
  'model',
  'year',
  'vehicleType',
  'odometer',
  'odometerUnit',
  'healthStatus',
];
const requiredFields = [
  'vehicleName',
  'registrationNumber',
  'make',
  'model',
  'year',
  'vehicleType',
  'odometer',
  'odometerUnit',
];
const vehicleTypes = ['Truck', 'Van', 'Car', 'Pickup', 'Other'];
const odometerUnits = ['km', 'miles'];
const healthStatuses = ['Healthy', 'Needs Attention', 'Critical'];

router.use(authenticate);
const readVehicleAccess = requireOperationalRole(
  'user',
);
const writeVehicleAccess = requireOperationalRole(
  'user',
);

function sendError(res, status, code, message) {
  return res.status(status).json({
    success: false,
    error: { code, message },
  });
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRegistrationNumber(value) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, '').toUpperCase()
    : value;
}

function validateInput(body, { creating = false } = {}) {
  if (!isRecord(body)) {
    return { error: 'Request body must be a JSON object' };
  }

  const keys = Object.keys(body);
  const invalidFields = keys.filter((key) => !editableFields.includes(key));
  if (invalidFields.length) {
    return { error: 'Request contains unsupported fields' };
  }
  if (creating && requiredFields.some((field) => !Object.hasOwn(body, field))) {
    return { error: 'All required vehicle fields must be provided' };
  }
  if (keys.length === 0) {
    return { error: 'At least one vehicle field must be provided' };
  }

  const values = { ...body };

  if (Object.hasOwn(values, 'vehicleName')) {
    if (
      typeof values.vehicleName !== 'string' ||
      !values.vehicleName.trim() ||
      values.vehicleName.trim().length > 100
    ) {
      return { error: 'vehicleName must be a non-empty string of at most 100 characters' };
    }
    values.vehicleName = values.vehicleName.trim();
  }

  if (Object.hasOwn(values, 'registrationNumber')) {
    values.registrationNumber = normalizeRegistrationNumber(values.registrationNumber);
    if (
      typeof values.registrationNumber !== 'string' ||
      !/^[A-Z0-9-]{2,20}$/.test(values.registrationNumber)
    ) {
      return { error: 'registrationNumber must contain 2-20 letters, numbers, or hyphens' };
    }
  }

  for (const field of ['make', 'model']) {
    if (Object.hasOwn(values, field)) {
      if (
        typeof values[field] !== 'string' ||
        !values[field].trim() ||
        values[field].trim().length > 100
      ) {
        return { error: `${field} must be a non-empty string of at most 100 characters` };
      }
      values[field] = values[field].trim();
    }
  }

  if (Object.hasOwn(values, 'year')) {
    if (
      typeof values.year !== 'number' ||
      !Number.isInteger(values.year) ||
      values.year < 1886 ||
      values.year > new Date().getFullYear() + 1
    ) {
      return { error: 'year must be a valid vehicle model year' };
    }
  }

  if (Object.hasOwn(values, 'vehicleType') && !vehicleTypes.includes(values.vehicleType)) {
    return { error: 'vehicleType is not supported' };
  }

  if (
    Object.hasOwn(values, 'odometer') &&
    (typeof values.odometer !== 'number' ||
      !Number.isFinite(values.odometer) ||
      values.odometer < 0)
  ) {
    return { error: 'odometer must be a non-negative number' };
  }

  if (Object.hasOwn(values, 'odometerUnit') && !odometerUnits.includes(values.odometerUnit)) {
    return { error: 'odometerUnit must be km or miles' };
  }

  if (
    Object.hasOwn(values, 'healthStatus') &&
    !healthStatuses.includes(values.healthStatus)
  ) {
    return { error: 'healthStatus is not supported' };
  }

  return { values };
}

function safeVehicle(vehicle) {
  const source =
    typeof vehicle.toObject === 'function' ? vehicle.toObject() : vehicle;
  const owner =
    source.owner && typeof source.owner === 'object' && source.owner._id
      ? source.owner._id
      : source.owner;

  return {
    id: source._id.toString(),
    vehicleName: source.vehicleName,
    registrationNumber: source.registrationNumber,
    make: source.make,
    model: source.model,
    year: source.year,
    vehicleType: source.vehicleType,
    odometer: source.odometer,
    odometerUnit: source.odometerUnit,
    healthStatus: source.healthStatus,
    owner: owner.toString(),
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

function invalidVehicleId(res) {
  return sendError(res, 400, 'INVALID_VEHICLE_ID', 'Vehicle ID is invalid');
}

function notFound(res) {
  return sendError(res, 404, 'NOT_FOUND', 'Vehicle not found');
}

function handleDuplicateRegistration(error, res, next) {
  if (error.code === 11000) {
    return sendError(
      res,
      409,
      'REGISTRATION_NUMBER_IN_USE',
      'A vehicle with this registration number already exists',
    );
  }
  return next(error);
}

router.post('/', writeVehicleAccess, async (req, res, next) => {
  const { values, error } = validateInput(req.body, { creating: true });
  if (error) {
    return sendError(res, 400, 'INVALID_VEHICLE', error);
  }

  try {
    const vehicle = await Vehicle.create({
      ...values,
      owner: req.user.id,
      organization: organizationValue(req),
    });
    return res.status(201).json({
      success: true,
      data: { vehicle: safeVehicle(vehicle) },
    });
  } catch (createError) {
    return handleDuplicateRegistration(createError, res, next);
  }
});

router.get('/', readVehicleAccess, async (req, res, next) => {
  try {
    const vehicles = await Vehicle.find(organizationFilter(req)).sort({ createdAt: -1 });
    return res.json({
      success: true,
      data: { vehicles: vehicles.map(safeVehicle) },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', readVehicleAccess, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return invalidVehicleId(res);
  }

  try {
    const vehicle = await Vehicle.findOne(
      withOrganizationFilter(req, { _id: req.params.id }),
    );
    if (!vehicle) {
      return notFound(res);
    }
    return res.json({
      success: true,
      data: { vehicle: safeVehicle(vehicle) },
    });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', writeVehicleAccess, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return invalidVehicleId(res);
  }

  const { values, error: validationError } = validateInput(req.body);
  if (validationError) {
    return sendError(res, 400, 'INVALID_VEHICLE', validationError);
  }

  try {
    const vehicle = await Vehicle.findOneAndUpdate(
      withOrganizationFilter(req, { _id: req.params.id }),
      { $set: values },
      { new: true, runValidators: true },
    );
    if (!vehicle) {
      return notFound(res);
    }
    return res.json({
      success: true,
      data: { vehicle: safeVehicle(vehicle) },
    });
  } catch (updateError) {
    return handleDuplicateRegistration(updateError, res, next);
  }
});

router.delete('/:id', writeVehicleAccess, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return invalidVehicleId(res);
  }

  try {
    const vehicle = await Vehicle.findOneAndDelete(
      withOrganizationFilter(req, { _id: req.params.id }),
    );
    if (!vehicle) {
      return notFound(res);
    }
    return res.json({
      success: true,
      data: { vehicle: safeVehicle(vehicle) },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
