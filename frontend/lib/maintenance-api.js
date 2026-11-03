import { ApiError, apiRequest } from "./api-client";

export async function fetchMaintenance({ signal } = {}) {
  const data = await apiRequest("/maintenance", { signal });
  if (!Array.isArray(data?.maintenance)) {
    throw new ApiError(
      "The server returned an invalid maintenance list.",
      502,
      "INVALID_RESPONSE",
    );
  }
  return data.maintenance;
}

export async function createMaintenance(record) {
  const data = await apiRequest("/maintenance", {
    method: "POST",
    body: record,
  });
  if (!data?.maintenance || typeof data.maintenance !== "object") {
    throw new ApiError(
      "The server returned an invalid maintenance record.",
      502,
      "INVALID_RESPONSE",
    );
  }
  return data.maintenance;
}

export async function completeMaintenance(id) {
  const data = await apiRequest(`/maintenance/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { status: "Completed" },
  });
  if (!data?.maintenance || typeof data.maintenance !== "object") {
    throw new ApiError(
      "The server returned an invalid maintenance record.",
      502,
      "INVALID_RESPONSE",
    );
  }
  return data.maintenance;
}
