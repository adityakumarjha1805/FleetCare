const express = require('express');
const mongoose = require('mongoose');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const ServiceRequest = require('../models/ServiceRequest');

const router = express.Router();
const memberRoles = ['fleet_manager', 'maintenance_staff'];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const maxPageSize = 100;

function sendError(res, status, code, message) {
  return res.status(status).json({
    success: false,
    error: { code, message },
  });
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function validEmail(email) {
  return email.length <= 254 && emailPattern.test(email);
}

function validPassword(password) {
  return (
    typeof password === 'string' &&
    password.length >= 8 &&
    Buffer.byteLength(password, 'utf8') <= 72
  );
}

function safeOrganization(organization) {
  return {
    id: organization._id.toString(),
    name: organization.name,
    slug: organization.slug,
    createdBy: organization.createdBy.toString(),
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
  };
}

function safeMember(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    organization: user.organization
      ? (user.organization._id || user.organization).toString()
      : undefined,
    onboardingCompleted: user.onboardingCompleted !== false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function duplicateKey(error, field) {
  return (
    error &&
    error.code === 11000 &&
    error.keyPattern &&
    error.keyPattern[field] === 1
  );
}

function organizationName(value) {
  return (
    typeof value === 'string' &&
    value.trim() &&
    value.trim().length <= 150 &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function getPage(query) {
  const page = Number.parseInt(query.page || '1', 10);
  const limit = Number.parseInt(query.limit || '25', 10);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > maxPageSize
  ) {
    return null;
  }
  return { page, limit };
}

async function createOrganizationForUser(userId, name) {
  const baseOrganization = new Organization({ name, createdBy: userId });
  const baseSlug = baseOrganization.slug;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const session = await mongoose.startSession();
    try {
      let organization;
      await session.withTransaction(async () => {
        const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
        [organization] = await Organization.create(
          [{ name, slug, createdBy: userId }],
          { session },
        );

        const update = await User.updateOne(
          { _id: userId, organization: null },
          { $set: { organization: organization._id, role: 'organization_admin' } },
          { session },
        );
        if (update.modifiedCount !== 1 && update.nModified !== 1) {
          const error = new Error('User already belongs to an organization');
          error.statusCode = 409;
          error.code = 'ORGANIZATION_ALREADY_ASSIGNED';
          throw error;
        }
      });
      return organization;
    } catch (error) {
      if (!duplicateKey(error, 'slug') || attempt === 2) throw error;
    } finally {
      await session.endSession();
    }
  }

  throw new Error('Unable to create organization');
}

router.use(authenticate);

router.post('/', async (req, res, next) => {
  if (!isRecord(req.body) || !organizationName(req.body.name)) {
    return sendError(
      res,
      400,
      'INVALID_ORGANIZATION',
      'name must be a non-empty string of at most 150 characters',
    );
  }
  if (req.user.organization) {
    return sendError(
      res,
      409,
      'ORGANIZATION_ALREADY_ASSIGNED',
      'You already belong to an organization',
    );
  }

  try {
    const organization = await createOrganizationForUser(
      req.user.id,
      req.body.name.trim(),
    );
    return res.status(201).json({
      success: true,
      data: { organization: safeOrganization(organization) },
    });
  } catch (error) {
    if (error.code === 'ORGANIZATION_ALREADY_ASSIGNED') {
      return sendError(res, 409, error.code, error.message);
    }
    return next(error);
  }
});

router.get('/me', async (req, res, next) => {
  if (!req.user.organization) {
    return sendError(
      res,
      403,
      'ORGANIZATION_REQUIRED',
      'Organization membership is required',
    );
  }

  try {
    const organization = await Organization.findById(req.user.organization);
    if (!organization) {
      return sendError(res, 404, 'ORGANIZATION_NOT_FOUND', 'Organization not found');
    }
    return res.json({
      success: true,
      data: { organization: safeOrganization(organization) },
    });
  } catch (error) {
    return next(error);
  }
});

const adminOnly = authorize({ roles: ['organization_admin'] });

router.get('/dashboard', adminOnly, async (req, res, next) => {
  try {
    const members = await User.find({ organization: req.organizationId }).select(
      '_id role',
    );
    const memberIds = members.map((member) => member._id);
    const [vehicles, pendingServiceRequests] = await Promise.all([
      Vehicle.countDocuments({ owner: { $in: memberIds } }),
      ServiceRequest.countDocuments({
        owner: { $in: memberIds },
        status: 'Pending',
      }),
    ]);

    return res.json({
      success: true,
      data: {
        members: members.length,
        fleetManagers: members.filter((member) => member.role === 'fleet_manager')
          .length,
        maintenanceStaff: members.filter(
          (member) => member.role === 'maintenance_staff',
        ).length,
        vehicles,
        pendingServiceRequests,
        activity: [],
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/members', adminOnly, async (req, res, next) => {
  const page = getPage(req.query);
  if (!page) {
    return sendError(res, 400, 'INVALID_PAGINATION', 'page and limit are invalid');
  }

  try {
    const filter = { organization: req.organizationId };
    const [members, total] = await Promise.all([
      User.find(filter)
        .select('name email role organization onboardingCompleted createdAt updatedAt')
        .sort({ createdAt: 1 })
        .skip((page.page - 1) * page.limit)
        .limit(page.limit),
      User.countDocuments(filter),
    ]);
    return res.json({
      success: true,
      data: {
        members: members.map(safeMember),
        pagination: {
          page: page.page,
          limit: page.limit,
          total,
          pages: Math.ceil(total / page.limit),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/members', adminOnly, async (req, res, next) => {
  if (
    !isRecord(req.body) ||
    typeof req.body.name !== 'string' ||
    !req.body.name.trim() ||
    req.body.name.trim().length > 100 ||
    !validEmail(normalizeEmail(req.body.email)) ||
    !memberRoles.includes(req.body.role) ||
    !validPassword(req.body.password)
  ) {
    return sendError(
      res,
      400,
      'INVALID_MEMBER',
      'Provide name, email, password, and a valid member role',
    );
  }

  const email = normalizeEmail(req.body.email);
  try {
    const existingUser = await User.findOne({ email }).select('_id organization');
    if (existingUser) {
      return sendError(
        res,
        409,
        'EMAIL_ALREADY_REGISTERED',
        'Account already exists. Use a separate account or update its membership.',
      );
    }

    const member = await User.create({
      name: req.body.name.trim(),
      email,
      password: req.body.password,
      role: req.body.role,
      organization: req.organizationId,
      onboardingCompleted: false,
    });
    return res.status(201).json({
      success: true,
      data: {
        member: safeMember(member),
        invitation: {
          sent: false,
          message: 'No email service is configured; the account was created directly.',
        },
      },
    });
  } catch (error) {
    if (duplicateKey(error, 'email')) {
      return sendError(
        res,
        409,
        'EMAIL_ALREADY_REGISTERED',
        'Account already exists. Use a separate account or update its membership.',
      );
    }
    return next(error);
  }
});

router.patch('/members/:id', adminOnly, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return sendError(res, 400, 'INVALID_MEMBER_ID', 'Member ID is invalid');
  }
  if (
    !isRecord(req.body) ||
    Object.keys(req.body).length !== 1 ||
    !memberRoles.includes(req.body.role)
  ) {
    return sendError(
      res,
      400,
      'INVALID_MEMBER',
      'Only fleet_manager or maintenance_staff may be assigned',
    );
  }
  if (req.params.id === req.user.id) {
    return sendError(res, 403, 'SELF_ROLE_CHANGE_FORBIDDEN', 'You cannot change your own role');
  }

  try {
    const member = await User.findOneAndUpdate(
      { _id: req.params.id, organization: req.organizationId },
      { $set: { role: req.body.role } },
      { new: true, runValidators: true },
    );
    if (!member) {
      return sendError(res, 404, 'MEMBER_NOT_FOUND', 'Member not found');
    }
    return res.json({ success: true, data: { member: safeMember(member) } });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
