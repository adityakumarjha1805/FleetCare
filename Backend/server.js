const mongoose = require('mongoose');

async function startServer() {
  const config = require('./config/env');
  const app = require('./app');
  const { connectToDatabase } = require('./config/database');

  await connectToDatabase();

  return new Promise((resolve, reject) => {
    const server = app.listen(config.port);
    server.once('error', reject);
    server.once('listening', () => {
      console.log(`FleetCare API listening on port ${config.port}`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer().catch(async (error) => {
    console.error(`FleetCare API startup failed: ${error.message}`);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
}

module.exports = { startServer };
