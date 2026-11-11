const express = require('express');
const mongoose = require('mongoose');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const DiagnosticRecord = require('../models/DiagnosticRecord');
const Part = require('../models/Part');
const PartsRequest = require('../models/PartsRequest');
const Vehicle = require('../models/Vehicle');
const { ensureSampleParts } = require('../services/partsCatalog');
const {
  createWorkflowNotifications,
  platformRecipients,
} = require('../services/notifications');
const { withOrganizationFilter } = require('../utils/organizationAccess');

const router = express.Router();
const catalogAccess = authorize({
  roles: ['admin', 'user'],
  organization: false,
});
const requestCreateAccess = authorize({
  roles: ['admin', 'user'],
  organization: false,
});
const requestReviewAccess = authorize({ roles: ['admin'], organization: false });

function sendError(res, status, code, message) {
  return res.status(status).json({
    success: false,
    error: { code, message },
  });
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safePart(part) {
  return {
    id: part._id.toString(),
    name: part.name,
    partNumber: part.partNumber,
    category: part.category,
    description: part.description,
    compatibility: part.compatibility,
    stockQuantity: part.stockQuantity,
    availability: part.availability,
    price: part.price,
    isSampleCatalog: part.isSampleCatalog === true,
    createdAt: part.createdAt,
    updatedAt: part.updatedAt,
  };
}

function safeRequest(request) {
  const vehicle =
    request.vehicle && typeof request.vehicle === 'object' && request.vehicle._id
      ? request.vehicle
      : null;

  return {
    id: request._id.toString(),
    organization: request.organization?.toString() || null,
    vehicleId: (vehicle?._id || request.vehicle).toString(),
    vehicleName: vehicle?.vehicleName || 'Vehicle unavailable',
    registrationNumber: vehicle?.registrationNumber || '—',
    requestedParts: request.requestedParts.map((part) => ({
      partId: part.part.toString(),
      name: part.name,
      partNumber: part.partNumber,
      quantity: part.quantity,
    })),
    requestedBy: request.requestedBy.toString(),
    notes: request.notes,
    status: request.status,
    reviewedBy: request.reviewedBy?.toString() || null,
    reviewedAt: request.reviewedAt,
    reviewNotes: request.reviewNotes,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseQuantity(value) {
  return Number.isInteger(value) && value >= 1 && value <= 100;
}

function validateRequestBody(body) {
  if (!isRecord(body)) {
    return { error: 'Request body must be a JSON object' };
  }
  const allowedFields = ['vehicleId', 'requestedParts', 'notes'];
  if (Object.keys(body).some((field) => !allowedFields.includes(field))) {
    return { error: 'Request contains unsupported fields' };
  }
  if (
    typeof body.vehicleId !== 'string' ||
    !mongoose.isValidObjectId(body.vehicleId)
  ) {
    return { error: 'vehicleId must be a valid vehicle ID' };
  }
  if (
    !Array.isArray(body.requestedParts) ||
    body.requestedParts.length < 1 ||
    body.requestedParts.length > 25
  ) {
    return { error: 'requestedParts must contain 1-25 parts' };
  }

  const requestedParts = [];
  const seen = new Set();
  for (const requestedPart of body.requestedParts) {
    if (
      !isRecord(requestedPart) ||
      Object.keys(requestedPart).some(
        (field) => !['partId', 'quantity'].includes(field),
      ) ||
      typeof requestedPart.partId !== 'string' ||
      !mongoose.isValidObjectId(requestedPart.partId) ||
      !parseQuantity(requestedPart.quantity) ||
      seen.has(requestedPart.partId)
    ) {
      return {
        error:
          'Each requested part needs a unique valid partId and quantity from 1 to 100',
      };
    }
    seen.add(requestedPart.partId);
    requestedParts.push({
      partId: requestedPart.partId,
      quantity: requestedPart.quantity,
    });
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
      requestedParts,
      notes: body.notes?.trim() || '',
    },
  };
}

async function findOrganizationVehicle(req, vehicleId) {
  return Vehicle.findOne(withOrganizationFilter(req, { _id: vehicleId }));
}

async function loadRequestedParts(values) {
  const parts = await Part.find({
    _id: { $in: values.requestedParts.map((item) => item.partId) },
  });
  const byId = new Map(parts.map((part) => [part._id.toString(), part]));
  const requestedParts = [];

  for (const requestedPart of values.requestedParts) {
    const part = byId.get(requestedPart.partId);
    if (!part) return null;
    requestedParts.push({
      part: part._id,
      name: part.name,
      partNumber: part.partNumber,
      quantity: requestedPart.quantity,
    });
  }
  return requestedParts;
}

router.use(authenticate);

router.get('/', catalogAccess, async (req, res, next) => {
  try {
    await ensureSampleParts();
    const filter = {};
    if (typeof req.query.q === 'string' && req.query.q.trim()) {
      const search = new RegExp(escapeRegex(req.query.q.trim()), 'i');
      filter.$or = [
        { name: search },
        { partNumber: search },
        { category: search },
      ];
    }
    if (typeof req.query.category === 'string' && req.query.category.trim()) {
      filter.category = req.query.category.trim();
    }

    const parts = await Part.find(filter).sort({ category: 1, name: 1 });
    return res.json({
      success: true,
      data: { parts: parts.map(safePart), sampleCatalog: true },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/requests', catalogAccess, async (req, res, next) => {
  const filter = req.user.role === 'admin' ? {} : { requestedBy: req.user.id };
  if (typeof req.query.status === 'string') {
    filter.status = req.query.status;
  }

  try {
    const requests = await PartsRequest.find(filter)
      .populate('vehicle', 'vehicleName registrationNumber')
      .sort({ createdAt: -1 });
    return res.json({
      success: true,
      data: { requests: requests.map(safeRequest) },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/requests/:id', catalogAccess, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return sendError(res, 400, 'INVALID_PARTS_REQUEST_ID', 'Parts request ID is invalid');
  }
  try {
    const request = await PartsRequest.findOne({
      _id: req.params.id,
      ...(req.user.role === 'admin' ? {} : { requestedBy: req.user.id }),
    }).populate('vehicle', 'vehicleName registrationNumber');
    if (!request) {
      return sendError(res, 404, 'NOT_FOUND', 'Parts request not found');
    }
    return res.json({ success: true, data: { request: safeRequest(request) } });
  } catch (error) {
    return next(error);
  }
});

router.post('/requests', requestCreateAccess, async (req, res, next) => {
  const { values, error } = validateRequestBody(req.body);
  if (error) return sendError(res, 400, 'INVALID_PARTS_REQUEST', error);

  try {
    const vehicle = await findOrganizationVehicle(req, values.vehicleId);
    if (!vehicle) {
      return sendError(res, 404, 'VEHICLE_NOT_FOUND', 'Vehicle not found');
    }
    const requestedParts = await loadRequestedParts(values);
    if (!requestedParts) {
      return sendError(res, 404, 'PART_NOT_FOUND', 'One or more parts were not found');
    }

    const request = await PartsRequest.create({
      organization: null,
      vehicle: vehicle._id,
      requestedParts,
      requestedBy: req.user.id,
      notes: values.notes,
      status: 'Pending',
    });
    const admins = await platformRecipients(['admin'], req.user.id);
    await createWorkflowNotifications({
      recipientIds: admins,
      title: 'New parts request',
      message: `${vehicle.vehicleName} has a new parts request for review.`,
      type: 'parts_request',
      relatedResourceType: 'PartsRequest',
      relatedResourceId: request._id,
      dedupeKey: `parts-request-created:${request._id}`,
    });
    return res.status(201).json({
      success: true,
      data: {
        request: safeRequest({ ...request.toObject(), vehicle }),
        purchase: {
          placed: false,
          message: 'This is an internal request only; no order was placed.',
        },
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get(
  '/recommendations/diagnostics/:id',
  catalogAccess,
  async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return sendError(res, 400, 'INVALID_DIAGNOSTIC_ID', 'Diagnostic ID is invalid');
    }
    try {
      const diagnostic = await DiagnosticRecord.findOne({
        _id: req.params.id,
        ...(req.user.role === 'admin' ? {} : { owner: req.user.id }),
      });
      if (!diagnostic) {
        return sendError(res, 404, 'NOT_FOUND', 'Diagnostic record not found');
      }

      const partNumbers = diagnostic.code === 'P0301'
        ? ['FC-SPARK-IR-01', 'FC-COIL-01', 'FC-FUEL-INJ-01']
        : [];
      await ensureSampleParts();
      const parts = await Part.find({ partNumber: { $in: partNumbers } });
      return res.json({
        success: true,
        data: {
          diagnosticId: diagnostic._id.toString(),
          suggestions: parts.map((part) => ({
            ...safePart(part),
            suggestion: true,
            reason: `Suggested for review based on recorded code ${diagnostic.code}; this does not confirm a failed component.`,
          })),
          disclaimer:
            'Suggestions require qualified inspection. No purchase or supplier order was created.',
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.get('/:id', catalogAccess, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return sendError(res, 400, 'INVALID_PART_ID', 'Part ID is invalid');
  }
  try {
    await ensureSampleParts();
    const part = await Part.findById(req.params.id);
    if (!part) return sendError(res, 404, 'NOT_FOUND', 'Part not found');
    return res.json({ success: true, data: { part: safePart(part) } });
  } catch (error) {
    return next(error);
  }
});

router.patch('/requests/:id', requestReviewAccess, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return sendError(res, 400, 'INVALID_PARTS_REQUEST_ID', 'Parts request ID is invalid');
  }
  if (
    !isRecord(req.body) ||
    Object.keys(req.body).some(
      (field) => !['status', 'reviewNotes'].includes(field),
    ) ||
    !['Approved', 'Rejected', 'Fulfilled'].includes(req.body.status) ||
    (req.body.reviewNotes !== undefined &&
      (typeof req.body.reviewNotes !== 'string' ||
        req.body.reviewNotes.trim().length > 1000))
  ) {
    return sendError(
      res,
      400,
      'INVALID_PARTS_REQUEST_STATUS',
      'A valid status and optional reviewNotes are required',
    );
  }

  try {
    const current = await PartsRequest.findOne({
      _id: req.params.id,
    });
    if (!current) {
      return sendError(res, 404, 'NOT_FOUND', 'Parts request not found');
    }
    const allowed = {
      Pending: ['Approved', 'Rejected'],
      Approved: ['Fulfilled'],
      Rejected: [],
      Fulfilled: [],
    };
    if (!allowed[current.status].includes(req.body.status)) {
      return sendError(
        res,
        400,
        'INVALID_PARTS_REQUEST_STATUS',
        `Cannot transition a ${current.status} request to ${req.body.status}`,
      );
    }

    const updated = await PartsRequest.findOneAndUpdate(
      {
        _id: req.params.id,
        ...(req.user.role === 'admin' ? {} : { requestedBy: req.user.id }),
        status: current.status,
      },
      {
        $set: {
          status: req.body.status,
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
          reviewNotes: req.body.reviewNotes?.trim() || '',
        },
      },
      { new: true, runValidators: true },
    ).populate('vehicle', 'vehicleName registrationNumber');
    if (!updated) {
      return sendError(
        res,
        409,
        'INVALID_PARTS_REQUEST_STATUS',
        'The parts request changed before this update could be applied',
      );
    }
    await createWorkflowNotifications({
      recipientIds: [current.requestedBy],
      title: `Parts request ${req.body.status.toLowerCase()}`,
      message: `Your parts request was ${req.body.status.toLowerCase()}.`,
      type: 'parts_request',
      relatedResourceType: 'PartsRequest',
      relatedResourceId: current._id,
      dedupeKey: `parts-request-${req.body.status.toLowerCase()}:${current._id}`,
    });
    return res.json({ success: true, data: { request: safeRequest(updated) } });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
