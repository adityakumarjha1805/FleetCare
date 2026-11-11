const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { after, before, test } = require('node:test');

process.env.JWT_SECRET = 'fleetcare-platform-admin-tests-secret-32';

const app = require('../app');
const config = require('../config/env');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const DiagnosticRecord = require('../models/DiagnosticRecord');
const MaintenanceRecord = require('../models/MaintenanceRecord');
const ServiceRequest = require('../models/ServiceRequest');
const PartsRequest = require('../models/PartsRequest');
const Notification = require('../models/Notification');

const admin = { _id: new mongoose.Types.ObjectId(), role: 'admin', name: 'Admin', email: 'admin@example.test' };
const user = { _id: new mongoose.Types.ObjectId(), role: 'user', name: 'User', email: 'user@example.test' };
const originals = {};
let server;
let baseUrl;

function headers(subject) {
  const token = jwt.sign({}, config.jwtSecret, {
    algorithm: 'HS256',
    subject: subject.toString(),
    issuer: 'fleetcare-api',
    audience: 'fleetcare-client',
  });
  return { Authorization: `Bearer ${token}` };
}

before(async () => {
  originals.userFindById = User.findById;
  originals.userFind = User.find;
  originals.userCountDocuments = User.countDocuments;
  originals.userFindByIdAndUpdate = User.findByIdAndUpdate;
  originals.vehicleCountDocuments = Vehicle.countDocuments;
  originals.diagnosticCountDocuments = DiagnosticRecord.countDocuments;
  originals.maintenanceCountDocuments = MaintenanceRecord.countDocuments;
  originals.serviceCountDocuments = ServiceRequest.countDocuments;
  originals.partsCountDocuments = PartsRequest.countDocuments;
  originals.notificationCountDocuments = Notification.countDocuments;
  User.findById = async (id) => (id.toString() === admin._id.toString() ? admin : user);
  User.countDocuments = async (filter = {}) => (filter.role === 'admin' ? 1 : 2);
  User.find = () => ({
    select: () => ({ sort: () => ({ limit: async () => [admin, user] }) }),
  });
  User.findByIdAndUpdate = async (id, update) => ({
    _id: id,
    name: user.name,
    email: user.email,
    role: update.$set.role,
    createdAt: new Date(),
  });
  for (const Model of [Vehicle, DiagnosticRecord, MaintenanceRecord, ServiceRequest, PartsRequest, Notification]) {
    Model.countDocuments = async () => 1;
    Model.find = () => ({ sort: () => ({ limit: async () => [] }) });
  }
  server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  User.findById = originals.userFindById;
  User.find = originals.userFind;
  User.countDocuments = originals.userCountDocuments;
  User.findByIdAndUpdate = originals.userFindByIdAndUpdate;
  Vehicle.countDocuments = originals.vehicleCountDocuments;
  DiagnosticRecord.countDocuments = originals.diagnosticCountDocuments;
  MaintenanceRecord.countDocuments = originals.maintenanceCountDocuments;
  ServiceRequest.countDocuments = originals.serviceCountDocuments;
  PartsRequest.countDocuments = originals.partsCountDocuments;
  Notification.countDocuments = originals.notificationCountDocuments;
  await new Promise((resolve) => server.close(resolve));
});

test('admin can access global platform summary and change a user role', async () => {
  const summary = await fetch(`${baseUrl}/api/admin/summary`, { headers: headers(admin._id) });
  const summaryBody = await summary.json();
  assert.equal(summary.status, 200);
  assert.equal(summaryBody.data.users, 2);
  assert.equal(summaryBody.data.vehicles, 1);

  const roleResponse = await fetch(`${baseUrl}/api/admin/users/${user._id}/role`, {
    method: 'PATCH',
    headers: { ...headers(admin._id), 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'admin' }),
  });
  assert.equal(roleResponse.status, 200);
});

test('normal users cannot access admin APIs', async () => {
  const response = await fetch(`${baseUrl}/api/admin/summary`, { headers: headers(user._id) });
  const body = await response.json();
  assert.equal(response.status, 403);
  assert.equal(body.error.code, 'INSUFFICIENT_ROLE');
});

test('admins cannot remove their own admin access', async () => {
  const response = await fetch(`${baseUrl}/api/admin/users/${admin._id}/role`, {
    method: 'PATCH',
    headers: { ...headers(admin._id), 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'user' }),
  });
  assert.equal(response.status, 403);
});
