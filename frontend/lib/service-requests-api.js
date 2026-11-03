import { ApiError, apiRequest } from "./api-client";

function assertRequest(data) {
  if (!data?.request || typeof data.request !== "object") {
    throw new ApiError(
      "The server returned an invalid service request.",
      502,
      "INVALID_RESPONSE",
    );
  }
  return data.request;
}

export async function fetchServiceRequests({ signal } = {}) {
  const data = await apiRequest("/service-requests", { signal });
  if (!Array.isArray(data?.requests)) {
    throw new ApiError(
      "The server returned an invalid service request list.",
      502,
      "INVALID_RESPONSE",
    );
  }
  return data.requests;
}

export async function createServiceRequest(request) {
  const data = await apiRequest("/service-requests", {
    method: "POST",
    body: request,
  });
  return assertRequest(data);
}

export async function updateServiceRequest(id, request) {
  const data = await apiRequest(
    `/service-requests/${encodeURIComponent(id)}`,
    { method: "PUT", body: request },
  );
  return assertRequest(data);
}

export async function transitionServiceRequest(id, status) {
  const data = await apiRequest(
    `/service-requests/${encodeURIComponent(id)}`,
    { method: "PATCH", body: { status } },
  );
  return assertRequest(data);
}

export async function cancelServiceRequest(id) {
  const data = await apiRequest(
    `/service-requests/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  return assertRequest(data);
}
