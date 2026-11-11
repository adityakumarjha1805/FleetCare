const mongoose = require('mongoose');
const { connectToDatabase } = require('../config/database');

const LEGACY_ROLES = ['organization_admin', 'fleet_manager', 'maintenance_staff'];
const OWNERSHIP_FIELDS = {
  vehicles: 'owner',
  diagnosticrecords: 'owner',
  maintenancerecords: 'owner',
  servicerequests: 'owner',
  partsrequests: 'requestedBy',
};

function isPresent(value) {
  return value !== undefined && value !== null;
}

function id(value) {
  return value?.toString();
}

function resolveOwner(record, { vehicleOwners, organizationMembers }) {
  const field = record.requestedBy ?? record.owner;
  if (isPresent(field)) {
    return { owner: id(field), reason: 'existing-owner' };
  }

  const vehicleOwner = vehicleOwners.get(id(record.vehicle));
  if (vehicleOwner) {
    return { owner: vehicleOwner, reason: 'vehicle-owner' };
  }

  const members = organizationMembers.get(id(record.organization)) || [];
  if (members.length === 1) {
    return { owner: members[0], reason: 'single-organization-member' };
  }

  return {
    owner: null,
    reason: members.length ? 'ambiguous-organization-members' : 'missing-organization-members',
  };
}

async function collectPlan(db) {
  const organizations = await db.collection('organizations').find({}).toArray();
  const users = await db.collection('users').find({}).toArray();
  const organizationMembers = new Map();
  for (const user of users) {
    if (user.organization) {
      const members = organizationMembers.get(id(user.organization)) || [];
      members.push(id(user._id));
      organizationMembers.set(id(user.organization), members);
    }
  }

  const vehicleDocs = await db.collection('vehicles').find({}).toArray();
  const vehicleOwners = new Map(
    vehicleDocs.filter((record) => isPresent(record.owner))
      .map((record) => [id(record._id), id(record.owner)]),
  );
  const collections = [
    ['vehicles', 'owner'],
    ['diagnosticrecords', 'owner'],
    ['maintenancerecords', 'owner'],
    ['servicerequests', 'owner'],
    ['partsrequests', 'requestedBy'],
  ];
  const operations = [];
  const unmapped = [];

  for (const [collectionName, ownerField] of collections) {
    const records = collectionName === 'vehicles'
      ? vehicleDocs
      : await db.collection(collectionName).find({}).toArray();
    for (const record of records) {
      if (isPresent(record[ownerField])) continue;
      const result = resolveOwner(record, { vehicleOwners, organizationMembers });
      if (!result.owner) {
        unmapped.push({
          collection: collectionName,
          id: id(record._id),
          organization: id(record.organization) || null,
          reason: result.reason,
        });
        continue;
      }
      operations.push({
        collection: collectionName,
        id: record._id,
        ownerField,
        owner: result.owner,
        reason: result.reason,
      });
    }
  }

  const notifications = await db.collection('notifications').find({}).toArray();
  const unmappedNotifications = notifications
    .filter((record) => !isPresent(record.recipient))
    .map((record) => ({
      collection: 'notifications',
      id: id(record._id),
      organization: id(record.organization) || null,
      reason: 'notification-recipient-cannot-be-inferred-safely',
    }));

  return {
    organizations: organizations.length,
    users: users.length,
    legacyUsers: users.filter((user) => LEGACY_ROLES.includes(user.role)).map((user) => user._id),
    operations,
    unmapped: [...unmapped, ...unmappedNotifications],
    preservedCollections: ['organizations'],
    unsupportedCollections: ['parts', 'aiAnalyses'],
    notificationCount: notifications.length,
  };
}

async function applyPlan(db, plan, { dryRun = false } = {}) {
  const result = {
    dryRun,
    migratedUsers: 0,
    migratedRecords: 0,
    errors: [],
  };
  if (dryRun) {
    result.plannedUsers = plan.legacyUsers.length;
    result.plannedRecords = plan.operations.length;
    return result;
  }

  const userResult = await db.collection('users').updateMany(
    { _id: { $in: plan.legacyUsers }, role: { $in: LEGACY_ROLES } },
    { $set: { role: 'user' } },
  );
  result.migratedUsers = userResult.modifiedCount || 0;
  for (const operation of plan.operations) {
    try {
      const update = await db.collection(operation.collection).updateOne(
        {
          _id: operation.id,
          $or: [
            { [operation.ownerField]: { $exists: false } },
            { [operation.ownerField]: null },
          ],
        },
        { $set: { [operation.ownerField]: new mongoose.Types.ObjectId(operation.owner) } },
      );
      result.migratedRecords += update.modifiedCount || 0;
    } catch (error) {
      result.errors.push({
        collection: operation.collection,
        id: id(operation.id),
        message: error.message,
      });
    }
  }
  return result;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  await connectToDatabase();
  const plan = await collectPlan(mongoose.connection.db);
  const result = await applyPlan(mongoose.connection.db, plan, { dryRun });
  console.log(JSON.stringify({
    mode: dryRun ? 'dry-run' : 'apply',
    organizationsInspected: plan.organizations,
    usersInspected: plan.users,
    legacyUsers: plan.legacyUsers.length,
    plannedOwnershipUpdates: plan.operations.length,
    unmappedRecords: plan.unmapped,
    preservedCollections: plan.preservedCollections,
    unsupportedCollections: plan.unsupportedCollections,
    notificationCount: plan.notificationCount,
    result,
  }, null, 2));
  if (result.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(`Platform migration failed: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}

module.exports = {
  LEGACY_ROLES,
  OWNERSHIP_FIELDS,
  collectPlan,
  applyPlan,
  resolveOwner,
};
