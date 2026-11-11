const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { test } = require('node:test');
const { organizationFilter, withOrganizationFilter } = require('../utils/organizationAccess');

const userId = new mongoose.Types.ObjectId().toString();

test('normal users receive owner-only filters', () => {
  const req = { user: { id: userId }, query: { organizationId: 'ignored' } };
  assert.deepEqual(organizationFilter(req), { owner: userId });
  assert.deepEqual(withOrganizationFilter(req, { _id: 'record-id' }), {
    _id: 'record-id',
    owner: userId,
  });
});

test('admins receive global filters', () => {
  assert.deepEqual(organizationFilter({ user: { id: userId, role: 'admin' } }), {});
});
