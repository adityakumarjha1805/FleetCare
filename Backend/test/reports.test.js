const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { after, before, test } = require('node:test');

process.env.JWT_SECRET = 'fleetcare-reports-tests-use-a-32-byte-secret';

const app = require('../app');
const config = require('../config/env');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const DiagnosticRecord = require('../models/DiagnosticRecord');
const MaintenanceRecord = require('../models/MaintenanceRecord');
const ServiceRequest = require('../models/ServiceRequest');
const PartsRequest = require('../models/PartsRequest');

const organizationA = new mongoose.Types.ObjectId();
const organizationB = new mongoose.Types.ObjectId();
const users = new Map();
const originals = {};
let server;
let baseUrl;

function makeUser(role, organization) {
  const user = {
    _id: new mongoose.Types.ObjectId(),
    name: role,
    email: `${role}-${organization}@example.test`,
    role,
    organization,
  };
  users.set(user._id.toString(), user);
  return user;
}

function query(value) {
  return { then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } };
}

function authHeaders(user) {
  const token = jwt.sign({}, config.jwtSecret, {
    algorithm: 'HS256',
    subject: user._id.toString(),
    issuer: 'fleetcare-api',
    audience: 'fleetcare-client',
  });
  return { Authorization: ['Bearer', token].join(' ') };
}

async function request(path, user) {
  return fetch(`${baseUrl}/api${path}`, { headers: authHeaders(user) });
}

before(async () => {
  const admin = makeUser('admin', organizationA);
  const manager = makeUser('user', organizationA);
  const staff = makeUser('user', organizationA);
  const other = makeUser('user', organizationB);
  User.findById = async (id) => users.get(id.toString()) || null;

  originals.vehicleCountDocuments = Vehicle.countDocuments;
  originals.vehicleAggregate = Vehicle.aggregate;
  originals.diagnosticCountDocuments = DiagnosticRecord.countDocuments;
  originals.diagnosticAggregate = DiagnosticRecord.aggregate;
  originals.maintenanceCountDocuments = MaintenanceRecord.countDocuments;
  originals.maintenanceAggregate = MaintenanceRecord.aggregate;
  originals.serviceCountDocuments = ServiceRequest.countDocuments;
  originals.serviceAggregate = ServiceRequest.aggregate;
  originals.partsCountDocuments = PartsRequest.countDocuments;
  originals.partsAggregate = PartsRequest.aggregate;
  originals.userFindById = User.findById;

  Vehicle.countDocuments = async (filter) => filter.owner?.toString() === manager._id.toString() ? 3 : 0;
  Vehicle.aggregate = () => query([
    { _id: 'Healthy', count: 2 },
    { _id: 'Critical', count: 1 },
  ]);
  DiagnosticRecord.countDocuments = async () => 4;
  DiagnosticRecord.aggregate = (pipeline) =>
    query(pipeline[1]?.$group?._id?.severity
      ? [{ _id: 'High', count: 2 }, { _id: 'Low', count: 2 }]
      : []);
  MaintenanceRecord.countDocuments = async () => 5;
  MaintenanceRecord.aggregate = (pipeline) =>
    query(pipeline[1]?.$group?._id?.status
      ? [{ _id: 'Completed', count: 3 }, { _id: 'Upcoming', count: 2 }]
      : [{ _id: { year: 2026, month: 11 }, count: 5, completed: 3 }]);
  ServiceRequest.countDocuments = async () => 2;
  ServiceRequest.aggregate = () => query([{ _id: 'Pending', count: 2 }]);
  PartsRequest.countDocuments = async () => 1;
  PartsRequest.aggregate = () => query([{ _id: 'Approved', count: 1 }]);

  server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  users.admin = admin;
  users.manager = manager;
  users.staff = staff;
  users.other = other;
});

after(async () => {
  User.findById = originals.userFindById;
  Vehicle.countDocuments = originals.vehicleCountDocuments;
  Vehicle.aggregate = originals.vehicleAggregate;
  DiagnosticRecord.countDocuments = originals.diagnosticCountDocuments;
  DiagnosticRecord.aggregate = originals.diagnosticAggregate;
  MaintenanceRecord.countDocuments = originals.maintenanceCountDocuments;
  MaintenanceRecord.aggregate = originals.maintenanceAggregate;
  ServiceRequest.countDocuments = originals.serviceCountDocuments;
  ServiceRequest.aggregate = originals.serviceAggregate;
  PartsRequest.countDocuments = originals.partsCountDocuments;
  PartsRequest.aggregate = originals.partsAggregate;
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test('returns owner-scoped report metrics for normal users', async () => {
  const response = await request('/reports/summary?from=2026-01-01&to=2026-11-30', users.manager);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.data.vehicles.total, 3);
  assert.deepEqual(body.data.vehicles.status[0], { label: 'Healthy', count: 2 });
  assert.equal(body.data.maintenance.trend[0].completed, 3);
  assert.equal(body.data.partsRequests.costs.available, false);

  const staffResponse = await request('/reports/summary', users.staff);
  assert.equal(staffResponse.status, 200);
});

test('rejects invalid date ranges and allows users without legacy organization data', async () => {
  const invalid = await request('/reports/summary?from=2026-12-01&to=2026-01-01', users.admin);
  assert.equal(invalid.status, 400);

  const unaffiliated = makeUser('user', null);
  const forbidden = await request('/reports/summary', unaffiliated);
  assert.equal(forbidden.status, 200);
});

test('uses authenticated owner identity in user aggregation queries', async () => {
  let observed;
  Vehicle.countDocuments = async (filter) => {
    observed = filter.owner.toString();
    return 0;
  };
  const response = await request('/reports/summary', users.other);
  assert.equal(response.status, 200);
  assert.equal(observed, users.other._id.toString());
});
