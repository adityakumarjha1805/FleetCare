import { ApiError, apiRequest } from "./api-client.js";

export class ReportsApiError extends ApiError {
  constructor(message, status, code) {
    super(message, status, code);
    this.name = "ReportsApiError";
  }
}

export async function fetchReportSummary({ from = "", to = "", signal } = {}) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  try {
    const data = await apiRequest(
      `/reports/summary${params.toString() ? `?${params}` : ""}`,
      { signal },
    );
    if (!data?.vehicles || !data?.diagnostics || !data?.maintenance) {
      throw new ReportsApiError(
        "The server returned an invalid report.",
        502,
        "INVALID_RESPONSE",
      );
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError && !(error instanceof ReportsApiError)) {
      throw new ReportsApiError(error.message, error.status, error.code);
    }
    throw error;
  }
}
