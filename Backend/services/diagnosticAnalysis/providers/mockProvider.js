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
      summary:
        'The development adapter has no reference for this code and cannot suggest a cause.',
      severity: diagnostic.severity,
      recommendedChecks: [
        'Ask a qualified mechanic to verify the code using the vehicle manufacturer’s service information.',
      ],
      recommendedInspectionSteps: [
        'Ask a qualified mechanic to verify the code using the vehicle manufacturer’s service information.',
      ],
      suggestedMaintenanceActions: [],
      confidenceLevel: 'Low',
      safetyWarnings: ['Do not operate an unsafe vehicle until it has been inspected.'],
      limitationsAndDisclaimer:
        'This is advisory information only, not a confirmed mechanical diagnosis.',
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
    summary: knowledge.explanation,
    severity: diagnostic.severity,
    recommendedChecks: knowledge.recommendedChecks,
    recommendedInspectionSteps: knowledge.recommendedChecks,
    suggestedMaintenanceActions: [],
    confidenceLevel: 'Low',
    safetyWarnings: ['Stop driving and seek qualified help if warning signs worsen.'],
    limitationsAndDisclaimer:
      'This is advisory information only, not a confirmed mechanical diagnosis.',
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
