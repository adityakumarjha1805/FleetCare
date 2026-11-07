const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const bcryptRounds = 12;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ['user'],
      default: 'user',
      immutable: true,
    },
    onboardingCompleted: {
      type: Boolean,
      default() {
        return this.isNew ? false : true;
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  },
);

userSchema.pre('save', async function () {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, bcryptRounds);
  }
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
