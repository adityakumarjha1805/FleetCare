const app = require('../app');
const { connectToDatabase } = require('../config/database');

module.exports = async function handler(req, res) {
  await connectToDatabase();
  return app(req, res);
};
