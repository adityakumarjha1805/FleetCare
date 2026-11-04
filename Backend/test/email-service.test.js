const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  EmailDeliveryError,
  createEmailService,
} = require('../services/emailService');

const smtpConfig = {
  host: 'smtp.example.com',
  port: 587,
  secure: false,
  user: 'test-user',
  pass: 'test-password',
  from: 'FleetCare <no-reply@example.com>',
};

test('email service verifies and reuses a mocked SMTP transport', async () => {
  const sentMessages = [];
  let transportOptions;
  let verificationCount = 0;
  const service = createEmailService(smtpConfig, (options) => {
    transportOptions = options;
    return {
      async verify() {
        verificationCount += 1;
      },
      async sendMail(message) {
        sentMessages.push(message);
      },
    };
  });

  await service.verifySmtpConnection();
  await service.sendOtpVerificationEmail('driver@example.com', '012345');

  assert.equal(verificationCount, 1);
  assert.deepEqual(transportOptions, {
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: { user: smtpConfig.user, pass: smtpConfig.pass },
  });
  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].to, 'driver@example.com');
  assert.equal(sentMessages[0].from, smtpConfig.from);
  assert.match(sentMessages[0].text, /012345/);
  assert.match(sentMessages[0].html, /012345/);
});

test('email delivery failures are replaced with a safe error', async () => {
  const service = createEmailService(smtpConfig, () => ({
    async verify() {
      throw new Error('private SMTP credential detail');
    },
    async sendMail() {
      throw new Error('private SMTP credential detail and OTP 012345');
    },
  }));

  await assert.rejects(service.verifySmtpConnection(), {
    message: 'Unable to verify the SMTP connection',
  });
  await assert.rejects(
    service.sendOtpVerificationEmail('driver@example.com', '012345'),
    (error) => {
      assert.ok(error instanceof EmailDeliveryError);
      assert.equal(error.message.includes('012345'), false);
      assert.equal(error.message.includes('credential'), false);
      return true;
    },
  );
});

test('email service does not construct a transport when SMTP is unavailable', async () => {
  const service = createEmailService(null, () => {
    throw new Error('A transport must not be constructed');
  });

  await assert.rejects(service.verifySmtpConnection(), {
    message: 'Unable to verify the SMTP connection',
  });
  await assert.rejects(service.sendOtpVerificationEmail('driver@example.com', '012345'), {
    message: 'Unable to deliver the verification email',
  });
});
