const { Resend } = require('resend');
const config = require('../config/env');

class EmailDeliveryError extends Error {
  constructor() {
    super('Unable to deliver the verification email');
    this.name = 'EmailDeliveryError';
  }
}

function createEmailService(
  resendConfig,
  createResendClient = (apiKey) => new Resend(apiKey),
) {
  let resend;

  function getResendClient() {
    if (!resendConfig) {
      throw new Error('Resend is not configured');
    }

    if (!resend) {
      resend = createResendClient(resendConfig.apiKey);
    }

    return resend;
  }

  async function sendOtpVerificationEmail(recipient, code) {
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      throw new TypeError('OTP must be a six-digit string');
    }

    try {
      const { error } = await getResendClient().emails.send({
        from: resendConfig.from,
        to: recipient,
        subject: 'Your FleetCare verification code',
        text: `Your FleetCare verification code is ${code}. It expires in 5 minutes.`,
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#172033"><h1 style="color:#176b57">FleetCare</h1><p>Use this verification code to continue:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px">${code}</p><p>This code expires in 5 minutes. If you did not request it, you can ignore this email.</p></div>`,
      });
      if (error) {
        throw new EmailDeliveryError();
      }
    } catch {
      throw new EmailDeliveryError();
    }
  }

  return {
    isConfigured: Boolean(resendConfig),
    sendOtpVerificationEmail,
  };
}

module.exports = {
  EmailDeliveryError,
  createEmailService,
  ...createEmailService(config.resend),
};
