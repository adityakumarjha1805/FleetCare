const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { after, before, beforeEach, test } = require('node:test');

process.env.JWT_SECRET = 'fleetcare-vehicle-tests-use-a-32-byte-secret';

const app = require('../app');
const config = require('../config/env');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');

const users = new Map();
const vehicles = new Map();
const originalUserFindById = User.findById;
const originalVehicleCreate = Vehicle.create;
const originalVehicleFind = Vehicle.find;
const originalVehicleFindOne = Vehicle.findOne;
const originalVehicleFindOneAndUpdate = Vehicle.findOneAndUpdate;
const originalVehicleFindOneAndDelete = Vehicle.findOneAndDelete;
const ownerA = new mongoose.Types.ObjectId();
const ownerB = new mongoose.Types.ObjectId();
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

function matches(vehicle, filter) {
  return Object.entries(filter).every(([key, value]) => {
    const current = vehicle[key];
    return current && value
      ? current.toString() === value.toString()
      : current === value;
  });
}

function findVehicle(filter) {
  return [...vehicles.values()].find((vehicle) => matches(vehicle, filter)) || null;
}

function duplicateRegistration(owner, registrationNumber, exceptId) {
  return [...vehicles.values()].some(
    (vehicle) =>
      vehicle._id.toString() !== exceptId &&
      vehicle.owner.toString() === owner.toString() &&
      vehicle.registrationNumber === registrationNumber,
  );
}

function duplicateError() {
  const error = new Error('Duplicate key');
  error.code = 11000;
  return error;
}

function authHeaders(ownerId = ownerA) {
  const token = jwt.sign(
    {},
    config.jwtSecret,
    {
      algorithm: 'HS256',
      subject: ownerId.toString(),
      issuer: 'fleetcare-api',
      audience: 'fleetcare-client',
      expiresIn: '1h',
    },
  );
  return { Authorization: `Bearer ${token}` };
}

const validVehicle = {
  vehicleName: 'Delivery Truck',
  registrationNumber: ' ab 123 cd ',
  make: 'Volvo',
  model: 'FH',
  year: 2022,
  vehicleType: 'Truck',
  odometer: 12000,
  odometerUnit: 'km',
};

