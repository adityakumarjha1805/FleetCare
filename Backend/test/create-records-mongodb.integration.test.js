const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { after, before, test } = require('node:test');

const app = require('../app');
const config = require('../config/env');
const DiagnosticRecord = require('../models/DiagnosticRecord');
const MaintenanceRecord = require('../models/MaintenanceRecord');
const ServiceRequest = require('../models/ServiceRequest');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');

let server;
let owner;
let vehicle;
let baseUrl;

function authHeaders() {
  const token = jwt.sign({}, config.jwtSecret, {
    algorithm: 'HS256',
    subject: owner._id.toString(),
    issuer: 'fleetcare-api',
    audience: 'fleetcare-client',
    expiresIn: '10m',
  });
  return { Authorization: `Bearer ${token}` };
}

async function post(path, body) {
  return fetch(`${baseUrl}/api${path}`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

before(async () => {
  await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 10000 });

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  owner = await User.create({
    name: 'FleetCare create integration test',
    email: `create-integration-${suffix}@example.invalid`,
    password: 'TemporaryIntegration123',
  });
  vehicle = await Vehicle.create({
    vehicleName: 'Create integration test vehicle',
    registrationNumber: `T${Date.now().toString().slice(-10)}`,
    make: 'Test',
    model: 'Integration',
    year: 2024,
    vehicleType: 'Van',
    odometer: 12000,
    odometerUnit: 'km',
    owner: owner._id,
  });

  server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (owner) {
    await Promise.all([
      DiagnosticRecord.deleteMany({ owner: owner._id }),
      MaintenanceRecord.deleteMany({ owner: owner._id }),
      ServiceRequest.deleteMany({ owner: owner._id }),
      Vehicle.deleteMany({ owner: owner._id }),
      User.deleteOne({ _id: owner._id }),
    ]);
  }

  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await mongoose.disconnect();
});

test('create endpoints serialize and persist actual Mongoose documents', async () => {
  const futureDate = new Date(Date.now() + 2 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const diagnosticResponse = await post('/diagnostics', {
    vehicleId: vehicle._id.toString(),
    code: 'P0301',
    severity: 'High',
    dateDetected: new Date(Date.now() - 60_000).toISOString(),
    odometer: 12000,
    odometerUnit: 'km',
    source: 'Manual',
  });
  const diagnosticPayload = await diagnosticResponse.json();

  assert.equal(diagnosticResponse.status, 201);
  assert.equal(diagnosticPayload.success, true);
  const diagnostic = diagnosticPayload.data.diagnostic;
  assert.match(diagnostic.id, /^[a-f\d]{24}$/i);
  assert.equal(diagnostic.vehicleId, vehicle._id.toString());
  assert.equal(diagnostic.vehicleName, vehicle.vehicleName);
  assert.equal(diagnostic.code, 'P0301');
  assert.equal(diagnostic.status, 'Active');
  assert.equal(Object.hasOwn(diagnostic, 'owner'), false);
  assert.equal(Object.hasOwn(diagnostic, '__v'), false);
  assert.ok(
    await DiagnosticRecord.findOne({
      _id: diagnostic.id,
      owner: owner._id,
      vehicle: vehicle._id,
    }),
  );

  const maintenanceResponse = await post('/maintenance', {
    vehicleId: vehicle._id.toString(),
    type: 'Oil change',
    description: 'Integration test maintenance',
    maintenanceDate: futureDate,
    odometer: 12000,
    odometerUnit: 'km',
    status: 'Upcoming',
  });
  const maintenancePayload = await maintenanceResponse.json();

  assert.equal(maintenanceResponse.status, 201);
  assert.equal(maintenancePayload.success, true);
  const maintenance = maintenancePayload.data.maintenance;
  assert.match(maintenance.id, /^[a-f\d]{24}$/i);
  assert.equal(maintenance.vehicleId, vehicle._id.toString());
  assert.equal(maintenance.vehicleName, vehicle.vehicleName);
  assert.equal(maintenance.type, 'Oil change');
  assert.equal(maintenance.status, 'Upcoming');
  assert.equal(Object.hasOwn(maintenance, 'owner'), false);
  assert.equal(Object.hasOwn(maintenance, '__v'), false);
  assert.ok(
    await MaintenanceRecord.findOne({
      _id: maintenance.id,
      owner: owner._id,
      vehicle: vehicle._id,
    }),
  );

  const serviceRequestResponse = await post('/service-requests', {
    vehicleId: vehicle._id.toString(),
    serviceType: 'General inspection',
    description: 'Integration test service request',
    priority: 'Low',
    preferredDate: futureDate,
    notes: '',
  });
  const serviceRequestPayload = await serviceRequestResponse.json();

  assert.equal(serviceRequestResponse.status, 201);
  assert.equal(serviceRequestPayload.success, true);
  const request = serviceRequestPayload.data.request;
  assert.match(request.id, /^[a-f\d]{24}$/i);
  assert.match(request.requestId, /^SR-\d{4}-[A-F0-9]{24}$/);
  assert.equal(request.vehicleId, vehicle._id.toString());
  assert.equal(request.vehicleName, vehicle.vehicleName);
  assert.equal(request.serviceType, 'General inspection');
  assert.equal(request.status, 'Pending');
  assert.equal(Object.hasOwn(request, 'owner'), false);
  assert.equal(Object.hasOwn(request, '__v'), false);
  assert.ok(
    await ServiceRequest.findOne({
      _id: request.id,
      owner: owner._id,
      vehicle: vehicle._id,
    }),
  );
});
