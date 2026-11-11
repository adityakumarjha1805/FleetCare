import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

process.env.NEXT_PUBLIC_API_URL = "https://api.example.test";
const { fetchAdminSummary, fetchAdminUsers, updateAdminUserRole } = await import("../lib/admin-api.js");
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.window = {};
});

test("admin API loads platform summary and users with cookie credentials", async () => {
  const calls = [];
  globalThis.window = {};
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/summary")) {
      return { ok: true, status: 200, json: async () => ({ success: true, data: { users: 2, vehicles: 1 } }) };
    }
    return { ok: true, status: 200, json: async () => ({ success: true, data: { users: [] } }) };
  };
  assert.equal((await fetchAdminSummary()).users, 2);
  assert.deepEqual(await fetchAdminUsers(), []);
  assert.equal(calls.every(({ options }) => options.credentials === "include"), true);
});

test("admin API sends role updates to the protected endpoint", async () => {
  let request;
  globalThis.window = {};
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, json: async () => ({ success: true, data: { user: { id: "u1", role: "admin" } } }) };
  };
  const user = await updateAdminUserRole("u1", "admin");
  assert.equal(user.role, "admin");
  assert.equal(request.options.method, "PATCH");
  assert.deepEqual(JSON.parse(request.options.body), { role: "admin" });
});
