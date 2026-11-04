const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { after, before, beforeEach, test } = require('node:test');

process.env.JWT_SECRET = 'fleetcare-diagnostic-tests-use-a-32-byte-secret';

const app = require('../app');
const config = require('../config/env');
const DiagnosticRecord = require('../models/DiagnosticRecord');
const { createDiagnosticAnalysisService } = require('../services/diagnosticAnalysisService');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');

const users = new Map();
const vehicles = new Map();
const records = new Map();
const originals = {
  userFindById: User.findById,
  vehicleFindOne: Vehicle.findOne,
  diagnosticCreate: DiagnosticRecord.create,
  diagnosticFind: DiagnosticRecord.find,
  diagnosticFindOne: DiagnosticRecord.findOne,
  diagnosticFindOneAndUpdate: DiagnosticRecord.findOneAndUpdate,
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
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function matches(document, filter) {
  return Object.entries(filter).every(([key, value]) => {
    const current = document[key];
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
  return fetch(`${baseUrl}/api/diagnostics${path}`, {
    method,
    headers: {
      ...headers,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function validDiagnostic(overrides = {}) {
  return {
    vehicleId: ownVehicle._id.toString(),
    code: 'p0301',
    severity: 'High',
    dateDetected: new Date(Date.now() - 60_000).toISOString(),
    odometer: 12000,
    odometerUnit: 'km',
    source: 'Manual',
    notes: 'Driver reported a warning light.',
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

  DiagnosticRecord.create = async (fields) => {
    const record = new DiagnosticRecord({
      ...fields,
      _id: new mongoose.Types.ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    records.set(record._id.toString(), record.toObject());
    return record;
  };
  DiagnosticRecord.find = (filter) => {
    const found = [...records.values()]
      .filter((record) => matches(record, filter))
      .sort((a, b) => b.dateDetected - a.dateDetected)
      .map(populated);
    return makeQuery(found);
  };
  DiagnosticRecord.findOne = (filter) =>
    makeQuery(populated([...records.values()].find((record) => matches(record, filter))));
  DiagnosticRecord.findOneAndUpdate = (filter, update) => {
    const record = [...records.values()].find((item) => matches(item, filter));
    if (record) {
      Object.assign(record, update.$set, { updatedAt: new Date() });
    }
    return makeQuery(populated(record));
  };

  server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  records.clear();
});

after(async () => {
  User.findById = originals.userFindById;
  Vehicle.findOne = originals.vehicleFindOne;
  DiagnosticRecord.create = originals.diagnosticCreate;
  DiagnosticRecord.find = originals.diagnosticFind;
  DiagnosticRecord.findOne = originals.diagnosticFindOne;
  DiagnosticRecord.findOneAndUpdate = originals.diagnosticFindOneAndUpdate;

  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('creates and retrieves an owner-scoped diagnostic record', async () => {
  const created = await request('', {
    method: 'POST',
    body: validDiagnostic(),
  });
  const createdBody = await created.json();
  const record = createdBody.data.diagnostic;
  const listed = await request('');
  const listedBody = await listed.json();

  assert.equal(created.status, 201);
  assert.equal(record.code, 'P0301');
  assert.equal(record.status, 'Active');
  assert.equal(record.vehicleId, ownVehicle._id.toString());
  assert.equal(record.vehicleName, ownVehicle.vehicleName);
  assert.equal(record.odometerUnit, 'km');
  assert.equal(Object.hasOwn(record, 'owner'), false);
  assert.equal(listed.status, 200);
  assert.deepEqual(
    listedBody.data.diagnostics.map((item) => item.id),
    [record.id],
  );
  assert.equal(records.get(record.id).owner.toString(), ownerA.toString());
});

test('rejects missing and malformed diagnostic fields', async () => {
  const invalidBodies = [
    { vehicleId: ownVehicle._id.toString() },
    validDiagnostic({ code: 'not-a-dtc' }),
    validDiagnostic({ odometer: -1 }),
    validDiagnostic({ odometer: 12.5 }),
    validDiagnostic({ odometer: 2_000_001 }),
    validDiagnostic({ severity: 'Unknown' }),
    validDiagnostic({ dateDetected: 'not-a-date' }),
    validDiagnostic({ dateDetected: '2025-02-31T12:00:00.000Z' }),
    validDiagnostic({ dateDetected: '2999-01-01T00:00:00.000Z' }),
    validDiagnostic({ source: 'Unsupported' }),
    validDiagnostic({ notes: 'x'.repeat(1001) }),
    validDiagnostic({ owner: ownerB.toString() }),
  ];

  for (const body of invalidBodies) {
    const response = await request('', { method: 'POST', body });
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal((await response.json()).error.code, 'INVALID_DIAGNOSTIC');
  }
});

test('does not allow recording against another user’s vehicle or mismatched units', async () => {
  const otherOwnerVehicle = await request('', {
    method: 'POST',
    body: validDiagnostic({ vehicleId: otherVehicle._id.toString() }),
  });
  const wrongUnit = await request('', {
    method: 'POST',
    body: validDiagnostic({ odometerUnit: 'miles' }),
  });

  assert.equal(otherOwnerVehicle.status, 404);
  assert.equal((await otherOwnerVehicle.json()).error.code, 'VEHICLE_NOT_FOUND');
  assert.equal(wrongUnit.status, 400);
  assert.equal(records.size, 0);
});

test('isolates list, detail, and status updates by authenticated owner', async () => {
  const created = await request('', {
    method: 'POST',
    body: validDiagnostic(),
  });
  const record = (await created.json()).data.diagnostic;

  const otherList = await request('', { headers: authHeaders(ownerB) });
  const otherDetail = await request(`/${record.id}`, {
    headers: authHeaders(ownerB),
  });
  const otherUpdate = await request(`/${record.id}`, {
    method: 'PATCH',
    headers: authHeaders(ownerB),
    body: { status: 'Resolved' },
  });
  const ownDetail = await request(`/${record.id}`);

  assert.deepEqual((await otherList.json()).data.diagnostics, []);
  assert.equal(otherDetail.status, 404);
  assert.equal(otherUpdate.status, 404);
  assert.equal(ownDetail.status, 200);

  const resolved = await request(`/${record.id}`, {
    method: 'PATCH',
    body: { status: 'Resolved' },
  });
  assert.equal(resolved.status, 200);
  assert.equal((await resolved.json()).data.diagnostic.status, 'Resolved');
  assert.equal(records.get(record.id).status, 'Resolved');

  const duplicateTransition = await request(`/${record.id}`, {
    method: 'PATCH',
    body: { status: 'Resolved' },
  });
  assert.equal(duplicateTransition.status, 404);
});

test('analyzes an owned diagnostic through the safe mock adapter', async () => {
  const created = await request('', {
    method: 'POST',
    body: validDiagnostic({ code: 'P0301' }),
  });
  const record = (await created.json()).data.diagnostic;
  const response = await request(`/${record.id}/analyze`, { method: 'POST' });
  const analysis = (await response.json()).data.analysis;

  assert.equal(response.status, 200);
  assert.equal(analysis.provider, 'mock');
  assert.equal(analysis.supported, true);
  assert.ok(analysis.possibleCauses.length > 0);
  assert.ok(analysis.recommendedChecks.length > 0);
  assert.equal(analysis.recordedSeverity, 'High');
  assert.equal(analysis.mechanicReviewRequired, true);
  assert.equal(analysis.humanApprovalRequired, true);
});

test('unknown codes return a safe no-reference result and do not infer a fault', async () => {
  const created = await request('', {
    method: 'POST',
    body: validDiagnostic({ code: 'P0420' }),
  });
  const record = (await created.json()).data.diagnostic;
  const response = await request(`/${record.id}/analyze`, { method: 'POST' });
  const analysis = (await response.json()).data.analysis;

  assert.equal(response.status, 200);
  assert.equal(analysis.supported, false);
  assert.deepEqual(analysis.possibleCauses, []);
  assert.equal(analysis.mechanicReviewRequired, true);
  assert.match(analysis.uncertainty, /No code-specific mock reference/);
});

test('diagnostic analysis is owner-scoped and provider failures are not swallowed', async () => {
  const created = await request('', {
    method: 'POST',
    body: validDiagnostic(),
  });
  const record = (await created.json()).data.diagnostic;
  const otherOwner = await request(`/${record.id}/analyze`, {
    method: 'POST',
    headers: authHeaders(ownerB),
  });
  assert.equal(otherOwner.status, 404);

  const failingService = createDiagnosticAnalysisService({
    analyze: async () => {
      throw new Error('provider failure');
    },
  });
  await assert.rejects(
    failingService.analyze({ code: 'P0301' }),
    /provider failure/,
  );
});

test('validates record IDs and rejects missing or invalid JWTs', async () => {
  const missingToken = await request('', { headers: {} });
  const invalidToken = await request('', {
    headers: { Authorization: 'Bearer invalid' },
  });
  const invalidId = await request('/not-an-object-id');
  const missingRecord = await request(`/${new mongoose.Types.ObjectId()}`);

  assert.equal(missingToken.status, 401);
  assert.equal(invalidToken.status, 401);
  assert.equal(invalidId.status, 400);
  assert.equal(missingRecord.status, 404);
});
