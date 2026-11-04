const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  EmailDeliveryError,
  createEmailService,
} = require('../services/emailService');

const resendConfig = {
  apiKey: 're_test_api_key',
  from: 'FleetCare <no-reply@example.com>',
};

test('email service sends the existing OTP template with Resend', async () => {
  const sentMessages = [];
  let apiKey;
  const service = createEmailService(resendConfig, (configuredApiKey) => {
    apiKey = configuredApiKey;
    return {
      emails: {
        async send(message) {
          sentMessages.push(message);
          return { data: { id: 'email_test_id' }, error: null };
        },
      },
    };
  });

  await service.sendOtpVerificationEmail('driver@example.com', '012345');

  assert.equal(apiKey, resendConfig.apiKey);
  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].to, 'driver@example.com');
  assert.equal(sentMessages[0].from, resendConfig.from);
  assert.equal(sentMessages[0].subject, 'Your FleetCare verification code');
  assert.match(sentMessages[0].text, /012345/);
  assert.match(sentMessages[0].html, /012345/);
});

test('Resend API failures are replaced with a safe error', async () => {
  const service = createEmailService(resendConfig, () => ({
    emails: {
      async send() {
        return {
          data: null,
          error: new Error('private API key detail and OTP 012345'),
        };
      },
    },
  }));

  await assert.rejects(
    service.sendOtpVerificationEmail('driver@example.com', '012345'),
    (error) => {
      assert.ok(error instanceof EmailDeliveryError);
      assert.equal(error.message.includes('012345'), false);
      assert.equal(error.message.includes('API key'), false);
      return true;
    },
  );
});

test('thrown Resend errors are replaced with a safe error', async () => {
  const service = createEmailService(resendConfig, () => ({
    emails: {
      async send() {
        throw new Error('private API key detail and OTP 012345');
      },
    },
  }));

  await assert.rejects(
    service.sendOtpVerificationEmail('driver@example.com', '012345'),
    (error) => {
      assert.ok(error instanceof EmailDeliveryError);
      assert.equal(error.message.includes('012345'), false);
      assert.equal(error.message.includes('API key'), false);
      return true;
    },
  );
});

test('email service reports unavailable when Resend is not configured', async () => {
  const service = createEmailService(null, () => {
    throw new Error('A Resend client must not be constructed');
  });

  await assert.rejects(
    service.sendOtpVerificationEmail('driver@example.com', '012345'),
    { message: 'Unable to deliver the verification email' },
  );
  assert.equal(service.isConfigured, false);
});
