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

const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && parsedFrontendOrigin.protocol !== 'https:') {
  throw new Error('FRONTEND_ORIGIN must use HTTPS in production');
}

if (isProduction && /^mongodb:\/\//i.test(mongodbUri)) {
  const hasTlsOption = /(?:[?&])(?:tls|ssl)=true(?:&|$)/i.test(mongodbUri);
  if (!hasTlsOption) {
    throw new Error('MONGODB_URI must enable TLS in production');
  }
}
if (isProduction && /(?:[?&])(?:tls|ssl)=false(?:&|$)/i.test(mongodbUri)) {
  throw new Error('MONGODB_URI cannot disable TLS in production');
}

const authCookieSameSite = (
  process.env.AUTH_COOKIE_SAME_SITE || (isProduction ? 'none' : 'lax')
).toLowerCase();
if (!['lax', 'none'].includes(authCookieSameSite)) {
  throw new Error('AUTH_COOKIE_SAME_SITE must be Lax or None');
}
if (authCookieSameSite === 'none' && !isProduction) {
  throw new Error('AUTH_COOKIE_SAME_SITE=None requires production HTTPS');
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
  isProduction,
  authCookieSameSite,
  authCookieSecure: isProduction,
  jwtSecret,
});
