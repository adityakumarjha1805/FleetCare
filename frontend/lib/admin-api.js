import { ApiError, apiRequest } from "./api-client.js";

function assertObject(data, key) {
  if (!data || typeof data[key] !== "object" || data[key] === null) {
    throw new ApiError("The server returned an invalid admin response.", 502, "INVALID_RESPONSE");
  }
  return data[key];
}

export async function fetchAdminSummary() {
  const data = await apiRequest("/admin/summary");
  if (!data || typeof data !== "object") {
    throw new ApiError("The server returned an invalid admin summary.", 502, "INVALID_RESPONSE");
  }
  return data;
}

export async function fetchAdminUsers() {
  const data = await apiRequest("/admin/users");
  if (!Array.isArray(data?.users)) {
    throw new ApiError("The server returned an invalid user list.", 502, "INVALID_RESPONSE");
  }
  return data.users;
}

export async function updateAdminUserRole(id, role) {
  const data = await apiRequest(`/admin/users/${encodeURIComponent(id)}/role`, {
    method: "PATCH",
    body: { role },
  });
  return assertObject(data, "user");
}
