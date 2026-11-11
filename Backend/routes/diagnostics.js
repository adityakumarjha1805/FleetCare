const express = require('express');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const authenticate = require('../middleware/authenticate');
const DiagnosticRecord = require('../models/DiagnosticRecord');
const Vehicle = require('../models/Vehicle');
const diagnosticAnalysisService = require('../services/diagnosticAnalysisService');
const { requireOperationalRole } = require('../middleware/authorize');
const {
  organizationValue,
  withOrganizationFilter,
} = require('../utils/organizationAccess');

const router = express.Router();
const diagnosticCodePattern =
  /^(?:[PBCU][0-3][0-9A-F]{3}|SPN\s?\d{1,5}(?:\s+FMI\s?\d{1,2})?)$/i;
const severityOptions = ['Critical', 'High', 'Medium', 'Low'];
const sourceOptions = ['Manual', 'OBD-II', 'Telematics', 'Other'];
const createFields = [
  'vehicleId',
  'code',
  'description',
  'source',
  'severity',
  'dateDetected',
  'odometer',
  'odometerUnit',
  'notes',
];

router.use(authenticate);
const readDiagnosticAccess = requireOperationalRole(
  'user',
);
const manageDiagnosticAccess = requireOperationalRole(
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

function parseDateDetected(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const parts = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-](\d{2}):(\d{2}))$/,
  );
  if (!parts) return null;

  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const hour = Number(parts[4]);
  const minute = Number(parts[5]);
  const second = Number(parts[6] || 0);
  const offsetHour = Number(parts[8] || 0);
  const offsetMinute = Number(parts[9] || 0);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date.getTime() > Date.now()
    ? null
    : date;
}

