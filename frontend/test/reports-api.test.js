import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
globalThis.window = {};

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});

test("reports API sends date filters and parses summary data", async () => {
  let requestUrl;
  globalThis.fetch = async (url, options) => {
    requestUrl = url;
    assert.equal(options.credentials, "include");
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          success: true,
          data: {
            vehicles: { total: 0 },
            diagnostics: {},
            maintenance: {},
          },
        };
      },
    };
  };
  const { fetchReportSummary } = await import("../lib/reports-api.js");
  await fetchReportSummary({ from: "2026-01-01", to: "2026-01-31" });
  assert.match(requestUrl, /from=2026-01-01/);
  assert.match(requestUrl, /to=2026-01-31/);
});

test("report chart helper handles empty datasets", async () => {
  const { maxChartValue } = await import("../lib/reports-utils.js");
  assert.equal(maxChartValue([]), 1);
  assert.equal(maxChartValue([{ count: 4 }]), 4);
});
