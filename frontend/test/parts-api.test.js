import test from "node:test";
import assert from "node:assert/strict";

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;

function installFetch(response) {
  globalThis.window = {};
  globalThis.fetch = async (url) => {
    assert.match(url, /\/api\/parts/);
    return {
      ok: true,
      status: 200,
      async json() {
        return response;
      },
    };
  };
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) {
    delete globalThis.window;
  } else {
    globalThis.window = originalWindow;
  }
});

test("parts API parses the catalog response", async () => {
  const { fetchParts } = await import("../lib/parts-api.js");
  installFetch({
    success: true,
    data: {
      parts: [{ id: "part-1", name: "Brake pad", partNumber: "BP-1" }],
    },
  });

  const parts = await fetchParts();
  assert.equal(parts[0].partNumber, "BP-1");
});

test("parts API sends the backend request shape", async () => {
  let request;
  globalThis.window = {};
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      status: 201,
      async json() {
        return { success: true, data: { request: { id: "request-1" } } };
      },
    };
  };

  const { createPartsRequest } = await import("../lib/parts-api.js");
  const result = await createPartsRequest({
    vehicleId: "vehicle-1",
    partId: "part-1",
    quantity: 2,
    notes: "Urgent",
  });

  assert.equal(result.id, "request-1");
  assert.equal(request.options.method, "POST");
  assert.deepEqual(JSON.parse(request.options.body), {
    vehicleId: "vehicle-1",
    requestedParts: [{ partId: "part-1", quantity: 2 }],
    notes: "Urgent",
  });
  assert.equal(request.options.credentials, "include");
});

test("parts API sends admin review transitions", async () => {
  let body;
  globalThis.window = {};
  globalThis.fetch = async (url, options) => {
    body = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      async json() {
        return { success: true, data: { request: { id: "request-1", status: body.status } } };
      },
    };
  };

  const { reviewPartsRequest } = await import("../lib/parts-api.js");
  const result = await reviewPartsRequest("request-1", {
    status: "Approved",
    reviewNotes: "Ready to order internally",
  });

  assert.equal(result.status, "Approved");
  assert.deepEqual(body, {
    status: "Approved",
    reviewNotes: "Ready to order internally",
  });
});
