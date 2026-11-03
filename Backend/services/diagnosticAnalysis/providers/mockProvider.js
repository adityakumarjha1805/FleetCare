const knowledgeByCode = {
  P0301: {
    title: 'Cylinder 1 misfire code recorded',
    explanation:
      'This code reports that the engine control system detected a misfire associated with cylinder 1. It does not confirm the cause.',
    possibleCauses: [
      'Spark plug or ignition concern.',
      'Fuel delivery concern.',
      'A wiring, sensor, or mechanical condition requiring inspection.',
    ],
    recommendedChecks: [
      'Confirm the code and review related diagnostic data.',
      'Inspect the ignition and fuel systems using vehicle-specific service information.',
    ],
  },
};

function analyze(diagnostic) {
  const knowledge = knowledgeByCode[diagnostic.code];
  if (!knowledge) {
    return {
      provider: 'mock',
      supported: false,
      title: 'No mock reference available',
      explanation:
        'The development adapter has no reference for this code and cannot suggest a cause.',
      possibleCauses: [],
      recommendedChecks: [
        'Ask a qualified mechanic to verify the code using the vehicle manufacturer’s service information.',
      ],
      recordedSeverity: diagnostic.severity,
      severityAssessment:
        'Severity is the value entered on the diagnostic record; this adapter does not independently assess it.',
      uncertainty:
        'No code-specific mock reference is available. The code is not a confirmed fault.',
      mechanicReviewRequired: true,
      humanApprovalRequired: true,
    };
  }

  return {
    provider: 'mock',
    supported: true,
    title: knowledge.title,
    explanation: knowledge.explanation,
    possibleCauses: knowledge.possibleCauses,
    recommendedChecks: knowledge.recommendedChecks,
    recordedSeverity: diagnostic.severity,
    severityAssessment:
      'This adapter does not independently assess severity or predict vehicle failure.',
    uncertainty:
      'Possible causes are illustrative only and require vehicle-specific inspection.',
    mechanicReviewRequired: true,
    humanApprovalRequired: true,
  };
}

module.exports = { analyze };
