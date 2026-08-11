import assert from "node:assert/strict";
import test from "node:test";
import {
  compareVersions,
  parseVersion,
  resolveMinAppVersion,
} from "../scripts/release-version.cjs";

test("parses and compares standard plugin versions", () => {
  assert.deepEqual(parseVersion("1.2.3"), [1, 2, 3]);
  assert.equal(parseVersion("v1.2.3"), null);
  assert.ok(compareVersions("1.10.0", "1.9.9") > 0);
});

test("reuses the latest minAppVersion boundary for later plugin releases", () => {
  const versions = {
    "0.1.0": "1.4.0",
    "0.1.1": "1.12.0",
    "1.0.3": "1.12.0",
  };
  assert.equal(resolveMinAppVersion(versions, "1.1.0"), "1.12.0");
});

test("detects when a new minAppVersion boundary is missing", () => {
  const versions = { "1.0.3": "1.12.0" };
  assert.notEqual(resolveMinAppVersion(versions, "2.0.0"), "1.13.0");
});
