function sendAuthorizationError(res, status, code, message) {
  return res.status(status).json({
    success: false,
    error: { code, message },
  });
}

function requireRole(...allowedRoles) {
  const roles = allowedRoles.flat();

  return (req, res, next) => {
    if (!req.user) {
      return sendAuthorizationError(
        res,
        401,
        'UNAUTHORIZED',
        'Authentication is required',
      );
    }

    const compatibleRole =
      req.user.role === 'organization_admin' ||
      req.user.role === 'fleet_manager' ||
      req.user.role === 'maintenance_staff'
        ? 'user'
        : req.user.role;
    if (!roles.includes(req.user.role) && !roles.includes(compatibleRole)) {
      return sendAuthorizationError(
        res,
        403,
        'INSUFFICIENT_ROLE',
        'You do not have permission to perform this action',
      );
    }

    return next();
  };
}

function requireOperationalRole(...allowedRoles) {
  const roles = allowedRoles.flat();

  return (req, res, next) => {
    if (!req.user) {
      return sendAuthorizationError(res, 401, 'UNAUTHORIZED', 'Authentication is required');
    }
    if (
      req.user.role === 'admin' ||
      roles.length === 0 ||
      roles.includes('user') ||
      ['organization_admin', 'fleet_manager', 'maintenance_staff'].includes(req.user.role)
    ) {
      return next();
    }
    return sendAuthorizationError(
      res,
      403,
      'INSUFFICIENT_ROLE',
      'You do not have permission to perform this action',
    );
  };
}

function authorize({ roles = [], organization = true } = {}) {
  const roleCheck = roles.length ? requireRole(roles) : (req, res, next) => next();
  return (req, res, next) => {
    if (organization && req.user?.organization) {
      req.organizationId = req.user.organization;
    }
    return roleCheck(req, res, next);
  };
}

module.exports = {
  authorize,
  requireOrganization: (req, res, next) => next(),
  requireOrganizationMembership: (req, res, next) => next(),
  requireRole,
  requireRoles: requireRole,
  requireOperationalRole,
};
