const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;
const isProduction = process.env.NODE_ENV === "production";

export const apiBaseUrl = (
  configuredApiUrl || (isProduction ? "" : "http://localhost:5000")
).replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message, status, code, retryAfterSeconds = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function getApiBaseUrl() {
  if (!apiBaseUrl) {
    throw new ApiError(
      "NEXT_PUBLIC_API_URL must be configured for production.",
      0,
      "API_URL_NOT_CONFIGURED",
    );
  }

  let protocol;
  try {
    protocol = new URL(apiBaseUrl).protocol;
  } catch {
    throw new ApiError(
      "NEXT_PUBLIC_API_URL must be a valid URL.",
      0,
      "API_URL_INVALID",
    );
  }

  if (isProduction && protocol !== "https:") {
    throw new ApiError(
      "NEXT_PUBLIC_API_URL must use HTTPS in production.",
      0,
      "API_URL_MUST_USE_HTTPS",
    );
  }

  return apiBaseUrl;
}

export async function apiRequest(path, { method = "GET", body, signal } = {}) {
  if (typeof window === "undefined") {
    throw new ApiError("Authentication is required.", 401, "UNAUTHORIZED");
  }

  const response = await fetch(`${getApiBaseUrl()}/api${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    credentials: "include",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ...(signal ? { signal } : {}),
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(
      "The server returned an invalid response. Please try again.",
      response.status,
      "INVALID_RESPONSE",
    );
  }
  if (response.status === 401) {
    window.dispatchEvent(new Event("fleetcare:unauthorized"));
  }

  if (!response.ok || payload?.success !== true) {
    throw new ApiError(
      payload?.error?.message || "Unable to complete the request.",
      response.status,
      payload?.error?.code || "REQUEST_FAILED",
    );
  }

  return payload.data;
}
