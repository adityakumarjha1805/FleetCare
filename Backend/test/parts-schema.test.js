const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { test } = require('node:test');

const Part = require('../models/Part');
const PartsRequest = require('../models/PartsRequest');

test('Part requires catalog identity fields and rejects invalid stock values', async () => {
  const part = new Part({
    name: 'Test filter',
    partNumber: 'TEST-1',
    category: 'Filters',
    stockQuantity: -1,
  });
  await assert.rejects(part.validate(), /stockQuantity/);
});

test('Part identifiers are unique and sample catalog fields are explicit', () => {
  assert.equal(Part.schema.path('partNumber').options.unique, true);
  assert.equal(Part.schema.path('isSampleCatalog').options.immutable, true);
  assert.deepEqual(Part.schema.path('availability').enumValues, [
    'sample_catalog',
    'available',
    'out_of_stock',
  ]);
});

test('PartsRequest validates quantities and required organization references', async () => {
  const request = new PartsRequest({
    organization: new mongoose.Types.ObjectId(),
    vehicle: new mongoose.Types.ObjectId(),
    requestedBy: new mongoose.Types.ObjectId(),
    requestedParts: [
      {
        part: new mongoose.Types.ObjectId(),
        name: 'Test filter',
        partNumber: 'TEST-1',
        quantity: 0,
      },
    ],
  });
  await assert.rejects(request.validate(), /quantity/);
});

test('PartsRequest exposes the supported review status transitions as enum values', () => {
  assert.deepEqual(PartsRequest.schema.path('status').enumValues, [
    'Pending',
    'Approved',
    'Rejected',
    'Fulfilled',
  ]);
});
