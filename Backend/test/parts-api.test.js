const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { after, before, test } = require('node:test');

process.env.JWT_SECRET = 'fleetcare-parts-api-tests-use-a-32-byte-secret';

const app = require('../app');
const config = require('../config/env');
const DiagnosticRecord = require('../models/DiagnosticRecord');
const Part = require('../models/Part');
const PartsRequest = require('../models/PartsRequest');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const { ensureSampleParts } = require('../services/partsCatalog');

const organizationA = new mongoose.Types.ObjectId();
const organizationB = new mongoose.Types.ObjectId();
const users = new Map();
const vehicles = new Map();
const diagnostics = new Map();
const requests = new Map();
const parts = new Map();
const originals = {
  userFindById: User.findById,
  userFind: User.find,
  vehicleFindOne: Vehicle.findOne,
  diagnosticFindOne: DiagnosticRecord.findOne,
  partBulkWrite: Part.bulkWrite,
  partFind: Part.find,
  partFindById: Part.findById,
  requestCreate: PartsRequest.create,
  requestFind: PartsRequest.find,
  requestFindOne: PartsRequest.findOne,
  requestFindOneAndUpdate: PartsRequest.findOneAndUpdate,
  notificationBulkWrite: Notification.bulkWrite,
};
let server;
let baseUrl;

const part = {
  _id: new mongoose.Types.ObjectId(),
  name: 'Test spark plug',
  partNumber: 'TEST-SPARK-1',
  category: 'Ignition',
  description: 'Sample test part',
  compatibility: ['Test fleet'],
  stockQuantity: 0,
  availability: 'sample_catalog',
  price: null,
  isSampleCatalog: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function query(value) {
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

function userQuery(value) {
  return {
    select() {
      return this;
    },
    lean() {
      return Promise.resolve(value);
    },
  };
}

function matches(document, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (value && value.$in) {
      return value.$in.some((candidate) => candidate.toString() === document[key].toString());
    }
    return document[key]?.toString() === value?.toString();
  });
}

