const nodemailer = require('nodemailer');
const config = require('../config/env');

class EmailDeliveryError extends Error {
  constructor() {
    super('Unable to deliver the verification email');
    this.name = 'EmailDeliveryError';
  }
}

function createEmailService(
  smtpConfig,
  createTransport = nodemailer.createTransport,
) {
  let transport;

  function getTransport() {
    if (!smtpConfig) {
      throw new Error('SMTP is not configured');
    }

    if (!transport) {
      transport = createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
          user: smtpConfig.user,
          pass: smtpConfig.pass,
        },
      });
    }

    return transport;
  }

  async function verifySmtpConnection() {
    try {
      await getTransport().verify();
    } catch {
      throw new Error('Unable to verify the SMTP connection');
    }
  }

  async function sendOtpVerificationEmail(recipient, code) {
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      throw new TypeError('OTP must be a six-digit string');
    }

    try {
      await getTransport().sendMail({
        from: smtpConfig.from,
        to: recipient,
        subject: 'Your FleetCare verification code',
        text: `Your FleetCare verification code is ${code}. It expires in 5 minutes.`,
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#172033"><h1 style="color:#176b57">FleetCare</h1><p>Use this verification code to continue:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px">${code}</p><p>This code expires in 5 minutes. If you did not request it, you can ignore this email.</p></div>`,
      });
    } catch {
      throw new EmailDeliveryError();
    }
  }

  return {
    isConfigured: Boolean(smtpConfig),
    verifySmtpConnection,
    sendOtpVerificationEmail,
  };
}

module.exports = {
  EmailDeliveryError,
  createEmailService,
  ...createEmailService(config.smtp),
};
