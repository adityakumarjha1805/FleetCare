const sampleCodeKnowledge = {
  P0301: {
    title: "Cylinder 1 Misfire Detected",
    explanation:
      "The engine control system has detected a misfire associated with cylinder 1.",
    possibleCauses: [
      "Faulty spark plug.",
      "Ignition coil issue.",
      "Fuel delivery problem.",
    ],
    recommendedNextSteps: [
      "Confirm the code and inspect related diagnostic data with a qualified technician.",
      "Arrange a qualified mechanic inspection before deciding on repairs.",
    ],
    suggestedMaintenance: [
      "Ask a qualified mechanic to inspect the cylinder 1 spark plug.",
      "Have the ignition coil and fuel delivery checked as part of diagnosis.",
    ],
    mechanicInspectionRecommended: true,
  },
};

export function getSampleCodeKnowledge(code) {
  return sampleCodeKnowledge[code.trim().toUpperCase()] ?? null;
}

export function analyzeSampleDiagnostic(record) {
  const codeKnowledge = getSampleCodeKnowledge(record.code);

  if (!codeKnowledge) {
    return {
      supported: false,
      title: "Code explanation unavailable",
      explanation:
        "This sample assistant does not have a reference explanation for this code. No fault cause or code-specific maintenance action can be suggested.",
      possibleCauses: [],
      severityAssessment: `The diagnostic record is labeled ${record.severity}. This is the record's sample severity, not an independent AI assessment.`,
      recommendedNextSteps: [
        "Ask a qualified mechanic to verify the code using the vehicle manufacturer's service information.",
      ],
      suggestedMaintenance: [],
      mechanicInspectionRecommended: true,
    };
  }

  return {
    supported: true,
    ...codeKnowledge,
    severityAssessment: `The diagnostic record is labeled ${record.severity}. This sample response does not independently confirm severity or predict vehicle failure.`,
  };
}
