const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

const mongodbUri = required('MONGODB_URI');
if (!/^mongodb(?:\+srv)?:\/\//i.test(mongodbUri)) {
  throw new Error('MONGODB_URI must use the mongodb:// or mongodb+srv:// scheme');
}

const frontendOrigin = required('FRONTEND_ORIGIN');
let parsedFrontendOrigin;
try {
  parsedFrontendOrigin = new URL(frontendOrigin);
} catch {
  throw new Error('FRONTEND_ORIGIN must be a valid HTTP or HTTPS origin');
}

if (
  !['http:', 'https:'].includes(parsedFrontendOrigin.protocol) ||
  parsedFrontendOrigin.origin !== frontendOrigin
) {
  throw new Error('FRONTEND_ORIGIN must be a valid HTTP or HTTPS origin');
}

const jwtSecret = required('JWT_SECRET');
if (Buffer.byteLength(jwtSecret, 'utf8') < 32) {
  throw new Error('JWT_SECRET must be at least 32 bytes long');
}

const port = Number(process.env.PORT || 5000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

module.exports = Object.freeze({
  port,
  mongodbUri,
  frontendOrigin: parsedFrontendOrigin.origin,
  jwtSecret,
});
