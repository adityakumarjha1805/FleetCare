const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { after, before, test } = require('node:test');

process.env.JWT_SECRET = 'fleetcare-notification-tests-use-a-32-byte-secret';

const app = require('../app');
const config = require('../config/env');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { createNotifications } = require('../services/notifications');

const organizationA = new mongoose.Types.ObjectId();
const organizationB = new mongoose.Types.ObjectId();
const users = new Map();
const notifications = new Map();
const originals = {
  userFindById: User.findById,
  notificationFind: Notification.find,
  notificationCountDocuments: Notification.countDocuments,
  notificationFindOneAndUpdate: Notification.findOneAndUpdate,
  notificationUpdateMany: Notification.updateMany,
  notificationBulkWrite: Notification.bulkWrite,
};
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

function authHeaders(user) {
  const token = jwt.sign({}, config.jwtSecret, {
    algorithm: 'HS256',
    subject: user._id.toString(),
    issuer: 'fleetcare-api',
    audience: 'fleetcare-client',
  });
  return { Authorization: ['Bearer', token].join(' ') };
}

function matches(document, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (value && value.$in) {
      return value.$in.some((candidate) => candidate.toString() === document[key].toString());
    }
    return document[key]?.toString() === value?.toString();
  });
}

function query(value) {
  return {
    sort() {
      return this;
    },
    limit() {
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
}

function request(path, user, options = {}) {
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
  const admin = makeUser('organization_admin', organizationA);
  const manager = makeUser('fleet_manager', organizationA);
  const otherManager = makeUser('fleet_manager', organizationB);
  const first = new Notification({
    _id: new mongoose.Types.ObjectId(),
    organization: organizationA,
    recipient: manager._id,
    title: 'New service request',
    message: 'A vehicle needs service.',
    type: 'service_request',
    read: false,
    dedupeKey: 'first',
    createdAt: new Date(),
  }).toObject();
  const second = new Notification({
    _id: new mongoose.Types.ObjectId(),
    organization: organizationA,
    recipient: manager._id,
    title: 'Maintenance completed',
    message: 'Maintenance is complete.',
    type: 'maintenance',
    read: true,
    dedupeKey: 'second',
    createdAt: new Date(),
  }).toObject();
  const other = new Notification({
    _id: new mongoose.Types.ObjectId(),
    organization: organizationB,
    recipient: otherManager._id,
    title: 'Private notification',
    message: 'Other organization.',
    type: 'organization',
    read: false,
    dedupeKey: 'other',
    createdAt: new Date(),
  }).toObject();
  [first, second, other].forEach((item) => notifications.set(item._id.toString(), item));

  User.findById = async (id) => users.get(id.toString()) || null;
  Notification.find = (filter) =>
    query([...notifications.values()].filter((item) => matches(item, filter)));
  Notification.countDocuments = async (filter) =>
    [...notifications.values()].filter((item) => matches(item, filter)).length;
  Notification.findOneAndUpdate = async (filter, update) => {
    const item = [...notifications.values()].find((candidate) => matches(candidate, filter));
    if (item) Object.assign(item, update.$set);
    return item || null;
  };
  Notification.updateMany = async (filter, update) => {
    let modifiedCount = 0;
    notifications.forEach((item) => {
      if (matches(item, filter)) {
        Object.assign(item, update.$set);
        modifiedCount += 1;
      }
    });
    return { modifiedCount };
  };
  Notification.bulkWrite = async (operations) => {
    operations.forEach((operation) => {
      const values = operation.updateOne.update.$setOnInsert;
      if (![...notifications.values()].some((item) => item.dedupeKey === values.dedupeKey)) {
        notifications.set(values.dedupeKey, {
          ...values,
          _id: new mongoose.Types.ObjectId(),
          createdAt: new Date(),
        });
      }
    });
  };

  server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  users.admin = admin;
  users.manager = manager;
  users.otherManager = otherManager;
});

after(async () => {
  User.findById = originals.userFindById;
  Notification.find = originals.notificationFind;
  Notification.countDocuments = originals.notificationCountDocuments;
  Notification.findOneAndUpdate = originals.notificationFindOneAndUpdate;
  Notification.updateMany = originals.notificationUpdateMany;
  Notification.bulkWrite = originals.notificationBulkWrite;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

test('lists only the authenticated user notifications and unread count', async () => {
  const response = await request('/notifications', users.manager);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.data.notifications.length, 2);

  const countResponse = await request('/notifications/unread-count', users.manager);
  assert.equal((await countResponse.json()).data.count, 1);
});

test('prevents cross-organization notification access and enforces roles', async () => {
  const response = await request('/notifications', users.otherManager);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.data.notifications.length, 1);

  const invalid = await request('/notifications/not-an-id/read', users.manager, {
    method: 'PATCH',
  });
  assert.equal(invalid.status, 400);
});

test('marks one notification and all notifications as read', async () => {
  const managerNotifications = [...notifications.values()].filter(
    (item) => item.recipient.toString() === users.manager._id.toString(),
  );
  const one = await request(`/notifications/${managerNotifications[0]._id}/read`, users.manager, {
    method: 'PATCH',
  });
  assert.equal(one.status, 200);

  const all = await request('/notifications/read-all', users.manager, {
    method: 'POST',
    body: {},
  });
  assert.equal(all.status, 200);
  const count = await request('/notifications/unread-count', users.manager);
  assert.equal((await count.json()).data.count, 0);
});

test('deduplicates notification creation by recipient and event key', async () => {
  const beforeCount = notifications.size;
  await createNotifications({
    organizationId: organizationA,
    recipientIds: [users.admin._id],
    title: 'New parts request',
    message: 'Review a parts request.',
    type: 'parts_request',
    dedupeKey: 'parts-request:one',
  });
  await createNotifications({
    organizationId: organizationA,
    recipientIds: [users.admin._id],
    title: 'New parts request',
    message: 'Review a parts request.',
    type: 'parts_request',
    dedupeKey: 'parts-request:one',
  });
  assert.equal(notifications.size, beforeCount + 1);
});
