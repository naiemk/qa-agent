import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { Predicate } from "../scenario/types.ts";

export interface BoundedRunRequest {
  goal: string;
  url: string;
  criteria: Predicate[];
  policy: "auto" | "ask" | "never";
  maxTurns: number;
  model?: string;
  root: string;
  headed?: boolean;
}

export interface BoundedRunResult {
  status: "success" | "failed" | "error";
  goalId?: string;
  turns: number;
  tokens: number;
  costUsd: number;
  checks: { passed: boolean; detail: string; predicate: string }[];
  claimed?: unknown;
  exitCode: number;
  durationMs: number;
  stdoutTail: string;
  stderrTail: string;
}

export type Spawner = (command: string, args: string[], env: NodeJS.ProcessEnv) => Promise<{ code: number; stdout: string; stderr: string }>;

export class RunRequestError extends Error {}

export function magpiBin(name: "browser-agent" | "magpie" = "browser-agent"): string {
  return process.env.MAGPI_BIN ?? fileURLToPath(new URL(`../../node_modules/.bin/${name}`, import.meta.url));
}

/** argv exactly as magpi-integration.md "Bounded, criteria-checked run". */
export function boundedRunArgs(request: BoundedRunRequest): string[] {
  if (request.criteria.length === 0) throw new RunRequestError("refusing a run with no criteria: Magpi would substitute an always-true check");
  if (JSON.stringify(request.criteria).includes('"ref_exists"')) throw new RunRequestError("ref_exists is not allowed in criteria");
  const args = ["run", request.goal, "--url", request.url];
  for (const criterion of request.criteria) args.push("--criterion", JSON.stringify(criterion));
  args.push("--policy", request.policy, "--max-turns", String(request.maxTurns), "--root", request.root, "--json");
  if (request.model) args.push("--model", request.model);
  if (request.headed) args.push("--headed");
  return args;
}

export async function runBounded(request: BoundedRunRequest, spawner: Spawner = defaultSpawner): Promise<BoundedRunResult> {
  const started = Date.now();
  const { code, stdout, stderr } = await spawner(magpiBin(), boundedRunArgs(request), process.env);
  const durationMs = Date.now() - started;
  const goalId = stderr.match(/goal (goal_[a-z0-9]+)/)?.[1];
  const tails = { stdoutTail: stdout.slice(-2000), stderrTail: stderr.slice(-2000) };
  const parsed = lastJsonObject(stdout);
  if (!parsed || typeof parsed.status !== "string") {
    return { status: "error", goalId, turns: 0, tokens: 0, costUsd: 0, checks: [], exitCode: code, durationMs, ...tails };
  }
  return {
    status: parsed.status === "success" ? "success" : "failed",
    goalId: (parsed.goalId as string | undefined) ?? goalId,
    turns: Number(parsed.turns ?? 0),
    tokens: Number(parsed.tokens ?? 0),
    costUsd: Number(parsed.costUsd ?? 0),
    checks: (parsed.checks as BoundedRunResult["checks"] | undefined) ?? [],
    claimed: parsed.claimed,
    exitCode: code,
    durationMs,
    ...tails,
  };
}

function lastJsonObject(stdout: string): Record<string, unknown> | undefined {
  const start = stdout.indexOf("{");
  if (start < 0) return undefined;
  for (let i = start; i >= 0 && i < stdout.length; i = stdout.indexOf("{", i + 1)) {
    try {
      return JSON.parse(stdout.slice(i)) as Record<string, unknown>;
    } catch {
      // Magpi may print progress before the JSON; try the next brace.
    }
  }
  return undefined;
}

export const defaultSpawner: Spawner = (command, args, env) =>
  new Promise((resolve) => {
    const child = spawn(command, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (process.env.MAGPI_TEST_VERBOSE) process.stderr.write(chunk);
    });
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    child.on("error", (error) => resolve({ code: 127, stdout, stderr: `${stderr}\n${error.message}` }));
  });
