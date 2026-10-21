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

test("a 402 from OpenRouter is a ProviderCreditError and requests cap max_tokens", async () => {
  const { ProviderCreditError, MAX_OUTPUT_TOKENS } = await import("../../src/model/openrouter.ts");
  const realFetch = globalThis.fetch;
  let body: { max_tokens?: number } = {};
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    body = JSON.parse(init.body);
    return new Response('{"error":{"message":"more credits"}}', { status: 402 });
  }) as unknown as typeof fetch;
  try {
    const client = openRouterClient({ env: { OPENROUTER_API_KEY: "test" } });
    await assert.rejects(client.completeJson(request), ProviderCreditError);
    assert.equal(body.max_tokens, MAX_OUTPUT_TOKENS);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("OpenRouter cost is requested, carried in usage, and stops a --max-usd budget", async () => {
  const { createBudget, meteredModel, BudgetExceeded } = await import("../../src/budget.ts");
  const realFetch = globalThis.fetch;
  let body: { usage?: { include?: boolean } } = {};
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    body = JSON.parse(init.body);
    return Response.json({ choices: [{ message: { content: '{"ok":true}' } }], usage: { prompt_tokens: 100, completion_tokens: 10, cost: 0.003 } });
  }) as unknown as typeof fetch;
  try {
    const budget = createBudget({ maxUsd: 0.005 });
    const client = meteredModel(openRouterClient({ env: { OPENROUTER_API_KEY: "test" } }), budget);
    const ok = { ...request, validate: () => [] };
    const first = await client.completeJson(ok);
    assert.equal(body.usage?.include, true);
    assert.equal(first.usage.costUsd, 0.003);
    await client.completeJson(ok);
    assert.equal(budget.costUsd, 0.006);
    await assert.rejects(client.completeJson(ok), BudgetExceeded);
  } finally {
    globalThis.fetch = realFetch;
  }
});
