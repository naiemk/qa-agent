import { jsonClient, type ModelClient } from "./index.ts";

export interface FakeModel extends ModelClient {
  requests: { system: string; user: string }[];
}

/**
 * Scripted model for tests. `answers` is consumed in order; a function answer sees the
 * request so a test can route by prompt content.
 */
export function fakeModel(
  answers: (unknown | ((request: { system: string; user: string }) => unknown))[],
  promptLog?: string,
): FakeModel {
  const queue = [...answers];
  const requests: { system: string; user: string }[] = [];
  const client = jsonClient("fake", async (request) => {
    requests.push(request);
    if (queue.length === 0) throw new Error(`fake model: no answer left for request:\n${request.user.slice(0, 300)}`);
    const next = queue.shift();
    const value = typeof next === "function" ? (next as (r: typeof request) => unknown)(request) : next;
    return { text: typeof value === "string" ? value : JSON.stringify(value), usage: { inputTokens: 10, outputTokens: 5 } };
  }, promptLog);
  return Object.assign(client, { requests });
}
