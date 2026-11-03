import { ApiError, apiRequest } from "./api-client";

function assertDiagnostics(data) {
  if (!Array.isArray(data?.diagnostics)) {
    throw new ApiError(
      "The server returned an invalid diagnostic list.",
      502,
      "INVALID_RESPONSE",
    );
  }
  return data.diagnostics;
}

export async function fetchDiagnostics({ signal } = {}) {
  const data = await apiRequest("/diagnostics", { signal });
  return assertDiagnostics(data);
}

export async function createDiagnostic(diagnostic) {
  const data = await apiRequest("/diagnostics", {
    method: "POST",
    body: diagnostic,
  });
  if (!data?.diagnostic || typeof data.diagnostic !== "object") {
    throw new ApiError(
      "The server returned an invalid diagnostic record.",
      502,
      "INVALID_RESPONSE",
    );
  }
  return data.diagnostic;
}

export async function resolveDiagnostic(id) {
  const data = await apiRequest(`/diagnostics/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { status: "Resolved" },
  });
  if (!data?.diagnostic || typeof data.diagnostic !== "object") {
    throw new ApiError(
      "The server returned an invalid diagnostic record.",
      502,
      "INVALID_RESPONSE",
    );
  }
  return data.diagnostic;
}

export async function analyzeDiagnostic(id) {
  const data = await apiRequest(
    `/diagnostics/${encodeURIComponent(id)}/analyze`,
    { method: "POST" },
  );
  const analysis = data?.analysis;
  if (
    !analysis ||
    typeof analysis !== "object" ||
    typeof analysis.provider !== "string" ||
    typeof analysis.supported !== "boolean" ||
    typeof analysis.title !== "string" ||
    typeof analysis.explanation !== "string" ||
    !Array.isArray(analysis.possibleCauses) ||
    !Array.isArray(analysis.recommendedChecks) ||
    typeof analysis.recordedSeverity !== "string" ||
    typeof analysis.severityAssessment !== "string" ||
    typeof analysis.uncertainty !== "string" ||
    typeof analysis.mechanicReviewRequired !== "boolean" ||
    typeof analysis.humanApprovalRequired !== "boolean"
  ) {
    throw new ApiError(
      "The server returned an invalid diagnostic analysis.",
      502,
      "INVALID_RESPONSE",
    );
  }
  return analysis;
}
