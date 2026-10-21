import { jsonClient, type ModelClient } from "./index.ts";

export const DEFAULT_MODEL = "google/gemini-2.5-flash";

export class MissingKeyError extends Error {}

/** OpenRouter 402: the account cannot pay for more calls. Stops the run (exit 4). */
export class ProviderCreditError extends Error {}

/** Our calls answer with small JSON; without a cap OpenRouter reserves the model's maximum. */
export const MAX_OUTPUT_TOKENS = 4096;

/** OpenRouter chat completions over fetch. Live runs only; tests use the fake. */
export function openRouterClient(options: { model?: string; promptLog?: string; env?: NodeJS.ProcessEnv } = {}): ModelClient {
  const env = options.env ?? process.env;
  const key = env.OPENROUTER_API_KEY;
  if (!key) throw new MissingKeyError("OPENROUTER_API_KEY is not set");
  const model = stripProvider(options.model ?? env.MAGPI_TEST_MODEL ?? DEFAULT_MODEL);
  return jsonClient(`openrouter/${model}`, async ({ system, user }) => {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-title": "magpi-test" },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: MAX_OUTPUT_TOKENS,
        response_format: { type: "json_object" },
        usage: { include: true },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (response.status === 402) throw new ProviderCreditError(`OpenRouter is out of credits: ${(await response.text()).slice(0, 300)}`);
    if (!response.ok) throw new Error(`OpenRouter ${response.status}: ${(await response.text()).slice(0, 500)}`);
    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
    };
    return {
      text: body.choices?.[0]?.message?.content ?? "",
      usage: { inputTokens: body.usage?.prompt_tokens ?? 0, outputTokens: body.usage?.completion_tokens ?? 0, costUsd: body.usage?.cost ?? 0 },
    };
  }, options.promptLog);
}

/** Accepts `openrouter/<id>` (Magpi's spelling) or a bare OpenRouter id. */
export function stripProvider(model: string): string {
  return model.startsWith("openrouter/") ? model.slice("openrouter/".length) : model;
}
