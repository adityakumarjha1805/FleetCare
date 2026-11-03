const mongoose = require('mongoose');

const diagnosticCodePattern =
  /^(?:[PBCU][0-3][0-9A-F]{3}|SPN\s?\d{1,5}(?:\s+FMI\s?\d{1,2})?)$/;

const diagnosticRecordSchema = new mongoose.Schema(
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
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 32,
      match: diagnosticCodePattern,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },
    source: {
      type: String,
      enum: ['Manual', 'OBD-II', 'Telematics', 'Other'],
      default: 'Manual',
    },
    severity: {
      type: String,
      required: true,
      enum: ['Critical', 'High', 'Medium', 'Low'],
    },
    status: {
      type: String,
      enum: ['Active', 'Resolved'],
      default: 'Active',
    },
    dateDetected: {
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
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
  },
  { timestamps: true },
);

diagnosticRecordSchema.index({
  owner: 1,
  vehicle: 1,
  dateDetected: -1,
});
diagnosticRecordSchema.index({
  owner: 1,
  dateDetected: -1,
  createdAt: -1,
});

module.exports =
  mongoose.models.DiagnosticRecord ||
  mongoose.model('DiagnosticRecord', diagnosticRecordSchema);
