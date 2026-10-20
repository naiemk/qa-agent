/**
 * Spawns Magpi Test CLI via MAGPI_TEST_BIN.
 * Phase 1: stub — logs the intended invocation and returns a synthetic output.
 * Days 2–7: replace with real child_process spawn (see PLAN.md).
 */
import { existsSync } from "node:fs";
import type { MagpiRunInput, MagpiRunOutput } from "./contract.ts";

export interface MagpiClientOptions {
  /** When true (default in phase 1), do not spawn; log and return stub output. */
  stub?: boolean;
}

/**
 * Phase-1 stub. Logs the CLI that would run; does not execute Magpi Test.
 * Set `options.stub = false` later to spawn `MAGPI_TEST_BIN`.
 */
export async function runMagpiTest(
  input: MagpiRunInput,
  options: MagpiClientOptions = {},
): Promise<MagpiRunOutput> {
  const stub = options.stub !== false;
  const argv = [
    input.bin,
    "run",
    ...(input.targetDir ? ["--target", input.targetDir] : []),
    "--max-minutes",
    String(input.maxMinutes),
  ];
  console.log("[testdriver:magpi] intended CLI", {
    stub,
    argv,
    repoUrl: input.repoUrl,
    ref: input.ref,
    previewUrl: input.previewUrl,
    binExists: existsSync(input.bin),
  });

  if (stub) {
    return {
      pass: false,
      summary:
        "Phase 1 stub: Magpi Test was not executed. Wire spawn in days 2–7.",
      artifactLinks: [],
      exitCode: undefined,
    };
  }

  // Days 2–7: spawn process.execPath with [bin, ...args], set MAGPI_TEST_BASE_URL.
  throw new Error("runMagpiTest live spawn is not implemented yet (phase 1 stub)");
}
