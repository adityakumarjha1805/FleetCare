const mongoose = require('mongoose');
const config = require('./env');

let connectionPromise;

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(config.mongodbUri, {
        serverSelectionTimeoutMS: 10000,
      })
      .finally(() => {
        connectionPromise = undefined;
      });
  }

  return connectionPromise;
}

module.exports = { connectToDatabase };
