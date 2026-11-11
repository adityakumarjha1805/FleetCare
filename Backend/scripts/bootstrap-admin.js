const mongoose = require('mongoose');
const User = require('../models/User');
const { connectToDatabase } = require('../config/database');

function readBootstrapInput(environment = process.env) {
  const email = environment.ADMIN_EMAIL?.trim().toLowerCase();
  const password = environment.ADMIN_PASSWORD;
  const name = (environment.ADMIN_NAME || 'FleetCare Admin').trim();
  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('ADMIN_EMAIL must be a valid email address');
  }
  if (!name || name.length > 100) {
    throw new Error('ADMIN_NAME must contain 1-100 characters');
  }
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('ADMIN_PASSWORD must contain 8-72 UTF-8 bytes');
  }
  return { email, password, name };
}

async function bootstrapAdmin({ email, password, name }) {
  const existingAdmin = await User.findOne({ role: 'admin' }).select('_id');
  if (existingAdmin) {
    throw new Error('An admin account already exists; no account was changed');
  }
  const existingAccount = await User.findOne({ email }).select('_id role');
  if (existingAccount) {
    throw new Error('ADMIN_EMAIL belongs to an existing account; no account was changed');
  }
  await User.create({
    name,
    email,
    password,
    role: 'admin',
    onboardingCompleted: true,
  });
}

async function main() {
  const input = readBootstrapInput();
  await connectToDatabase();
  await bootstrapAdmin(input);
  console.log(`Created the first admin account for ${input.email}`);
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(`Admin bootstrap failed: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}

module.exports = { readBootstrapInput, bootstrapAdmin };
