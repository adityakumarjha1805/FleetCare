const { GoogleGenAI } = require('@google/genai');

const analysisSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    possibleCauses: { type: 'array', items: { type: 'string' } },
    severity: { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low'] },
    recommendedInspectionSteps: { type: 'array', items: { type: 'string' } },
    suggestedMaintenanceActions: { type: 'array', items: { type: 'string' } },
    confidenceLevel: { type: 'string', enum: ['Low', 'Medium', 'High'] },
    safetyWarnings: { type: 'array', items: { type: 'string' } },
    limitationsAndDisclaimer: { type: 'string' },
  },
  required: [
    'summary',
    'possibleCauses',
    'severity',
    'recommendedInspectionSteps',
    'suggestedMaintenanceActions',
    'confidenceLevel',
    'safetyWarnings',
    'limitationsAndDisclaimer',
  ],
};

const maxItems = 8;
const maxTextLength = 1000;

class DiagnosticProviderError extends Error {
  constructor(message, statusCode = 503, code = 'AI_PROVIDER_ERROR') {
    super(message);
    this.name = 'DiagnosticProviderError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function parseProviderMessage(error) {
  if (typeof error?.message !== 'string') return {};
  try {
    const parsed = JSON.parse(error.message);
    return parsed && typeof parsed.error === 'object' ? parsed.error : {};
  } catch {
    return {};
  }
}

function safeProviderMessage(error, apiKey) {
  const providerError = parseProviderMessage(error);
  const message = providerError.message || error?.message || 'Unknown provider error';
  return String(message)
    .replace(apiKey, '[REDACTED]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/https?:\/\/\S+/gi, '[URL_REDACTED]')
    .slice(0, 500);
}

function getProviderErrorDetails(error, apiKey) {
  const providerError = parseProviderMessage(error);
  const status = Number(error?.status || error?.statusCode || providerError.code);
  return {
    errorName: error?.name || 'Error',
    httpStatus: Number.isInteger(status) ? status : null,
    geminiErrorCode:
      providerError.status || providerError.code || error?.code || null,
    safeMessage: safeProviderMessage(error, apiKey),
  };
}

function logProviderError(logger, error, { apiKey, model, requestId }) {
  logger.error(
    JSON.stringify({
      event: 'gemini_diagnostic_provider_error',
      ...getProviderErrorDetails(error, apiKey),
      model,
      requestId,
    }),
  );
}

function cleanText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new DiagnosticProviderError(
      `Gemini returned an invalid ${field}`,
      502,
      'AI_INVALID_RESPONSE',
    );
  }
  return value.trim().slice(0, maxTextLength);
}

function cleanList(value, field) {
  if (!Array.isArray(value)) {
    throw new DiagnosticProviderError(
      `Gemini returned an invalid ${field}`,
      502,
      'AI_INVALID_RESPONSE',
    );
  }
  return value
    .slice(0, maxItems)
    .map((item) => cleanText(item, field))
    .filter(Boolean);
}

function normalizeAnalysis(value, diagnostic) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DiagnosticProviderError(
      'Gemini returned an invalid analysis object',
      502,
      'AI_INVALID_RESPONSE',
    );
  }
  const severity = ['Critical', 'High', 'Medium', 'Low'].includes(value.severity)
    ? value.severity
    : diagnostic.severity;
  const confidenceLevel = ['Low', 'Medium', 'High'].includes(
    value.confidenceLevel,
  )
    ? value.confidenceLevel
    : 'Low';
  const summary = cleanText(value.summary, 'summary');
  const possibleCauses = cleanList(value.possibleCauses, 'possible causes');
  const recommendedInspectionSteps = cleanList(
    value.recommendedInspectionSteps,
    'inspection steps',
  );
  const suggestedMaintenanceActions = cleanList(
    value.suggestedMaintenanceActions,
    'maintenance actions',
  );
  const safetyWarnings = cleanList(value.safetyWarnings, 'safety warnings');
  const limitationsAndDisclaimer = cleanText(
    value.limitationsAndDisclaimer,
    'limitations and disclaimer',
  );

  return {
    provider: 'gemini',
    supported: true,
    title: 'Gemini advisory analysis',
    explanation: summary,
    summary,
    possibleCauses,
    severity,
    recommendedInspectionSteps,
    recommendedChecks: recommendedInspectionSteps,
    suggestedMaintenanceActions,
    confidenceLevel,
    safetyWarnings,
    limitationsAndDisclaimer,
    recordedSeverity: diagnostic.severity,
    severityAssessment: `Gemini assessed this advisory as ${severity}; a qualified mechanic must confirm it.`,
    uncertainty: limitationsAndDisclaimer,
    mechanicReviewRequired: true,
    humanApprovalRequired: true,
  };
}

