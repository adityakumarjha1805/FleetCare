import { ApiError, getApiBaseUrl } from "./api-client";

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

function assertVerificationChallenge(data) {
  if (
    !data ||
    data.verificationRequired !== true ||
    typeof data.challengeId !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(data.challengeId)
  ) {
    throw new ApiError(
      "The server returned an invalid verification challenge.",
      502,
      "INVALID_RESPONSE",
    );
  }
  return data;
}

export async function registerUser({ name, email, password }) {
  const data = await requestAuth("register", { name, email, password });
  return assertVerificationChallenge(data);
}

export async function loginUser({ email, password }) {
  const data = await requestAuth("login", { email, password });
  return assertVerificationChallenge(data);
}

export async function verifyEmailOtp({ challengeId, otp }) {
  const data = await requestAuth("verify-otp", { challengeId, otp });
  const user = assertUser(data?.user);
  window.dispatchEvent(new Event("fleetcare:session-authenticated"));
  return user;
}

export async function resendEmailOtp(challengeId) {
  const data = await requestAuth("resend-otp", { challengeId });
  if (!data || data.verificationRequired !== true) {
    throw new ApiError(
      "The server returned an invalid resend response.",
      502,
      "INVALID_RESPONSE",
    );
  }
  return data;
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
