const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  DiagnosticProviderError,
  createGeminiProvider,
  normalizeAnalysis,
} = require('../services/diagnosticAnalysis/providers/geminiProvider');

const diagnostic = {
  code: 'P0301',
  severity: 'High',
  description: 'Engine warning light is on',
  vehicle: { make: 'FleetCare', model: 'Transit', year: 2024 },
};

function validResponse(overrides = {}) {
  return {
    summary: 'A misfire was detected and requires inspection.',
    possibleCauses: ['Ignition concern', 'Fuel delivery concern'],
    severity: 'High',
    recommendedInspectionSteps: ['Inspect ignition components.'],
    suggestedMaintenanceActions: ['Follow manufacturer service guidance.'],
    confidenceLevel: 'Medium',
    safetyWarnings: ['Stop if the vehicle runs roughly or loses power.'],
    limitationsAndDisclaimer:
      'This is advisory information, not a confirmed diagnosis.',
    ...overrides,
  };
}

test('normalizes a mocked Gemini JSON response into the API contract', async () => {
  const provider = createGeminiProvider({
    apiKey: 'test-key',
    clientFactory: () => ({
      models: {
        generateContent: async () => ({
          text: JSON.stringify(validResponse()),
        }),
      },
    }),
  });

  const analysis = await provider.analyze(diagnostic);
  assert.equal(analysis.provider, 'gemini');
  assert.equal(analysis.summary, 'A misfire was detected and requires inspection.');
  assert.deepEqual(analysis.recommendedChecks, [
    'Inspect ignition components.',
  ]);
  assert.equal(analysis.humanApprovalRequired, true);
});

test('rejects malformed, empty, and untrusted-shaped Gemini output', async () => {
  assert.throws(
    () => normalizeAnalysis({ summary: 'bad' }, diagnostic),
    (error) =>
      error instanceof DiagnosticProviderError &&
      error.code === 'AI_INVALID_RESPONSE',
  );

  const provider = createGeminiProvider({
    apiKey: 'test-key',
    clientFactory: () => ({
      models: {
        generateContent: async () => ({ text: 'not json' }),
      },
    }),
  });
  await assert.rejects(
    provider.analyze(diagnostic),
    (error) => error.code === 'AI_INVALID_RESPONSE',
  );
});

test('does not silently fall back when Gemini is unavailable', async () => {
  const logs = [];
  const provider = createGeminiProvider({
    apiKey: 'test-key',
    maxRetries: 0,
    model: 'gemini-test-model',
    logger: { error: (message) => logs.push(message) },
    clientFactory: () => ({
      models: {
        generateContent: async () => {
          const error = new Error(
            JSON.stringify({
              error: {
                code: 404,
                status: 'NOT_FOUND',
                message: 'Model unavailable for this API key: test-key',
              },
            }),
          );
          error.name = 'ApiError';
          error.status = 404;
          throw error;
        },
      },
    }),
  });

  await assert.rejects(
    provider.analyze(diagnostic),
    (error) =>
      error instanceof DiagnosticProviderError &&
      error.statusCode === 503 &&
      error.code === 'AI_PROVIDER_ERROR' &&
      error.message === 'Gemini analysis is temporarily unavailable',
  );
  assert.equal(logs.length, 1);
  const log = JSON.parse(logs[0]);
  assert.equal(log.errorName, 'ApiError');
  assert.equal(log.httpStatus, 404);
  assert.equal(log.geminiErrorCode, 'NOT_FOUND');
  assert.equal(log.model, 'gemini-test-model');
  assert.equal(log.requestId, 'unknown');
  assert.match(log.safeMessage, /Model unavailable/);
  assert.doesNotMatch(log.safeMessage, /test-key/);
});
