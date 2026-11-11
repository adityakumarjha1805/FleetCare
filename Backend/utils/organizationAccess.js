function organizationFilter(req) {
  return req.user.role === 'admin' ? {} : { owner: req.user.id };
}

function withOrganizationFilter(req, filter = {}) {
  return req.user.role === 'admin' ? { ...filter } : { ...filter, owner: req.user.id };
}

function organizationValue(req) {
  return null;
}

module.exports = {
  organizationFilter,
  organizationValue,
  withOrganizationFilter,
};
