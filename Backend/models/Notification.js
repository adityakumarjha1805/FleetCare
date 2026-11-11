const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: false,
      immutable: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    type: {
      type: String,
      enum: [
        'parts_request',
        'service_request',
        'maintenance',
        'organization',
      ],
      required: true,
      immutable: true,
    },
    relatedResourceType: {
      type: String,
      enum: ['PartsRequest', 'ServiceRequest', 'MaintenanceRecord'],
      default: null,
      immutable: true,
    },
    relatedResourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      immutable: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
    dedupeKey: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });

module.exports =
  mongoose.models.Notification ||
  mongoose.model('Notification', notificationSchema);
