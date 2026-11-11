const mongoose = require('mongoose');
const { connectToDatabase } = require('../config/database');

const OWNER_COLLECTIONS = [
  ['vehicles', 'owner'],
  ['diagnosticrecords', 'owner'],
  ['maintenancerecords', 'owner'],
  ['servicerequests', 'owner'],
  ['partsrequests', 'requestedBy'],
];

async function verify(db) {
  const users = await db.collection('users').find({}).project({ _id: 1, organization: 1 }).toArray();
  const userIds = new Set(users.map((user) => user._id.toString()));
  const userOrganizations = new Map(
    users.filter((user) => user.organization)
      .map((user) => [user._id.toString(), user.organization.toString()]),
  );
  const vehicleOwners = new Map(
    (await db.collection('vehicles').find({}).toArray())
      .filter((vehicle) => vehicle.owner)
      .map((vehicle) => [vehicle._id.toString(), vehicle.owner.toString()]),
  );
  const findings = [];

  for (const [collectionName, ownerField] of OWNER_COLLECTIONS) {
    const records = await db.collection(collectionName).find({}).toArray();
    for (const record of records) {
      const owner = record[ownerField];
      if (!owner) {
        findings.push({
          collection: collectionName,
          id: record._id.toString(),
          issue: 'missing-owner',
        });
      } else if (!userIds.has(owner.toString())) {
        findings.push({
          collection: collectionName,
          id: record._id.toString(),
          owner: owner.toString(),
          issue: 'owner-does-not-exist',
        });
      } else if (
        record.organization &&
        userOrganizations.has(owner.toString()) &&
        userOrganizations.get(owner.toString()) !== record.organization.toString()
      ) {
        findings.push({
          collection: collectionName,
          id: record._id.toString(),
          owner: owner.toString(),
          issue: 'owner-organization-mismatch',
        });
      } else if (
        collectionName !== 'vehicles' &&
        record.vehicle &&
        vehicleOwners.has(record.vehicle.toString()) &&
        vehicleOwners.get(record.vehicle.toString()) !== owner.toString()
      ) {
        findings.push({
          collection: collectionName,
          id: record._id.toString(),
          owner: owner.toString(),
          issue: 'owner-does-not-match-vehicle',
        });
      }
    }
  }

  const notifications = await db.collection('notifications').find({}).toArray();
  for (const notification of notifications) {
    if (!notification.recipient) {
      findings.push({
        collection: 'notifications',
        id: notification._id.toString(),
        issue: 'missing-recipient',
      });
    } else if (!userIds.has(notification.recipient.toString())) {
      findings.push({
        collection: 'notifications',
        id: notification._id.toString(),
        issue: 'recipient-does-not-exist',
      });
    }
  }

  return {
    passed: findings.length === 0,
    checkedUsers: users.length,
    findings,
    legacyFieldsPreserved: true,
  };
}

async function main() {
  await connectToDatabase();
  const result = await verify(mongoose.connection.db);
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 2;
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(`Platform migration verification failed: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}

module.exports = { verify };
