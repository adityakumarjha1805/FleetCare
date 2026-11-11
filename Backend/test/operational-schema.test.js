const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { test } = require('node:test');
const DiagnosticRecord = require('../models/DiagnosticRecord');
const MaintenanceRecord = require('../models/MaintenanceRecord');
const ServiceRequest = require('../models/ServiceRequest');
const Vehicle = require('../models/Vehicle');

test('operational models support optional immutable organization ownership', () => {
  for (const Model of [
    Vehicle,
    DiagnosticRecord,
    MaintenanceRecord,
    ServiceRequest,
  ]) {
    const path = Model.schema.path('organization');
    assert.equal(path.options.ref, 'Organization');
    assert.equal(path.options.required, undefined);
    assert.equal(path.options.immutable, true);
  }
});

test('legacy operational documents remain valid without organization ownership', () => {
  const owner = new mongoose.Types.ObjectId();
  const vehicle = new Vehicle({
    vehicleName: 'Legacy vehicle',
    registrationNumber: 'LEGACY1',
    make: 'FleetCare',
    model: 'Legacy',
    year: 2020,
    vehicleType: 'Van',
    odometer: 1,
    odometerUnit: 'km',
    owner,
  });

  assert.equal(vehicle.organization, null);
  assert.equal(vehicle.validateSync(), undefined);
});
