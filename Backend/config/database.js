const mongoose = require('mongoose');
const config = require('./env');

async function connectToDatabase() {
  await mongoose.connect(config.mongodbUri, {
    serverSelectionTimeoutMS: 10000,
  });
}

module.exports = { connectToDatabase };
