/**
 * Thin boundary types for calling Magpi Test as a CLI subprocess.
 *
 * RULE: this module must not import anything from ../../src (Magpi Test core).
 * If Magpi Test needs a new flag for GitHub App use, add it in Magpi Test and
 * pass it here as a string argv — do not import implementation types.
 */

/** Request mapped onto Magpi Test process env + argv. */
export interface MagpiRunRequest {
  /** Absolute path to the target checkout (contains magpi-tests/). */
  targetDir: string;
  /** Attach-mode preview URL → MAGPI_TEST_BASE_URL */
  baseUrl: string;
  /** Optional → MAGPI_TEST_READY_URL */
  readyUrl?: string;
  /** Passed as --max-minutes */
  maxMinutes: number;
  /** Absolute path to magpi-test binary (bin/magpi-test.mjs). */
  bin: string;
  /** Extra env for the child (e.g. OPENROUTER_API_KEY). Never log values. */
  env: Record<string, string>;
}

/**
 * Magpi Test EXIT map (from src/cli/main.ts) — documented here for the adapter
 * only; do not import EXIT from core.
 */
export const MAGPI_EXIT = {
  ok: 0,
  internal: 1,
  usageOrEnv: 2,
  briefMissing: 3,
  budget: 4,
} as const;

export interface MagpiRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  /** Truncated contents of magpi-tests/state/report.md if present. */
  reportExcerpt: string | undefined;
  /** Absolute path to report.md when found. */
  reportPath: string | undefined;
  errorMessage: string | undefined;
}