function parseResponseText(response) {
  const text =
    typeof response?.text === 'string'
      ? response.text
      : typeof response?.text === 'function'
        ? response.text()
        : response?.candidates?.[0]?.content?.parts
            ?.map((part) => part.text || '')
            .join('');
  if (typeof text !== 'string' || !text.trim()) {
    throw new DiagnosticProviderError(
      'Gemini returned an empty response',
      502,
      'AI_EMPTY_RESPONSE',
    );
  }
  return text.replace(/^```(?:json)?\s*|\s*```$/gi, '').trim();
}

function isRetryable(error) {
  const providerError = parseProviderMessage(error);
  const status = Number(
    error?.status || error?.statusCode || providerError.code,
  );
  return (
    status === 408 ||
    status === 429 ||
    status >= 500 ||
    /timeout|temporar|unavailable|quota|rate.?limit/i.test(error?.message || '')
  );
}

function withTimeout(promise, timeoutMs) {
  let timeout;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeout = setTimeout(
        () =>
          reject(
            new DiagnosticProviderError(
              'Gemini request timed out',
              504,
              'AI_PROVIDER_TIMEOUT',
            ),
          ),
        timeoutMs,
      );
    }),
  ]).finally(() => clearTimeout(timeout));
}

function createGeminiProvider({
  apiKey,
  model = 'gemini-3.5-flash',
  timeoutMs = 15000,
  maxRetries = 1,
  clientFactory = (key) => new GoogleGenAI({ apiKey: key }),
  logger = console,
} = {}) {
  if (!apiKey) {
    throw new TypeError('Gemini provider requires an API key');
  }
  const client = clientFactory(apiKey);

  return {
    async analyze(diagnostic, { requestId = 'unknown' } = {}) {
      const prompt = [
        'You are an automotive diagnostic assistant. Produce advisory information only.',
        'Never claim a confirmed mechanical diagnosis. Do not recommend external actions, purchases, or record changes.',
        'Use only the supplied diagnostic and vehicle information. Return JSON matching the requested schema.',
        'Diagnostic:',
        JSON.stringify(diagnostic),
      ].join('\n');

      let response;
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
          response = await withTimeout(
            client.models.generateContent({
              model,
              contents: prompt,
              config: {
                responseMimeType: 'application/json',
                responseSchema: analysisSchema,
              },
            }),
            timeoutMs,
          );
          break;
        } catch (error) {
          if (attempt >= maxRetries || !isRetryable(error)) {
            logProviderError(logger, error, { apiKey, model, requestId });
            if (error instanceof DiagnosticProviderError) throw error;
            const providerError = parseProviderMessage(error);
            const status = Number(
              error?.status || error?.statusCode || providerError.code,
            );
            throw new DiagnosticProviderError(
              status === 429
                ? 'Gemini rate limit or quota was reached'
                : 'Gemini analysis is temporarily unavailable',
              status === 429 ? 429 : 503,
              status === 429 ? 'AI_RATE_LIMITED' : 'AI_PROVIDER_ERROR',
            );
          }
          await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
        }
      }

      let parsed;
      try {
        parsed = JSON.parse(parseResponseText(response));
      } catch (error) {
        logProviderError(logger, error, { apiKey, model, requestId });
        throw new DiagnosticProviderError(
          'Gemini returned malformed JSON',
          502,
          'AI_INVALID_RESPONSE',
        );
      }
      try {
        return normalizeAnalysis(parsed, diagnostic);
      } catch (error) {
        logProviderError(logger, error, { apiKey, model, requestId });
        throw error;
      }
    },
  };
}

module.exports = {
  DiagnosticProviderError,
  analysisSchema,
  createGeminiProvider,
  normalizeAnalysis,
};
