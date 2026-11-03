import { ApiError, getApiBaseUrl } from "./api-client";

async function requestAuth(path, body) {
  const baseUrl = getApiBaseUrl();

  let response;
  try {
    response = await fetch(`${baseUrl}/api/auth/${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      credentials: "include",
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError(
      "Unable to reach FleetCare. Check your connection and try again.",
      0,
      "NETWORK_ERROR",
    );
  }

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

  if (!response.ok || payload?.success !== true) {
    throw new ApiError(
      payload?.error?.message || "Unable to complete the request.",
      response.status,
      payload?.error?.code || "REQUEST_FAILED",
    );
  }

  return payload.data;
}

function assertUser(user) {
  if (
    !user ||
    typeof user !== "object" ||
    typeof user.id !== "string" ||
    typeof user.name !== "string" ||
    typeof user.email !== "string"
  ) {
    throw new ApiError(
      "The server returned an invalid user profile.",
      502,
      "INVALID_RESPONSE",
    );
  }
  return user;
}

export async function registerUser({ name, email, password }) {
  const data = await requestAuth("register", { name, email, password });
  return assertUser(data?.user);
}

export async function loginUser({ email, password }) {
  const data = await requestAuth("login", { email, password });
  return assertUser(data?.user);
}

export async function fetchCurrentUser() {
  if (typeof window === "undefined") {
    throw new ApiError("Authentication is required.", 401, "UNAUTHORIZED");
  }
  const baseUrl = getApiBaseUrl();

  let response;
  try {
    response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Accept: "application/json",
      },
      credentials: "include",
    });
  } catch {
    throw new ApiError(
      "Unable to verify your session. Check your connection and try again.",
      0,
      "NETWORK_ERROR",
    );
  }

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

  if (!response.ok || payload?.success !== true) {
    throw new ApiError(
      payload?.error?.message || "Unable to verify your session.",
      response.status,
      payload?.error?.code || "REQUEST_FAILED",
    );
  }

  return assertUser(payload.data?.user);
}

export async function logoutUser() {
  await requestAuth("logout");
}
