const assert = require('node:assert/strict');
const { test } = require('node:test');
const mongoose = require('mongoose');

const {
  applyPlan,
  collectPlan,
  resolveOwner,
} = require('../scripts/migrate-to-platform');
const User = require('../models/User');
const {
  bootstrapAdmin,
  readBootstrapInput,
} = require('../scripts/bootstrap-admin');

function collection(documents) {
  return {
    find(filter = {}) {
      return {
        project() { return this; },
        async toArray() {
          if (!Object.keys(filter).length) return documents;
          return documents.filter((document) =>
            Object.entries(filter).every(([key, value]) => document[key]?.toString() === value?.toString()));
        },
      };
    },
    async updateMany(filter, update) {
      let modifiedCount = 0;
      for (const document of documents) {
        if (filter.role?.$in?.includes(document.role)) {
          Object.assign(document, update.$set);
          modifiedCount += 1;
        }
      }
      return { modifiedCount };
    },
    async updateOne(filter, update) {
      const document = documents.find((candidate) =>
        candidate._id.toString() === filter._id.toString() &&
        (candidate[Object.keys(update.$set)[0]] === undefined ||
          candidate[Object.keys(update.$set)[0]] === null));
      if (!document) return { modifiedCount: 0 };
      Object.assign(document, update.$set);
      return { modifiedCount: 1 };
    },
  };
}

function database(data) {
  return {
    collection(name) {
      return collection(data[name] || []);
    },
  };
}

test('ownership mapping only uses deterministic relationships', () => {
  const organization = new mongoose.Types.ObjectId();
  const owner = new mongoose.Types.ObjectId();
  const vehicle = new mongoose.Types.ObjectId();
  assert.deepEqual(
    resolveOwner({ vehicle, organization }, {
      vehicleOwners: new Map([[vehicle.toString(), owner.toString()]]),
      organizationMembers: new Map(),
    }),
    { owner: owner.toString(), reason: 'vehicle-owner' },
  );
  assert.equal(resolveOwner({ organization }, {
    vehicleOwners: new Map(),
    organizationMembers: new Map([[organization.toString(), ['a', 'b']]]),
  }).owner, null);
});

test('dry-run creates a plan but does not update records', async () => {
  const organization = new mongoose.Types.ObjectId();
  const user = new mongoose.Types.ObjectId();
  const vehicle = new mongoose.Types.ObjectId();
  const data = {
    organizations: [{ _id: organization }],
    users: [{ _id: user, organization, role: 'fleet_manager' }],
    vehicles: [{ _id: vehicle, organization }],
    diagnosticrecords: [],
    maintenancerecords: [],
    servicerequests: [],
    partsrequests: [],
    notifications: [],
  };
  const plan = await collectPlan(database(data));
  const result = await applyPlan(database(data), plan, { dryRun: true });
  assert.equal(result.dryRun, true);
  assert.equal(result.plannedRecords, 1);
  assert.equal(data.vehicles[0].owner, undefined);
});

test('repeated migration is idempotent and preserves organization fields', async () => {
  const organization = new mongoose.Types.ObjectId();
  const user = new mongoose.Types.ObjectId();
  const vehicle = new mongoose.Types.ObjectId();
  const data = {
    organizations: [{ _id: organization, name: 'Legacy Fleet' }],
    users: [{ _id: user, organization, role: 'fleet_manager' }],
    vehicles: [{ _id: vehicle, organization }],
    diagnosticrecords: [],
    maintenancerecords: [],
    servicerequests: [],
    partsrequests: [],
    notifications: [],
  };
  const firstPlan = await collectPlan(database(data));
  const first = await applyPlan(database(data), firstPlan);
  const secondPlan = await collectPlan(database(data));
  const second = await applyPlan(database(data), secondPlan);
  assert.equal(first.migratedRecords, 1);
  assert.equal(second.migratedRecords, 0);
  assert.equal(data.vehicles[0].organization, organization);
  assert.equal(data.organizations[0].name, 'Legacy Fleet');
});

test('migration reports unmapped records instead of guessing', async () => {
  const organization = new mongoose.Types.ObjectId();
  const data = {
    organizations: [{ _id: organization }],
    users: [
      { _id: new mongoose.Types.ObjectId(), organization },
      { _id: new mongoose.Types.ObjectId(), organization },
    ],
    vehicles: [{ _id: new mongoose.Types.ObjectId(), organization }],
    diagnosticrecords: [],
    maintenancerecords: [],
    servicerequests: [],
    partsrequests: [],
    notifications: [{ _id: new mongoose.Types.ObjectId(), organization }],
  };
  const plan = await collectPlan(database(data));
  assert.equal(plan.unmapped.length, 2);
  assert.equal(plan.operations.length, 0);
});

test('bootstrap validates environment without exposing the password', () => {
  assert.deepEqual(readBootstrapInput({
    ADMIN_EMAIL: ' Admin@Example.com ',
    ADMIN_PASSWORD: 'strong-password',
    ADMIN_NAME: 'Platform Admin',
  }), {
    email: 'admin@example.com',
    password: 'strong-password',
    name: 'Platform Admin',
  });
  assert.throws(() => readBootstrapInput({
    ADMIN_EMAIL: 'admin@example.com',
    ADMIN_PASSWORD: 'short',
  }), /8-72/);
});

test('bootstrap refuses an existing admin or normal-user conflict', async () => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;
  try {
    User.findOne = (filter) => ({
      select: async () => filter.role === 'admin'
        ? { _id: new mongoose.Types.ObjectId() }
        : null,
    });
    await assert.rejects(
      bootstrapAdmin({ email: 'new@example.com', password: 'password123', name: 'Admin' }),
      /admin account already exists/,
    );

    User.findOne = (filter) => ({
      select: async () => filter.role === 'admin'
        ? null
        : { _id: new mongoose.Types.ObjectId(), role: 'user' },
    });
    await assert.rejects(
      bootstrapAdmin({ email: 'existing@example.com', password: 'password123', name: 'Admin' }),
      /existing account/,
    );

    User.findOne = () => ({ select: async () => null });
    let created;
    User.create = async (input) => { created = input; };
    await bootstrapAdmin({ email: 'new@example.com', password: 'password123', name: 'Admin' });
    assert.equal(created.role, 'admin');
    assert.equal(created.password, 'password123');
  } finally {
    User.findOne = originalFindOne;
    User.create = originalCreate;
  }
});
