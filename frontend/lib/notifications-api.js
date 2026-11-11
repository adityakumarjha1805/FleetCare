import { ApiError, apiRequest } from "./api-client.js";

export class NotificationsApiError extends ApiError {
  constructor(message, status, code) {
    super(message, status, code);
    this.name = "NotificationsApiError";
  }
}

async function requestNotifications(path, options = {}) {
  try {
    return await apiRequest(`/notifications${path}`, options);
  } catch (error) {
    if (error instanceof ApiError) {
      throw new NotificationsApiError(error.message, error.status, error.code);
    }
    throw error;
  }
}

export async function fetchNotifications({ signal } = {}) {
  const data = await requestNotifications("", { signal });
  if (!Array.isArray(data?.notifications)) {
    throw new NotificationsApiError(
      "The server returned an invalid notification list.",
      502,
      "INVALID_RESPONSE",
    );
  }
  return data.notifications;
}

export async function fetchUnreadNotificationCount({ signal } = {}) {
  const data = await requestNotifications("/unread-count", { signal });
  if (!Number.isInteger(data?.count) || data.count < 0) {
    throw new NotificationsApiError(
      "The server returned an invalid notification count.",
      502,
      "INVALID_RESPONSE",
    );
  }
  return data.count;
}

export async function markNotificationRead(id) {
  const data = await requestNotifications(`/${id}/read`, { method: "PATCH" });
  return data.notification;
}

export async function markAllNotificationsRead() {
  const data = await requestNotifications("/read-all", {
    method: "POST",
    body: {},
  });
  return data.updated;
}
