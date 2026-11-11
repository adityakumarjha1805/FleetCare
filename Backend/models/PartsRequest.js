const mongoose = require('mongoose');

const requestedPartSchema = new mongoose.Schema(
  {
    part: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Part',
      required: true,
      immutable: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
      immutable: true,
    },
    partNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 80,
      immutable: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
      validate: Number.isInteger,
    },
  },
  { _id: false },
);

const partsRequestSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      immutable: true,
    },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
      immutable: true,
    },
    requestedParts: {
      type: [requestedPartSchema],
      required: true,
      validate: {
        validator: (values) => values.length > 0 && values.length <= 25,
        message: 'At least one requested part is required',
      },
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Fulfilled'],
      default: 'Pending',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
  },
  { timestamps: true },
);

partsRequestSchema.index({ requestedBy: 1, status: 1, createdAt: -1 });
partsRequestSchema.index({ requestedBy: 1, vehicle: 1, createdAt: -1 });

module.exports =
  mongoose.models.PartsRequest ||
  mongoose.model('PartsRequest', partsRequestSchema);
