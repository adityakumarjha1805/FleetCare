const mockProvider = require('./diagnosticAnalysis/providers/mockProvider');
const config = require('../config/env');
const { createGeminiProvider } = require('./diagnosticAnalysis/providers/geminiProvider');

function createDiagnosticAnalysisService(provider) {
  const selectedProvider =
    provider ||
    (config.diagnosticAiProvider === 'gemini'
      ? createGeminiProvider({
          apiKey: config.geminiApiKey,
          model: config.geminiModel,
        })
      : mockProvider);
  if (!selectedProvider || typeof selectedProvider.analyze !== 'function') {
    throw new TypeError('Diagnostic analysis provider must implement analyze()');
  }

  return Object.freeze({
    analyze: (diagnostic, context) => selectedProvider.analyze(diagnostic, context),
  });
}

const defaultService = createDiagnosticAnalysisService();

module.exports = {
  analyzeDiagnostic: (diagnostic) => defaultService.analyze(diagnostic),
  createDiagnosticAnalysisService,
  providerStatus: {
    provider: config.diagnosticAiProvider,
    configured: config.diagnosticAiProvider === 'gemini',
    model: config.diagnosticAiProvider === 'gemini' ? config.geminiModel : null,
  },
};
