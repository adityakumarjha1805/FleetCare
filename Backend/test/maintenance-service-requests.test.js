const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { after, before, beforeEach, test } = require('node:test');

process.env.JWT_SECRET = 'fleetcare-maintenance-tests-use-a-32-byte-secret';

const app = require('../app');
const config = require('../config/env');
const MaintenanceRecord = require('../models/MaintenanceRecord');
const ServiceRequest = require('../models/ServiceRequest');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');

const users = new Map();
const vehicles = new Map();
const maintenance = new Map();
const requests = new Map();
const originals = {
  userFindById: User.findById,
  vehicleFindOne: Vehicle.findOne,
  maintenanceCreate: MaintenanceRecord.create,
  maintenanceFind: MaintenanceRecord.find,
  maintenanceFindOne: MaintenanceRecord.findOne,
  maintenanceFindOneAndUpdate: MaintenanceRecord.findOneAndUpdate,
  requestCreate: ServiceRequest.create,
  requestFind: ServiceRequest.find,
  requestFindOne: ServiceRequest.findOne,
  requestFindOneAndUpdate: ServiceRequest.findOneAndUpdate,
  requestFindOneAndDelete: ServiceRequest.findOneAndDelete,
};
const ownerA = new mongoose.Types.ObjectId();
const ownerB = new mongoose.Types.ObjectId();
let ownVehicle;
let otherVehicle;
let server;
let baseUrl;

