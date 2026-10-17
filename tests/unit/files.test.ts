import assert from "node:assert/strict";
import { symlink } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { AnswerKeyError, fileAccess } from "../../src/files/index.ts";
import { tempTarget } from "../helpers.ts";

test("answer-key files are refused and never listed", async () => {
  const { root, cleanup } = await tempTarget("target-basic");
  try {
    const files = fileAccess(root, ["e2e/*.spec.ts"]);
    await assert.rejects(files.read("e2e/order.spec.ts"), AnswerKeyError);
    const listed = await files.list(["e2e/**"]);
    assert.deepEqual(listed, ["e2e/helpers/wallet.ts"]);
    assert.match(await files.read("e2e/helpers/wallet.ts"), /fundWallet/);
  } finally {
    await cleanup();
  }
});

test("a symlink to an answer-key file is refused by real path", async () => {
  const { root, cleanup } = await tempTarget("target-basic");
  try {
    await symlink(path.join(root, "e2e/order.spec.ts"), path.join(root, "src/innocent.ts"));
    await assert.rejects(fileAccess(root, ["e2e/*.spec.ts"]).read("src/innocent.ts"), AnswerKeyError);
  } finally {
    await cleanup();
  }
});

test("paths outside the target are refused", async () => {
  const { root, cleanup } = await tempTarget("target-basic");
  try {
    await assert.rejects(fileAccess(root, []).read("../../package.json"), /outside/);
  } finally {
    await cleanup();
  }
});
