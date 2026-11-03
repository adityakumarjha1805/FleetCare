const mockProvider = require('./diagnosticAnalysis/providers/mockProvider');

function createDiagnosticAnalysisService(provider = mockProvider) {
  if (!provider || typeof provider.analyze !== 'function') {
    throw new TypeError('Diagnostic analysis provider must implement analyze()');
  }

  return Object.freeze({
    analyze: (diagnostic) => provider.analyze(diagnostic),
  });
}

const defaultService = createDiagnosticAnalysisService();

module.exports = {
  analyzeDiagnostic: (diagnostic) => defaultService.analyze(diagnostic),
  createDiagnosticAnalysisService,
};
