import { ApiError, apiRequest } from "./api-client.js";

export class PartsApiError extends ApiError {
  constructor(message, status, code) {
    super(message, status, code);
    this.name = "PartsApiError";
  }
}

async function requestParts(path, options = {}) {
  try {
    return await apiRequest(`/parts${path}`, options);
  } catch (error) {
    if (error instanceof ApiError) {
      throw new PartsApiError(error.message, error.status, error.code);
    }
    throw error;
  }
}

export async function fetchParts({ signal } = {}) {
  const data = await requestParts("", { signal });
  if (!Array.isArray(data?.parts)) {
    throw new PartsApiError(
      "The server returned an invalid parts catalog.",
      502,
      "INVALID_RESPONSE",
    );
  }
  return data.parts;
}

export async function fetchPartsRequests({ signal } = {}) {
  const data = await requestParts("/requests", { signal });
  if (!Array.isArray(data?.requests)) {
    throw new PartsApiError(
      "The server returned an invalid parts request list.",
      502,
      "INVALID_RESPONSE",
    );
  }
  return data.requests;
}

export async function createPartsRequest({ vehicleId, partId, quantity, notes }) {
  const data = await requestParts("/requests", {
    method: "POST",
    body: {
      vehicleId,
      requestedParts: [{ partId, quantity }],
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    },
  });
  if (!data?.request || typeof data.request !== "object") {
    throw new PartsApiError(
      "The server returned an invalid parts request.",
      502,
      "INVALID_RESPONSE",
    );
  }
  return data.request;
}

export async function reviewPartsRequest(id, { status, reviewNotes }) {
  const data = await requestParts(`/requests/${id}`, {
    method: "PATCH",
    body: {
      status,
      ...(reviewNotes.trim() ? { reviewNotes: reviewNotes.trim() } : {}),
    },
  });
  if (!data?.request || typeof data.request !== "object") {
    throw new PartsApiError(
      "The server returned an invalid reviewed request.",
      502,
      "INVALID_RESPONSE",
    );
  }
  return data.request;
}
