import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { ModelOutputError, parseJsonText } from "../../src/model/index.ts";
import { fakeModel } from "../../src/model/fake.ts";
import { openRouterClient, stripProvider } from "../../src/model/openrouter.ts";
import { tempDir } from "../helpers.ts";

const request = { purpose: "t", system: "s", user: "u", schemaHint: "{}", validate: (v: unknown) => ((v as { ok?: boolean }).ok ? [] : ["ok must be true"]) };

test("retries once with validation errors, then succeeds", async () => {
  const model = fakeModel([{ ok: false }, "```json\n{\"ok\": true}\n```"]);
  const { value, usage } = await model.completeJson<{ ok: boolean }>(request);
  assert.equal(value.ok, true);
  assert.equal(usage.inputTokens, 20);
  assert.match(model.requests[1].user, /ok must be true/);
});

test("throws ModelOutputError after two bad answers and logs prompts", async () => {
  const dir = await tempDir();
  const log = path.join(dir, "prompts.jsonl");
  const model = fakeModel(["nope", { ok: false }], log);
  await assert.rejects(model.completeJson(request), ModelOutputError);
  assert.equal((await readFile(log, "utf8")).trim().split("\n").length, 2);
});

test("parseJsonText tolerates prose around JSON", () => {
  assert.deepEqual(parseJsonText('Sure! {"a": [1]}'), { a: [1] });
});

test("openRouterClient needs a key; provider prefix is stripped", () => {
  assert.throws(() => openRouterClient({ env: {} }), /OPENROUTER_API_KEY/);
  assert.equal(stripProvider("openrouter/google/gemini-2.5-flash"), "google/gemini-2.5-flash");
});