function validateCreateInput(body) {
  if (!isRecord(body)) {
    return { error: 'Request body must be a JSON object' };
  }

  if (Object.keys(body).some((field) => !createFields.includes(field))) {
    return { error: 'Request contains unsupported fields' };
  }

  const requiredFields = [
    'vehicleId',
    'code',
    'severity',
    'dateDetected',
    'odometer',
    'odometerUnit',
  ];
  if (requiredFields.some((field) => !Object.hasOwn(body, field))) {
    return { error: 'All required diagnostic fields must be provided' };
  }

  const vehicleId = body.vehicleId;
  if (
    typeof vehicleId !== 'string' ||
    !mongoose.isValidObjectId(vehicleId)
  ) {
    return { error: 'vehicleId must be a valid vehicle ID' };
  }

  if (
    typeof body.code !== 'string' ||
    body.code.trim().length > 32 ||
    !diagnosticCodePattern.test(body.code.trim().replace(/\s+/g, ' ').toUpperCase())
  ) {
    return {
      error: 'code must be a valid OBD-II or SPN diagnostic trouble code',
    };
  }

  if (!severityOptions.includes(body.severity)) {
    return { error: 'severity is not supported' };
  }

  const dateDetected = parseDateDetected(body.dateDetected);
  if (!dateDetected) {
    return { error: 'dateDetected must be a valid non-future timestamp' };
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

  if (body.source !== undefined && !sourceOptions.includes(body.source)) {
    return { error: 'source is not supported' };
  }

  if (
    body.description !== undefined &&
    (typeof body.description !== 'string' ||
      body.description.trim().length > 300)
  ) {
    return { error: 'description must be a string of at most 300 characters' };
  }

  if (
    body.notes !== undefined &&
    (typeof body.notes !== 'string' || body.notes.trim().length > 1000)
  ) {
    return { error: 'notes must be a string of at most 1000 characters' };
  }

  return {
    values: {
      vehicleId,
      code: body.code.trim().replace(/\s+/g, ' ').toUpperCase(),
      description: body.description?.trim() || '',
      source: body.source || 'Manual',
      severity: body.severity,
      dateDetected,
      odometer: body.odometer,
      odometerUnit: body.odometerUnit,
      notes: body.notes?.trim() || '',
    },
  };
}

function safeDiagnostic(record) {
  const vehicle =
    record.vehicle && typeof record.vehicle === 'object' && record.vehicle._id
      ? record.vehicle
      : null;
  const vehicleId = vehicle ? vehicle._id : record.vehicle?._id || record.vehicle;

  return {
    id: record._id.toString(),
    vehicleId: vehicleId ? vehicleId.toString() : null,
    vehicleName: vehicle?.vehicleName || 'Vehicle unavailable',
    registrationNumber: vehicle?.registrationNumber || '—',
    code: record.code,
    description: record.description,
    issueDescription: record.description || 'Description not provided',
    source: record.source,
    severity: record.severity,
    status: record.status,
    dateDetected: record.dateDetected.toISOString(),
    odometer: record.odometer,
    odometerUnit: record.odometerUnit,
    notes: record.notes,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function invalidDiagnosticId(res) {
  return sendError(
    res,
    400,
    'INVALID_DIAGNOSTIC_ID',
    'Diagnostic record ID is invalid',
  );
}

function notFound(res) {
  return sendError(res, 404, 'NOT_FOUND', 'Diagnostic record not found');
}

function requestIdFor(req) {
  const supplied = req.get('x-request-id');
  return supplied && /^[A-Za-z0-9._:-]{1,128}$/.test(supplied)
    ? supplied
    : crypto.randomUUID();
}

router.post('/', manageDiagnosticAccess, async (req, res, next) => {
  const { values, error } = validateCreateInput(req.body);
  if (error) {
    return sendError(res, 400, 'INVALID_DIAGNOSTIC', error);
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
        'INVALID_DIAGNOSTIC',
        'odometerUnit must match the vehicle odometer unit',
      );
    }

    const record = await DiagnosticRecord.create({
      ...values,
      vehicle: vehicle._id,
      owner: req.user.id,
      organization: organizationValue(req),
      status: 'Active',
    });

    return res.status(201).json({
      success: true,
      data: { diagnostic: safeDiagnostic({ ...record.toObject(), vehicle }) },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/', readDiagnosticAccess, async (req, res, next) => {
  let filter = withOrganizationFilter(req);
  if (req.query.vehicleId !== undefined) {
    if (!mongoose.isValidObjectId(req.query.vehicleId)) {
      return sendError(
        res,
        400,
        'INVALID_VEHICLE_ID',
        'Vehicle ID is invalid',
      );
    }
    filter = withOrganizationFilter(req, { vehicle: req.query.vehicleId });
  }

  try {
    const records = await DiagnosticRecord.find(filter)
      .populate('vehicle', 'vehicleName registrationNumber')
      .sort({ dateDetected: -1, createdAt: -1 });
    return res.json({
      success: true,
      data: { diagnostics: records.map(safeDiagnostic) },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/provider-status', readDiagnosticAccess, (req, res) => {
  return res.json({
    success: true,
    data: { provider: diagnosticAnalysisService.providerStatus },
  });
});

router.post('/:id/analyze', manageDiagnosticAccess, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return invalidDiagnosticId(res);
  }

  try {
    const record = await DiagnosticRecord.findOne(
      withOrganizationFilter(req, { _id: req.params.id }),
    ).populate(
      'vehicle',
      'vehicleName registrationNumber make model year vehicleType',
    );
    if (!record) {
      return notFound(res);
    }

    const analysis = await diagnosticAnalysisService.analyzeDiagnostic(
      {
        code: record.code,
        description: record.description,
        source: record.source,
        severity: record.severity,
        status: record.status,
        dateDetected: record.dateDetected,
        odometer: record.odometer,
        odometerUnit: record.odometerUnit,
        notes: record.notes,
        vehicle: record.vehicle
          ? {
              make: record.vehicle.make,
              model: record.vehicle.model,
              year: record.vehicle.year,
              vehicleType: record.vehicle.vehicleType,
            }
          : null,
      },
      { requestId: requestIdFor(req) },
    );

    return res.json({
      success: true,
      data: { analysis },
    });
  } catch (error) {
    if (error?.statusCode && error?.code?.startsWith('AI_')) {
      return sendError(res, error.statusCode, error.code, error.message);
    }
    return next(error);
  }
});

router.get('/:id', readDiagnosticAccess, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return invalidDiagnosticId(res);
  }

  try {
    const record = await DiagnosticRecord.findOne(
      withOrganizationFilter(req, { _id: req.params.id }),
    ).populate('vehicle', 'vehicleName registrationNumber');
    if (!record) {
      return notFound(res);
    }
    return res.json({
      success: true,
      data: { diagnostic: safeDiagnostic(record) },
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', manageDiagnosticAccess, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return invalidDiagnosticId(res);
  }
  if (!isRecord(req.body) || Object.keys(req.body).length !== 1) {
    return sendError(
      res,
      400,
      'INVALID_DIAGNOSTIC',
      'Only the diagnostic status can be updated',
    );
  }
  if (req.body.status !== 'Resolved') {
    return sendError(
      res,
      400,
      'INVALID_DIAGNOSTIC',
      'Only Active diagnostic records can be marked Resolved',
    );
  }

  try {
    const record = await DiagnosticRecord.findOneAndUpdate(
      withOrganizationFilter(req, {
        _id: req.params.id,
        status: 'Active',
      }),
      { $set: { status: 'Resolved' } },
      { new: true, runValidators: true },
    ).populate('vehicle', 'vehicleName registrationNumber');
    if (!record) {
      return notFound(res);
    }
    return res.json({
      success: true,
      data: { diagnostic: safeDiagnostic(record) },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
