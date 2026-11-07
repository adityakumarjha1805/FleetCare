import assert from "node:assert/strict";
import { test } from "node:test";

const { getSafeReturnPath } = await import("../lib/safe-return-path.js");

test("safe return paths allow known protected FleetCare routes", () => {
  assert.equal(getSafeReturnPath("/vehicles"), "/vehicles");
  assert.equal(
    getSafeReturnPath("/diagnostics?view=recent"),
    "/diagnostics?view=recent",
  );
});

test("safe return paths reject external, malformed, and unapproved destinations", () => {
  for (const value of [
    "https://outside.example/",
    "//outside.example/",
    "/\\outside.example",
    "/login",
    "/",
    "/unknown",
    null,
  ]) {
    assert.equal(getSafeReturnPath(value), null);
  }
});
