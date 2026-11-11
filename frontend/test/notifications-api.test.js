import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
globalThis.window = {};

function response(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return { success: true, data };
    },
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});

test("notification API reads list and unread count", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return url.endsWith("unread-count")
      ? response({ count: 2 })
      : response({ notifications: [{ id: "n1", read: false }] });
  };
  const { fetchNotifications, fetchUnreadNotificationCount } = await import(
    "../lib/notifications-api.js"
  );

  assert.equal((await fetchNotifications())[0].id, "n1");
  assert.equal(await fetchUnreadNotificationCount(), 2);
  assert.equal(calls[0].options.credentials, "include");
});

test("notification API marks one and all notifications read", async () => {
  const calls = [];
  globalThis.window = {};
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return response(url.endsWith("/read") ? { notification: { id: "n1", read: true } } : { updated: 2 });
  };
  const { markAllNotificationsRead, markNotificationRead } = await import(
    "../lib/notifications-api.js"
  );

  assert.equal((await markNotificationRead("n1")).read, true);
  assert.equal(await markAllNotificationsRead(), 2);
  assert.equal(calls[0].options.method, "PATCH");
  assert.equal(calls[1].options.method, "POST");
});
