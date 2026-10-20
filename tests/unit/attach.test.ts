import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { test } from "node:test";
import { validateManifest } from "../../src/config/index.ts";
import { attachEnv, EnvNotReadyError, EnvResetError, waitReady } from "../../src/stack/index.ts";
import { tempDir } from "../helpers.ts";

const manifest = validateManifest({ schemaVersion: 1, name: "t", baseURL: "http://localhost:5173", start: { attach: {} } }, {});

test("attachEnv reads the env contract and has no reset when unset", async () => {
  const dir = await tempDir();
  const env = attachEnv(manifest, { targetRoot: dir, logsDir: dir, env: { MAGPI_TEST_BASE_URL: "http://127.0.0.1:1234", MAGPI_TEST_READY_URL: "http://127.0.0.1:1234/health" } });
  assert.equal(env.baseURL, "http://127.0.0.1:1234");
  assert.equal(env.readyURL, "http://127.0.0.1:1234/health");
  assert.equal(env.reset, undefined);
  assert.deepEqual(env.replayEnv, { MAGPI_TEST_BASE_URL: "http://127.0.0.1:1234" });
});

test("reset runs the command from the target root and logs; non-zero exit throws", async () => {
  const dir = await tempDir();
  const ok = attachEnv(manifest, { targetRoot: dir, logsDir: dir, env: { MAGPI_TEST_RESET_CMD: "pwd && echo reset-ran" } });
  await ok.reset!();
  const log = await readFile(path.join(dir, "reset.log"), "utf8");
  assert.match(log, /reset-ran/);
  const bad = attachEnv(manifest, { targetRoot: dir, logsDir: dir, env: { MAGPI_TEST_RESET_CMD: "exit 3" } });
  await assert.rejects(bad.reset!(), EnvResetError);
});

test("waitReady accepts any status below 500 and times out otherwise", async () => {
  let status = 503;
  const server = createServer((_, res) => res.writeHead(status).end()).listen(0);
  const port = (server.address() as { port: number }).port;
  try {
    await assert.rejects(waitReady(`http://127.0.0.1:${port}`, 300, 50), EnvNotReadyError);
    status = 404;
    await waitReady(`http://127.0.0.1:${port}`, 1000, 50);
  } finally {
    server.close();
  }
});