function makeUser(id) {
  return {
    _id: id,
    name: 'Fleet Manager',
    email: `${id}@example.com`,
    role: 'user',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function matches(document, filter) {
  return Object.entries(filter).every(([key, value]) => {
    const current = document[key];
    if (value && typeof value === 'object' && Array.isArray(value.$in)) {
      return value.$in.includes(current);
    }
    return current && value
      ? current.toString() === value.toString()
      : current === value;
  });
}

function populated(record) {
  if (!record) return null;
  const vehicle = vehicles.get(record.vehicle.toString());
  return { ...record, vehicle: vehicle || record.vehicle };
}

function makeQuery(value) {
  return {
    populate() {
      return this;
    },
    sort() {
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
}

function authHeaders(ownerId = ownerA) {
  const token = jwt.sign({}, config.jwtSecret, {
    algorithm: 'HS256',
    subject: ownerId.toString(),
    issuer: 'fleetcare-api',
    audience: 'fleetcare-client',
    expiresIn: '1h',
  });
  return { Authorization: `Bearer ${token}` };
}

async function request(path, { method = 'GET', body, headers = authHeaders() } = {}) {
  return fetch(`${baseUrl}/api${path}`, {
    method,
    headers: {
      ...headers,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function dateOffset(days) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function validMaintenance(overrides = {}) {
  return {
    vehicleId: ownVehicle._id.toString(),
    type: 'Oil change',
    description: 'Replace engine oil and inspect fluid levels.',
    maintenanceDate: dateOffset(1),
    odometer: 12000,
    odometerUnit: 'km',
    status: 'Upcoming',
    ...overrides,
  };
}

function validRequest(overrides = {}) {
  return {
    vehicleId: ownVehicle._id.toString(),
    serviceType: 'General inspection',
    description: 'Inspect the warning indicator.',
    priority: 'High',
    preferredDate: dateOffset(1),
    notes: 'Driver reported an intermittent warning.',
    ...overrides,
  };
}

before(async () => {
  users.set(ownerA.toString(), makeUser(ownerA));
  users.set(ownerB.toString(), makeUser(ownerB));
  User.findById = async (id) => users.get(id) || null;

  ownVehicle = {
    _id: new mongoose.Types.ObjectId(),
    owner: ownerA,
    vehicleName: 'Owner A Truck',
    registrationNumber: 'OWNERA1',
    odometerUnit: 'km',
  };
  otherVehicle = {
    _id: new mongoose.Types.ObjectId(),
    owner: ownerB,
    vehicleName: 'Owner B Van',
    registrationNumber: 'OWNERB1',
    odometerUnit: 'miles',
  };
  vehicles.set(ownVehicle._id.toString(), ownVehicle);
  vehicles.set(otherVehicle._id.toString(), otherVehicle);
  Vehicle.findOne = async (filter) =>
    [...vehicles.values()].find((vehicle) => matches(vehicle, filter)) || null;

  MaintenanceRecord.create = async (fields) => {
    const record = new MaintenanceRecord({
      ...fields,
      _id: new mongoose.Types.ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    maintenance.set(record._id.toString(), record.toObject());
    return record;
  };
  MaintenanceRecord.find = (filter) =>
    makeQuery(
      [...maintenance.values()]
        .filter((record) => matches(record, filter))
        .map(populated),
    );
  MaintenanceRecord.findOne = (filter) =>
    makeQuery(populated([...maintenance.values()].find((record) => matches(record, filter))));
  MaintenanceRecord.findOneAndUpdate = (filter, update) => {
    const record = [...maintenance.values()].find((item) => matches(item, filter));
    if (record) {
      Object.assign(record, update.$set, { updatedAt: new Date() });
    }
    return makeQuery(populated(record));
  };

  ServiceRequest.create = async (fields) => {
    const record = new ServiceRequest({
      ...fields,
      _id: new mongoose.Types.ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    requests.set(record._id.toString(), record.toObject());
    return record;
  };
  ServiceRequest.find = (filter) =>
    makeQuery(
      [...requests.values()]
        .filter((record) => matches(record, filter))
        .map(populated),
    );
  ServiceRequest.findOne = (filter) =>
    makeQuery(populated([...requests.values()].find((record) => matches(record, filter))));
  ServiceRequest.findOneAndUpdate = (filter, update) => {
    const record = [...requests.values()].find((item) => matches(item, filter));
    if (record) {
      Object.assign(record, update.$set, { updatedAt: new Date() });
    }
    return makeQuery(populated(record));
  };
  ServiceRequest.findOneAndDelete = (filter) => {
    const record = [...requests.values()].find((item) => matches(item, filter));
    if (record) requests.delete(record._id.toString());
    return makeQuery(populated(record));
  };

  server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  maintenance.clear();
  requests.clear();
});

after(async () => {
  User.findById = originals.userFindById;
  Vehicle.findOne = originals.vehicleFindOne;
  MaintenanceRecord.create = originals.maintenanceCreate;
  MaintenanceRecord.find = originals.maintenanceFind;
  MaintenanceRecord.findOne = originals.maintenanceFindOne;
  MaintenanceRecord.findOneAndUpdate = originals.maintenanceFindOneAndUpdate;
  ServiceRequest.create = originals.requestCreate;
  ServiceRequest.find = originals.requestFind;
  ServiceRequest.findOne = originals.requestFindOne;
  ServiceRequest.findOneAndUpdate = originals.requestFindOneAndUpdate;
  ServiceRequest.findOneAndDelete = originals.requestFindOneAndDelete;

  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('creates and lists owner-scoped maintenance records', async () => {
  const created = await request('/maintenance', {
    method: 'POST',
    body: validMaintenance(),
  });
  const record = (await created.json()).data.maintenance;
  const listed = await request('/maintenance');
  const otherList = await request('/maintenance', {
    headers: authHeaders(ownerB),
  });

  assert.equal(created.status, 201);
  assert.equal(record.status, 'Upcoming');
  assert.equal(record.vehicleName, ownVehicle.vehicleName);
  assert.equal(Object.hasOwn(record, 'owner'), false);
  assert.equal((await listed.json()).data.maintenance.length, 1);
  assert.deepEqual((await otherList.json()).data.maintenance, []);
  assert.equal(maintenance.get(record.id).owner.toString(), ownerA.toString());
});

test('validates maintenance dates, odometer, status, and vehicle ownership', async () => {
  const invalidRecords = [
    { vehicleId: ownVehicle._id.toString() },
    validMaintenance({ maintenanceDate: '2025-02-31' }),
    validMaintenance({ odometer: -1 }),
    validMaintenance({ odometer: 2.5 }),
    validMaintenance({ odometer: 2_000_001 }),
    validMaintenance({ odometerUnit: 'miles' }),
    validMaintenance({ status: 'Completed', maintenanceDate: dateOffset(1) }),
    validMaintenance({ status: 'Overdue', maintenanceDate: dateOffset(1) }),
    validMaintenance({ owner: ownerB.toString() }),
  ];

  for (const body of invalidRecords) {
    const response = await request('/maintenance', {
      method: 'POST',
      body,
    });
    assert.equal(response.status, 400, JSON.stringify(body));
  }

  const otherOwnerVehicle = await request('/maintenance', {
    method: 'POST',
    body: validMaintenance({ vehicleId: otherVehicle._id.toString() }),
  });
  assert.equal(otherOwnerVehicle.status, 404);
  assert.equal(maintenance.size, 0);
});

test('maintenance can transition to completed only for its owner', async () => {
  const created = await request('/maintenance', {
    method: 'POST',
    body: validMaintenance(),
  });
  const record = (await created.json()).data.maintenance;
  const denied = await request(`/maintenance/${record.id}`, {
    method: 'PATCH',
    headers: authHeaders(ownerB),
    body: { status: 'Completed' },
  });
  const completed = await request(`/maintenance/${record.id}`, {
    method: 'PATCH',
    body: { status: 'Completed' },
  });
  const completedBody = await completed.json();

  assert.equal(denied.status, 404);
  assert.equal(completed.status, 200);
  assert.equal(completedBody.data.maintenance.status, 'Completed');
  assert.ok(completedBody.data.maintenance.completedAt);
  assert.equal(maintenance.get(record.id).status, 'Completed');

  const repeated = await request(`/maintenance/${record.id}`, {
    method: 'PATCH',
    body: { status: 'Completed' },
  });
  assert.equal(repeated.status, 404);
});

test('creates and lists persisted owner-scoped service requests', async () => {
  const created = await request('/service-requests', {
    method: 'POST',
    body: validRequest(),
  });
  const record = (await created.json()).data.request;
  const listed = await request('/service-requests');
  const otherList = await request('/service-requests', {
    headers: authHeaders(ownerB),
  });

  assert.equal(created.status, 201);
  assert.match(record.requestId, /^SR-\d{4}-[A-F0-9]{24}$/);
  assert.equal(record.status, 'Pending');
  assert.equal(record.vehicleName, ownVehicle.vehicleName);
  assert.equal(Object.hasOwn(record, 'owner'), false);
  assert.equal((await listed.json()).data.requests.length, 1);
  assert.deepEqual((await otherList.json()).data.requests, []);
  assert.equal(requests.get(record.id).owner.toString(), ownerA.toString());
});

test('validates service request data and vehicle ownership', async () => {
  const invalidRequests = [
    { vehicleId: ownVehicle._id.toString() },
    validRequest({ serviceType: 'Unsupported' }),
    validRequest({ priority: 'Urgent' }),
    validRequest({ description: ' ' }),
    validRequest({ preferredDate: dateOffset(-1) }),
    validRequest({ preferredDate: '2025-02-31' }),
    validRequest({ notes: 'x'.repeat(1001) }),
    validRequest({ status: 'Approved' }),
  ];

  for (const body of invalidRequests) {
    const response = await request('/service-requests', {
      method: 'POST',
      body,
    });
    assert.equal(response.status, 400, JSON.stringify(body));
  }

  const otherOwnerVehicle = await request('/service-requests', {
    method: 'POST',
    body: validRequest({ vehicleId: otherVehicle._id.toString() }),
  });
  assert.equal(otherOwnerVehicle.status, 404);
  assert.equal(requests.size, 0);
});

test('only pending service requests can be edited', async () => {
  const created = await request('/service-requests', {
    method: 'POST',
    body: validRequest(),
  });
  const record = (await created.json()).data.request;
  const updated = await request(`/service-requests/${record.id}`, {
    method: 'PUT',
    body: validRequest({
      serviceType: 'Oil change',
      preferredDate: dateOffset(2),
    }),
  });
  const updatedBody = await updated.json();

  assert.equal(updated.status, 200);
  assert.equal(updatedBody.data.request.serviceType, 'Oil change');
  assert.equal(updatedBody.data.request.status, 'Pending');

  const transition = await request(`/service-requests/${record.id}`, {
    method: 'PATCH',
    body: { status: 'Approved' },
  });
  const editAfterApproval = await request(`/service-requests/${record.id}`, {
    method: 'PUT',
    body: validRequest(),
  });
  assert.equal(transition.status, 200);
  assert.equal(editAfterApproval.status, 404);
});

test('enforces service request status transitions', async () => {
  const created = await request('/service-requests', {
    method: 'POST',
    body: validRequest(),
  });
  const record = (await created.json()).data.request;
  const invalid = await request(`/service-requests/${record.id}`, {
    method: 'PATCH',
    body: { status: 'Completed' },
  });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error.code, 'INVALID_STATUS_TRANSITION');

  for (const status of ['Approved', 'In Progress', 'Completed']) {
    const response = await request(`/service-requests/${record.id}`, {
      method: 'PATCH',
      body: { status },
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.request.status, status);
  }
});

test('restricts service request reads and cancellation to the owner and pending state', async () => {
  const created = await request('/service-requests', {
    method: 'POST',
    body: validRequest(),
  });
  const record = (await created.json()).data.request;
  const otherRead = await request(`/service-requests/${record.id}`, {
    headers: authHeaders(ownerB),
  });
  const otherDelete = await request(`/service-requests/${record.id}`, {
    method: 'DELETE',
    headers: authHeaders(ownerB),
  });
  const deleted = await request(`/service-requests/${record.id}`, {
    method: 'DELETE',
  });

  assert.equal(otherRead.status, 404);
  assert.equal(otherDelete.status, 404);
  assert.equal(deleted.status, 200);
  assert.equal((await deleted.json()).data.request.id, record.id);
  assert.equal(requests.has(record.id), false);

  const second = await request('/service-requests', {
    method: 'POST',
    body: validRequest(),
  });
  const approvedRecord = (await second.json()).data.request;
  await request(`/service-requests/${approvedRecord.id}`, {
    method: 'PATCH',
    body: { status: 'Approved' },
  });
  const cannotDeleteApproved = await request(
    `/service-requests/${approvedRecord.id}`,
    { method: 'DELETE' },
  );
  assert.equal(cannotDeleteApproved.status, 404);
});

test('rejects missing tokens and malformed maintenance or request IDs', async () => {
  const missingToken = await request('/maintenance', { headers: {} });
  const invalidMaintenanceId = await request('/maintenance/not-an-id');
  const invalidRequestId = await request('/service-requests/not-an-id');

  assert.equal(missingToken.status, 401);
  assert.equal(invalidMaintenanceId.status, 400);
  assert.equal(invalidRequestId.status, 400);
});
