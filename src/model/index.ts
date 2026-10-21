import { appendLine } from "../state/index.ts";

export interface JsonRequest<T> {
  /** Short label for logs and cost accounting: "app-map.areas", "criteria", ... */
  purpose: string;
  system: string;
  user: string;
  schemaHint: string;
  validate: (value: unknown) => string[];
  /** Narrowing after validation; defaults to a cast. */
  coerce?: (value: unknown) => T;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  /** Provider-reported charge, when the provider says (OpenRouter does). */
  costUsd?: number;
}

export interface ModelClient {
  name: string;
  completeJson<T>(request: JsonRequest<T>): Promise<{ value: T; usage: Usage }>;
}

/** A raw provider call: system + user in, text out. */
export type CompleteText = (input: { system: string; user: string }) => Promise<{ text: string; usage: Usage }>;

export class ModelOutputError extends Error {
  constructor(message: string, readonly raw: string) {
    super(message);
  }
}

/**
 * Wraps a provider with JSON parsing, one retry carrying the validation errors, and a
 * prompt log (`prompts.jsonl`) that the answer-key canary test and cost report read.
 */
export function jsonClient(name: string, complete: CompleteText, promptLog?: string): ModelClient {
  return {
    name,
    async completeJson<T>(request: JsonRequest<T>) {
      const system = `${request.system}\n\nAnswer with JSON only, no prose, matching:\n${request.schemaHint}`;
      let user = request.user;
      const usage: Usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
      let raw = "";
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await complete({ system, user });
        raw = result.text;
        usage.inputTokens += result.usage.inputTokens;
        usage.outputTokens += result.usage.outputTokens;
        usage.costUsd! += result.usage.costUsd ?? 0;
        let parsed: unknown;
        let errors: string[];
        try {
          parsed = parseJsonText(raw);
          errors = request.validate(parsed);
        } catch (error) {
          errors = [`not valid JSON: ${(error as Error).message}`];
        }
        if (promptLog) {
          await appendLine(promptLog, { at: new Date().toISOString(), model: name, purpose: request.purpose, system, user, output: raw, errors, usage: result.usage });
        }
        if (errors.length === 0) {
          return { value: request.coerce ? request.coerce(parsed) : (parsed as T), usage };
        }
        user = `${request.user}\n\nYour previous answer was rejected:\n${errors.map((e) => `- ${e}`).join("\n")}\nAnswer again with corrected JSON.`;
      }
      throw new ModelOutputError(`${request.purpose}: model output failed validation twice`, raw);
    },
  };
}

/** Accepts bare JSON or JSON inside a fenced block; cheap models add fences often. */
export function parseJsonText(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.search(/[[{]/);
  if (start < 0) throw new Error("no JSON value found");
  return JSON.parse(body.slice(start));
}
