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

const authCookieSameSite = (process.env.AUTH_COOKIE_SAME_SITE || 'lax').toLowerCase();
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

const smtpVariableNames = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
];
const smtpValues = Object.fromEntries(
  smtpVariableNames.map((name) => [name, process.env[name]?.trim() || '']),
);
const hasSmtpConfiguration = smtpVariableNames.some((name) => smtpValues[name]);
let smtp = null;

if (hasSmtpConfiguration) {
  const missingSmtpVariables = smtpVariableNames.filter((name) => !smtpValues[name]);
  if (missingSmtpVariables.length > 0) {
    throw new Error(
      `Incomplete SMTP configuration; set all of: ${smtpVariableNames.join(', ')}`,
    );
  }

  const smtpPort = Number(smtpValues.SMTP_PORT);
  if (
    !/^\d+$/.test(smtpValues.SMTP_PORT) ||
    !Number.isInteger(smtpPort) ||
    smtpPort < 1 ||
    smtpPort > 65535
  ) {
    throw new Error('SMTP_PORT must be an integer between 1 and 65535');
  }

  if (/[\s/\\@]/.test(smtpValues.SMTP_HOST)) {
    throw new Error('SMTP_HOST must be a hostname');
  }

  if (!/^(?:true|false)$/i.test(smtpValues.SMTP_SECURE)) {
    throw new Error('SMTP_SECURE must be true or false');
  }

  const smtpFromAddress = smtpValues.SMTP_FROM.replace(
    /^[^<>\r\n]*<([^<>]+)>$/,
    '$1',
  );
  if (
    /[\r\n]/.test(smtpValues.SMTP_FROM) ||
    !/^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/.test(smtpFromAddress)
  ) {
    throw new Error('SMTP_FROM must contain a valid email address');
  }

  smtp = Object.freeze({
    host: smtpValues.SMTP_HOST,
    port: smtpPort,
    secure: smtpValues.SMTP_SECURE.toLowerCase() === 'true',
    user: smtpValues.SMTP_USER,
    pass: smtpValues.SMTP_PASS,
    from: smtpValues.SMTP_FROM,
  });
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
  smtp,
});
