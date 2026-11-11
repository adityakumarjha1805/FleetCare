const mongoose = require('mongoose');

const partSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    partNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    compatibility: {
      type: [String],
      default: [],
      validate: {
        validator: (values) =>
          values.length <= 25 &&
          values.every(
            (value) => typeof value === 'string' && value.trim().length <= 150,
          ),
        message: 'compatibility contains an invalid entry',
      },
    },
    stockQuantity: {
      type: Number,
      min: 0,
      validate: Number.isInteger,
      default: 0,
    },
    availability: {
      type: String,
      enum: ['sample_catalog', 'available', 'out_of_stock'],
      default: 'sample_catalog',
    },
    price: {
      type: Number,
      min: 0,
      default: null,
    },
    isSampleCatalog: {
      type: Boolean,
      default: false,
      immutable: true,
    },
  },
  { timestamps: true },
);

partSchema.index({ category: 1, name: 1 });
partSchema.index({ name: 'text', partNumber: 'text', category: 'text' });

module.exports = mongoose.models.Part || mongoose.model('Part', partSchema);
