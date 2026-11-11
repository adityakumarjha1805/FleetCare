const mongoose = require('mongoose');

const maintenanceRecordSchema = new mongoose.Schema(
  {
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
      immutable: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      immutable: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'Oil change',
        'Tire rotation',
        'Brake inspection',
        'General servicing',
        'Other',
      ],
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    maintenanceDate: {
      type: Date,
      required: true,
    },
    odometer: {
      type: Number,
      required: true,
      min: 0,
      max: 2_000_000,
      validate: Number.isInteger,
    },
    odometerUnit: {
      type: String,
      required: true,
      enum: ['km', 'miles'],
    },
    status: {
      type: String,
      required: true,
      enum: ['Upcoming', 'Overdue', 'Completed'],
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

maintenanceRecordSchema.index({ owner: 1, maintenanceDate: 1 });
maintenanceRecordSchema.index({
  owner: 1,
  vehicle: 1,
  maintenanceDate: -1,
});
maintenanceRecordSchema.index({ organization: 1, maintenanceDate: 1 });

module.exports =
  mongoose.models.MaintenanceRecord ||
  mongoose.model('MaintenanceRecord', maintenanceRecordSchema);