async function request(path, { method = 'GET', body, headers = authHeaders() } = {}) {
  return fetch(`${baseUrl}/api/vehicles${path}`, {
    method,
    headers: {
      ...headers,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

before(async () => {
  users.set(ownerA.toString(), makeUser(ownerA));
  users.set(ownerB.toString(), makeUser(ownerB));
  User.findById = async (id) => users.get(id) || null;

  Vehicle.create = async (fields) => {
    if (duplicateRegistration(fields.owner, fields.registrationNumber)) {
      throw duplicateError();
    }
    const vehicle = {
      ...fields,
      _id: new mongoose.Types.ObjectId(),
      healthStatus: fields.healthStatus || 'Healthy',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vehicles.set(vehicle._id.toString(), vehicle);
    return vehicle;
  };
  Vehicle.find = (filter) => ({
    sort: async () =>
      [...vehicles.values()]
        .filter((vehicle) => matches(vehicle, filter))
        .sort((a, b) => b.createdAt - a.createdAt),
  });
  Vehicle.findOne = async (filter) => findVehicle(filter);
  Vehicle.findOneAndUpdate = async (filter, update) => {
    const vehicle = findVehicle(filter);
    if (!vehicle) {
      return null;
    }
    const changes = update.$set;
    if (
      changes.registrationNumber &&
      duplicateRegistration(vehicle.owner, changes.registrationNumber, vehicle._id.toString())
    ) {
      throw duplicateError();
    }
    Object.assign(vehicle, changes, { updatedAt: new Date() });
    return vehicle;
  };
  Vehicle.findOneAndDelete = async (filter) => {
    const vehicle = findVehicle(filter);
    if (vehicle) {
      vehicles.delete(vehicle._id.toString());
    }
    return vehicle;
  };

  server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  vehicles.clear();
});

after(async () => {
  User.findById = originalUserFindById;
  Vehicle.create = originalVehicleCreate;
  Vehicle.find = originalVehicleFind;
  Vehicle.findOne = originalVehicleFindOne;
  Vehicle.findOneAndUpdate = originalVehicleFindOneAndUpdate;
  Vehicle.findOneAndDelete = originalVehicleFindOneAndDelete;

  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('creates a vehicle with normalized registration and authenticated ownership', async () => {
  const response = await request('', {
    method: 'POST',
    body: { ...validVehicle, healthStatus: 'Critical' },
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.data.vehicle.registrationNumber, 'AB123CD');
  assert.equal(body.data.vehicle.owner, ownerA.toString());
  assert.equal(body.data.vehicle.healthStatus, 'Critical');
  assert.equal(Object.hasOwn(body.data.vehicle, '__v'), false);
});

test('rejects client-supplied ownership fields', async () => {
  const response = await request('', {
    method: 'POST',
    body: { ...validVehicle, owner: ownerB.toString() },
  });

  assert.equal(response.status, 400);
});

test('rejects missing required fields', async () => {
  const response = await request('', {
    method: 'POST',
    body: { vehicleName: 'Incomplete vehicle' },
  });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'INVALID_VEHICLE');
});

test('rejects invalid model year and odometer', async () => {
  for (const body of [
    { ...validVehicle, year: new Date().getFullYear() + 2 },
    { ...validVehicle, year: 2022.5 },
    { ...validVehicle, odometer: -1 },
    { ...validVehicle, odometer: '12000' },
  ]) {
    const response = await request('', { method: 'POST', body });
    assert.equal(response.status, 400);
  }
});

test('rejects duplicate registration numbers within one owner scope', async () => {
  const first = await request('', { method: 'POST', body: validVehicle });
  assert.equal(first.status, 201);

  const duplicate = await request('', {
    method: 'POST',
    body: { ...validVehicle, registrationNumber: 'AB123CD' },
  });
  const body = await duplicate.json();

  assert.equal(duplicate.status, 409);
  assert.equal(body.error.code, 'REGISTRATION_NUMBER_IN_USE');

  const otherOwner = await request('', {
    method: 'POST',
    headers: authHeaders(ownerB),
    body: validVehicle,
  });
  assert.equal(otherOwner.status, 201);
});

test('lists only vehicles owned by the authenticated user', async () => {
  const ownVehicle = await request('', {
    method: 'POST',
    body: { ...validVehicle, registrationNumber: 'LISTA1' },
  });
  const otherVehicle = await request('', {
    method: 'POST',
    headers: authHeaders(ownerB),
    body: { ...validVehicle, registrationNumber: 'LISTB1' },
  });
  assert.equal(ownVehicle.status, 201);
  assert.equal(otherVehicle.status, 201);

  const response = await request('');
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.vehicles.length, 1);
  assert.ok(body.data.vehicles.every((vehicle) => vehicle.owner === ownerA.toString()));
});

test('fetches one vehicle belonging to the authenticated user', async () => {
  const created = await request('', {
    method: 'POST',
    body: { ...validVehicle, registrationNumber: 'GET123' },
  });
  const vehicle = (await created.json()).data.vehicle;
  const response = await request(`/${vehicle.id}`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.vehicle.id, vehicle.id);
});

test('updates an authorized vehicle and prevents owner changes', async () => {
  const created = await request('', {
    method: 'POST',
    body: { ...validVehicle, registrationNumber: 'UPD123' },
  });
  const vehicle = (await created.json()).data.vehicle;
  const response = await request(`/${vehicle.id}`, {
    method: 'PUT',
    body: { odometer: 13000, owner: ownerB.toString() },
  });

  assert.equal(response.status, 400);
  const update = await request(`/${vehicle.id}`, {
    method: 'PUT',
    body: { odometer: 13000 },
  });
  const body = await update.json();

  assert.equal(update.status, 200);
  assert.equal(body.data.vehicle.odometer, 13000);
  assert.equal(body.data.vehicle.owner, ownerA.toString());
});

test('deletes an authorized vehicle', async () => {
  const created = await request('', {
    method: 'POST',
    body: { ...validVehicle, registrationNumber: 'DEL123' },
  });
  const vehicle = (await created.json()).data.vehicle;
  const response = await request(`/${vehicle.id}`, { method: 'DELETE' });
  const deleted = await response.json();
  const subsequentRead = await request(`/${vehicle.id}`);

  assert.equal(response.status, 200);
  assert.equal(deleted.data.vehicle.id, vehicle.id);
  assert.equal(subsequentRead.status, 404);
});

test('rejects missing and invalid JWTs', async () => {
  for (const headers of [{}, { Authorization: 'Bearer invalid-token' }]) {
    const response = await request('', { headers });
    assert.equal(response.status, 401);
  }
});

test('does not disclose another owner’s vehicle', async () => {
  const created = await request('', {
    method: 'POST',
    headers: authHeaders(ownerB),
    body: { ...validVehicle, registrationNumber: 'OTHER1' },
  });
  const vehicle = (await created.json()).data.vehicle;
  const response = await request(`/${vehicle.id}`, {
    headers: authHeaders(ownerA),
  });

  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'NOT_FOUND');
});

test('prevents updating or deleting another owner’s vehicle', async () => {
  const created = await request('', {
    method: 'POST',
    headers: authHeaders(ownerB),
    body: { ...validVehicle, registrationNumber: 'OTHER2' },
  });
  const vehicle = (await created.json()).data.vehicle;

  const update = await request(`/${vehicle.id}`, {
    method: 'PUT',
    body: { odometer: 1 },
  });
  const deletion = await request(`/${vehicle.id}`, { method: 'DELETE' });

  assert.equal(update.status, 404);
  assert.equal(deletion.status, 404);
  assert.equal(vehicles.has(vehicle.id), true);
});

test('returns not found for a valid but nonexistent vehicle ID', async () => {
  const response = await request(`/${new mongoose.Types.ObjectId()}`);

  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'NOT_FOUND');
});

test('rejects malformed vehicle IDs', async () => {
  const response = await request('/not-an-object-id');

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'INVALID_VEHICLE_ID');
});
