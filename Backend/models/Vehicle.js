const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema(
  {
    vehicleName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    registrationNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      set: (value) => (typeof value === 'string' ? value.replace(/\s+/g, '') : value),
      maxlength: 20,
      match: /^[A-Z0-9-]{2,20}$/,
    },
    make: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    model: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    year: {
      type: Number,
      required: true,
      min: 1886,
      max: new Date().getFullYear() + 1,
      validate: Number.isInteger,
    },
    vehicleType: {
      type: String,
      required: true,
      enum: ['Truck', 'Van', 'Car', 'Pickup', 'Other'],
    },
    odometer: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isFinite,
    },
    odometerUnit: {
      type: String,
      required: true,
      enum: ['km', 'miles'],
    },
    healthStatus: {
      type: String,
      enum: ['Healthy', 'Needs Attention', 'Critical'],
      default: 'Healthy',
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
  },
  { timestamps: true },
);

vehicleSchema.index({ owner: 1, registrationNumber: 1 }, { unique: true });

module.exports =
  mongoose.models.Vehicle || mongoose.model('Vehicle', vehicleSchema);
