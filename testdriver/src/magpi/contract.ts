/**
 * Thin Magpi Test boundary types.
 * RULE: do not import anything from ../../src (Magpi Test core).
 */

/** Input the GitHub App collects before spawning Magpi Test. */
export interface MagpiRunInput {
  /** Repository clone URL (https or git). */
  repoUrl: string;
  /** Git ref (branch, tag, or SHA). */
  ref: string;
  /** Running app preview URL → MAGPI_TEST_BASE_URL for attach mode. */
  previewUrl: string;
  /** Absolute path to a local checkout when already available (dogfood). */
  targetDir?: string;
  /** Passed as --max-minutes */
  maxMinutes: number;
  /** Absolute path to magpi-test binary (bin/magpi-test.mjs). */
  bin: string;
  /** Extra child env (e.g. OPENROUTER_API_KEY). Never log values. */
  env?: Record<string, string>;
}

/** Output summarized back onto the GitHub thread. */
export interface MagpiRunOutput {
  /** Whether Magpi Test exited successfully (exit 0). */
  pass: boolean;
  /** Short human summary for the PR/issue comment. */
  summary: string;
  /** Links to artifacts (report.md, specs, recordings) when known. */
  artifactLinks: string[];
  /** Raw process exit code when a CLI was spawned. */
  exitCode?: number;
}

/** @deprecated Prefer MagpiRunInput — kept for older job wiring names. */
export type MagpiRunRequest = MagpiRunInput;

/** @deprecated Prefer MagpiRunOutput */
export type MagpiRunResult = MagpiRunOutput & {
  stdout?: string;
  stderr?: string;
  reportExcerpt?: string;
  reportPath?: string;
  errorMessage?: string;
};

export const MAGPI_EXIT = {
  ok: 0,
  internal: 1,
  usageOrEnv: 2,
  briefMissing: 3,
  budget: 4,
} as const;
