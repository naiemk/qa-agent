import assert from "node:assert/strict";
import { test } from "node:test";
import { effectiveBaseURL, ManifestError, validateManifest } from "../../src/config/index.ts";

const base = { schemaVersion: 1, name: "t", baseURL: "http://localhost:5173", start: { attach: {} } };

test("defaults are filled and MAGPI_TEST_BASE_URL overrides baseURL", () => {
  const m = validateManifest(base, {});
  assert.equal(m.policy, "auto");
  assert.equal(m.brief, "magpi-tests/qa-brief.md");
  assert.equal(effectiveBaseURL(m, { MAGPI_TEST_BASE_URL: "http://localhost:9000/" }), "http://localhost:9000");
});

test("policy auto is refused on a non-local host not in allowedHosts (QD12)", () => {
  assert.throws(() => validateManifest({ ...base, baseURL: "http://qa-1.internal" }, {}), ManifestError);
  assert.throws(() => validateManifest(base, { MAGPI_TEST_BASE_URL: "http://qa-1.internal" }), ManifestError);
  assert.doesNotThrow(() => validateManifest({ ...base, allowedHosts: ["qa-1.internal"] }, { MAGPI_TEST_BASE_URL: "http://qa-1.internal" }));
});

test("policy auto is refused for a shared environment", () => {
  assert.throws(() => validateManifest(base, { MAGPI_TEST_ENV_KIND: "shared" }), /shared/);
  assert.doesNotThrow(() => validateManifest({ ...base, policy: "ask" }, { MAGPI_TEST_ENV_KIND: "shared" }));
});

test("start is required", () => {
  assert.throws(() => validateManifest({ ...base, start: undefined }, {}), /start/);
});