function makeUser(role, organization) {
  const user = {
    _id: new mongoose.Types.ObjectId(),
    name: role,
    email: `${role}-${organization}@example.test`,
    role,
    organization,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  users.set(user._id.toString(), user);
  return user;
}

function authHeaders(user) {
  const token = jwt.sign({}, config.jwtSecret, {
    algorithm: 'HS256',
    subject: user._id.toString(),
    issuer: 'fleetcare-api',
    audience: 'fleetcare-client',
  });
  return { Authorization: `Bearer ${token}` };
}

async function request(path, user, options = {}) {
  return fetch(`${baseUrl}/api${path}`, {
    ...options,
    headers: {
      ...authHeaders(user),
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

before(async () => {
  const admin = makeUser('admin', organizationA);
  const manager = makeUser('user', organizationA);
  const staff = makeUser('user', organizationA);
  const otherManager = makeUser('user', organizationB);
  const vehicle = {
    _id: new mongoose.Types.ObjectId(),
    owner: manager?._id,
    organization: organizationA,
    vehicleName: 'Organization A truck',
    registrationNumber: 'A-1',
  };
  const otherVehicle = {
    _id: new mongoose.Types.ObjectId(),
    owner: otherManager?._id,
    organization: organizationB,
    vehicleName: 'Organization B truck',
    registrationNumber: 'B-1',
  };
  vehicles.set(vehicle._id.toString(), vehicle);
  vehicles.set(otherVehicle._id.toString(), otherVehicle);
  parts.set(part._id.toString(), part);

  User.findById = async (id) => users.get(id.toString()) || null;
  User.find = (filter) =>
    userQuery(
      [...users.values()].filter(
        (candidate) =>
          candidate.organization?.toString() === filter.organization?.toString() &&
          filter.role.$in.includes(candidate.role) &&
          (!filter._id?.$ne || candidate._id.toString() !== filter._id.$ne.toString()),
      ),
    );
  Vehicle.findOne = async (filter) =>
    [...vehicles.values()].find((candidate) => matches(candidate, filter)) || null;
  DiagnosticRecord.findOne = (filter) =>
    query([...diagnostics.values()].find((candidate) => matches(candidate, filter)) || null);
  Part.bulkWrite = async (operations) => {
    operations.forEach((operation) => {
      const sample = operation.updateOne.update.$setOnInsert;
      if (![...parts.values()].some((candidate) => candidate.partNumber === sample.partNumber)) {
        const inserted = { ...sample, _id: new mongoose.Types.ObjectId() };
        parts.set(inserted._id.toString(), inserted);
      }
    });
  };
  Part.find = (filter = {}) => {
    let result = [...parts.values()];
    if (filter._id?.$in) {
      result = result.filter((candidate) =>
        filter._id.$in.some((id) => id.toString() === candidate._id.toString()),
      );
    }
    if (filter.partNumber?.$in) {
      result = result.filter((candidate) => filter.partNumber.$in.includes(candidate.partNumber));
    }
    return query(result);
  };
  Part.findById = async (id) => parts.get(id.toString()) || null;
  PartsRequest.create = async (fields) => {
    const document = new PartsRequest({
      ...fields,
      _id: new mongoose.Types.ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const plain = document.toObject();
    requests.set(document._id.toString(), plain);
    return document;
  };
  PartsRequest.find = (filter) =>
    query([...requests.values()].filter((candidate) => matches(candidate, filter)));
  PartsRequest.findOne = (filter) =>
    query([...requests.values()].find((candidate) => matches(candidate, filter)) || null);
  PartsRequest.findOneAndUpdate = (filter, update) => {
    const document = [...requests.values()].find((candidate) => matches(candidate, filter));
    if (document) Object.assign(document, update.$set);
    return query(document || null);
  };
  Notification.bulkWrite = async () => ({});

  server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  // Keep the variable referenced so this test documents that the route uses the catalog seeder.
  assert.equal(typeof ensureSampleParts, 'function');

  users.admin = admin;
  users.manager = manager;
  users.staff = staff;
  users.otherManager = otherManager;
  vehicles.own = vehicle;
  vehicles.other = otherVehicle;
});

after(async () => {
  User.findById = originals.userFindById;
  User.find = originals.userFind;
  Vehicle.findOne = originals.vehicleFindOne;
  DiagnosticRecord.findOne = originals.diagnosticFindOne;
  Part.bulkWrite = originals.partBulkWrite;
  Part.find = originals.partFind;
  Part.findById = originals.partFindById;
  PartsRequest.create = originals.requestCreate;
  PartsRequest.find = originals.requestFind;
  PartsRequest.findOne = originals.requestFindOne;
  PartsRequest.findOneAndUpdate = originals.requestFindOneAndUpdate;
  Notification.bulkWrite = originals.notificationBulkWrite;
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test('lists the explicitly labelled sample catalog for authenticated users', async () => {
  const response = await request('/parts?q=spark', users.manager);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.data.parts[0].isSampleCatalog, true);
});

test('normal users can create requests only for an owned vehicle', async () => {
  const response = await request('/parts/requests', users.manager, {
    method: 'POST',
    body: {
      vehicleId: vehicles.own._id.toString(),
      requestedParts: [{ partId: part._id.toString(), quantity: 2 }],
    },
  });
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.data.request.status, 'Pending');
  assert.equal(body.data.purchase.placed, false);

  const crossOrganization = await request('/parts/requests', users.otherManager, {
    method: 'POST',
    body: {
      vehicleId: vehicles.own._id.toString(),
      requestedParts: [{ partId: part._id.toString(), quantity: 1 }],
    },
  });
  assert.equal(crossOrganization.status, 404);
});

test('normal users cannot review requests', async () => {
  const create = await request('/parts/requests', users.staff, {
    method: 'POST',
    body: {
      vehicleId: vehicles.own._id.toString(),
      requestedParts: [{ partId: part._id.toString(), quantity: 1 }],
    },
  });
  assert.equal(create.status, 404);

  const requestId = [...requests.keys()][0];
  const review = await request(`/parts/requests/${requestId}`, users.manager, {
    method: 'PATCH',
    body: { status: 'Approved' },
  });
  assert.equal(review.status, 403);
});

test('admins review requests and invalid transitions are rejected', async () => {
  const requestId = [...requests.keys()][0];
  const approved = await request(`/parts/requests/${requestId}`, users.admin, {
    method: 'PATCH',
    body: { status: 'Approved', reviewNotes: 'Review required before ordering.' },
  });
  const approvedBody = await approved.json();
  assert.equal(approved.status, 200);
  assert.equal(approvedBody.data.request.status, 'Approved');

  const invalid = await request(`/parts/requests/${requestId}`, users.admin, {
    method: 'PATCH',
    body: { status: 'Rejected' },
  });
  assert.equal(invalid.status, 400);
});

test('request validation rejects invalid quantities and unknown parts', async () => {
  const invalidQuantity = await request('/parts/requests', users.manager, {
    method: 'POST',
    body: {
      vehicleId: vehicles.own._id.toString(),
      requestedParts: [{ partId: part._id.toString(), quantity: 0 }],
    },
  });
  assert.equal(invalidQuantity.status, 400);

  const unknownPart = await request('/parts/requests', users.manager, {
    method: 'POST',
    body: {
      vehicleId: vehicles.own._id.toString(),
      requestedParts: [{ partId: new mongoose.Types.ObjectId().toString(), quantity: 1 }],
    },
  });
  assert.equal(unknownPart.status, 404);
});
