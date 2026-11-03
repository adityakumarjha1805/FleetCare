const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema(
  {
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    serviceType: {
      type: String,
      required: true,
      enum: [
        'General inspection',
        'Engine repair',
        'Oil change',
        'Brake inspection',
        'Tire service',
        'Other',
      ],
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    requestedDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    preferredDate: {
      type: Date,
      required: true,
    },
    priority: {
      type: String,
      required: true,
      enum: ['Low', 'Medium', 'High', 'Critical'],
    },
    status: {
      type: String,
      required: true,
      enum: ['Pending', 'Approved', 'In Progress', 'Completed', 'Rejected'],
      default: 'Pending',
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

serviceRequestSchema.index({ owner: 1, requestedDate: -1 });
serviceRequestSchema.index({ owner: 1, status: 1, preferredDate: 1 });

module.exports =
  mongoose.models.ServiceRequest ||
  mongoose.model('ServiceRequest', serviceRequestSchema);
