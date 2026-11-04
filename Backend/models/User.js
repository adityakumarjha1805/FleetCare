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
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationOtpHash: {
      type: String,
      select: false,
    },
    emailVerificationOtpExpiresAt: {
      type: Date,
      select: false,
    },
    emailVerificationChallengeHash: {
      type: String,
      select: false,
    },
    emailVerificationChallengeExpiresAt: {
      type: Date,
      select: false,
    },
    emailVerificationFailedAttempts: {
      type: Number,
      default: 0,
      min: 0,
      select: false,
    },
    emailVerificationResendAvailableAt: {
      type: Date,
      select: false,
    },
    emailVerificationResendCount: {
      type: Number,
      default: 0,
      min: 0,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        delete ret.emailVerificationOtpHash;
        delete ret.emailVerificationOtpExpiresAt;
        delete ret.emailVerificationChallengeHash;
        delete ret.emailVerificationChallengeExpiresAt;
        delete ret.emailVerificationFailedAttempts;
        delete ret.emailVerificationResendAvailableAt;
        delete ret.emailVerificationResendCount;
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
