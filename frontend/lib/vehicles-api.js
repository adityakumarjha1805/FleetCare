import { ApiError, apiRequest } from "./api-client";

export class VehicleApiError extends ApiError {
  constructor(message, status, code) {
    super(message, status, code);
    this.name = "VehicleApiError";
  }
}

async function requestVehicles(path, { method = "GET", body, signal } = {}) {
  try {
    return await apiRequest(`/vehicles${path}`, { method, body, signal });
  } catch (error) {
    if (error instanceof ApiError) {
      throw new VehicleApiError(
        error.message.includes("Sign in again")
          ? error.message.replace(
              "to continue",
              "to manage vehicles",
            )
          : error.message,
        error.status,
        error.code,
      );
    }
    throw error;
  }
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
