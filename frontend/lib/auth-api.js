import { ApiError, getApiBaseUrl } from "./api-client.js";

let currentUserRequest;

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
    const retryAfter = Number(response.headers.get("Retry-After"));
    throw new ApiError(
      payload?.error?.message || "Unable to complete the request.",
      response.status,
      payload?.error?.code || "REQUEST_FAILED",
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
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

export function getAuthErrorMessage(error) {
  return error instanceof ApiError
    ? error.message
    : "Unable to continue. Please try again.";
}

export async function loginUser({ email, password }) {
  const data = await requestAuth("login", { email, password });
  const user = assertUser(data?.user);
  window.dispatchEvent(new Event("fleetcare:session-authenticated"));
  return user;
}

export function fetchCurrentUser() {
  if (typeof window === "undefined") {
    return Promise.reject(
      new ApiError("Authentication is required.", 401, "UNAUTHORIZED"),
    );
  }

  if (currentUserRequest) return currentUserRequest;

  const request = (async () => {
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
  })();

  currentUserRequest = request.finally(() => {
    currentUserRequest = null;
  });
  return currentUserRequest;
}

export async function logoutUser() {
  try {
    await requestAuth("logout");
  } catch (error) {
    if (error.status === 401) {
      window.dispatchEvent(new Event("fleetcare:unauthorized"));
    }
    throw error;
  }
  window.dispatchEvent(new Event("fleetcare:session-ended"));
}
