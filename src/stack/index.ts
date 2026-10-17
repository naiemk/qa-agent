import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { effectiveBaseURL, type Manifest } from "../config/index.ts";

export class EnvNotReadyError extends Error {}
export class EnvResetError extends Error {}

export interface AttachedEnv {
  baseURL: string;
  readyURL: string;
  /** Present only when the QA CI job offers a reset (QD15). */
  reset?: () => Promise<void>;
  /** Environment variables to pass to Playwright on replay. */
  replayEnv: Record<string, string>;
}

/**
 * Attach mode (QD11): the target's QA CI job already started the app. Nothing is spawned
 * here except the optional reset command.
 */
export function attachEnv(
  manifest: Manifest,
  options: { targetRoot: string; logsDir: string; env?: NodeJS.ProcessEnv },
): AttachedEnv {
  const env = options.env ?? process.env;
  const baseURL = effectiveBaseURL(manifest, env);
  const readyURL = env.MAGPI_TEST_READY_URL || baseURL;
  const resetCommand = env.MAGPI_TEST_RESET_CMD;
  const replayEnv: Record<string, string> = { MAGPI_TEST_BASE_URL: baseURL };
  return {
    baseURL,
    readyURL,
    replayEnv,
    reset: resetCommand
      ? () => runReset(resetCommand, options.targetRoot, path.join(options.logsDir, "reset.log"))
      : undefined,
  };
}

/** Same rule as Playwright's webServer probe: any status below 500 means up. */
export async function waitReady(url: string, timeoutMs: number, intervalMs = 500): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let last = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(5000) });
      if (response.status < 500) return;
      last = `status ${response.status}`;
    } catch (error) {
      last = (error as Error).message;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new EnvNotReadyError(`${url} not ready after ${timeoutMs}ms (${last})`);
}

export function readyTimeout(env: NodeJS.ProcessEnv = process.env): number {
  return Number(env.MAGPI_TEST_READY_TIMEOUT_MS ?? 300_000);
}

async function runReset(command: string, cwd: string, logFile: string): Promise<void> {
  await mkdir(path.dirname(logFile), { recursive: true });
  const log = createWriteStream(logFile, { flags: "a" });
  const code = await new Promise<number>((resolve) => {
    const child = spawn("sh", ["-c", command], { cwd, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    child.on("close", (status) => resolve(status ?? 1));
  });
  log.end();
  if (code !== 0) throw new EnvResetError(`reset command exited ${code}; see ${logFile}`);
}
