const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

export class VehicleApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "VehicleApiError";
    this.status = status;
    this.code = code;
  }
}

function getAccessToken() {
  if (typeof window === "undefined") {
    throw new VehicleApiError("Authentication is required.", 401, "UNAUTHORIZED");
  }

  const token = window.localStorage.getItem("accessToken");
  if (!token) {
    throw new VehicleApiError(
      "Your session is missing or expired. Sign in again to manage vehicles.",
      401,
      "UNAUTHORIZED",
    );
  }

  return token;
}

async function requestVehicles(path, { method = "GET", body, signal } = {}) {
  const token = getAccessToken();
  const response = await fetch(`${apiBaseUrl}/api/vehicles${path}`, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ...(signal ? { signal } : {}),
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new VehicleApiError(
      "The server returned an invalid response. Please try again.",
      response.status,
      "INVALID_RESPONSE",
    );
  }

  if (response.status === 401) {
    window.localStorage.removeItem("accessToken");
  }

  if (!response.ok || payload?.success !== true) {
    throw new VehicleApiError(
      payload?.error?.message || "Unable to complete the vehicle request.",
      response.status,
      payload?.error?.code || "REQUEST_FAILED",
    );
  }

  return payload.data;
}

export async function fetchVehicles({ signal } = {}) {
  const data = await requestVehicles("", { signal });
  if (!Array.isArray(data?.vehicles)) {
    throw new VehicleApiError(
      "The server returned an invalid vehicle list.",
      502,
      "INVALID_RESPONSE",
    );
  }
  return data.vehicles;
}

export async function createVehicle(vehicle) {
  const data = await requestVehicles("", {
    method: "POST",
    body: vehicle,
  });
  if (!data?.vehicle || typeof data.vehicle !== "object") {
    throw new VehicleApiError(
      "The server returned an invalid vehicle record.",
      502,
      "INVALID_RESPONSE",
    );
  }
  return data.vehicle;
}
