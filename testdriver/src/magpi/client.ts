/**
 * Spawns Magpi Test CLI via MAGPI_TEST_BIN. No imports from Magpi Test src/.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { MAGPI_EXIT, type MagpiRunInput, type MagpiRunOutput } from "./contract.ts";

const REPORT_REL = path.join("magpi-tests", "state", "report.md");
const EXCERPT_MAX = 3500;
const STDOUT_TAIL = 2000;

function excerpt(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}\n…(truncated)`;
}

function readReport(targetDir: string): { path: string; text: string } | undefined {
  const reportPath = path.join(targetDir, REPORT_REL);
  if (!existsSync(reportPath)) return undefined;
  return { path: reportPath, text: readFileSync(reportPath, "utf8") };
}

function summarizeExit(code: number): string {
  switch (code) {
    case MAGPI_EXIT.ok:
      return "Magpi Test finished successfully.";
    case MAGPI_EXIT.usageOrEnv:
      return "Magpi Test failed: environment not ready or bad usage (exit 2).";
    case MAGPI_EXIT.briefMissing:
      return "Magpi Test stopped: QA brief missing or docs too thin (exit 3).";
    case MAGPI_EXIT.budget:
      return "Magpi Test stopped: budget exhausted (exit 4).";
    default:
      return `Magpi Test failed with exit code ${code}.`;
  }
}

function spawnCapture(
  bin: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  cwd: string,
): Promise<{ stdout: string; stderr: string; code: number; spawnError?: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [bin, ...args], {
      env,
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (c: Buffer) => {
      stdout += c.toString("utf8");
    });
    child.stderr?.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
    });
    child.on("error", (err) => {
      resolve({ stdout, stderr, code: 1, spawnError: err.message });
    });
    child.on("close", (code) => {
      resolve({ stdout, stderr, code: code ?? 1 });
    });
  });
}

/**
 * Run `magpi-test run --target …` as a child process.
 * Never logs secret env values.
 */
export async function runMagpiTest(input: MagpiRunInput): Promise<MagpiRunOutput> {
  if (!existsSync(input.bin)) {
    return {
      pass: false,
      summary: `Magpi Test bin not found: ${input.bin}`,
      artifactLinks: [],
      exitCode: 1,
    };
  }

  if (!input.targetDir) {
    return {
      pass: false,
      summary:
        "No target checkout for Magpi Test. Set MAGPI_TEST_WORKDIR for dogfood, or clone the PR ref before running.",
      artifactLinks: [],
      exitCode: 1,
    };
  }

  if (!existsSync(input.targetDir)) {
    return {
      pass: false,
      summary: `Target directory does not exist: ${input.targetDir}`,
      artifactLinks: [],
      exitCode: 1,
    };
  }

  const args = ["run", "--target", input.targetDir, "--max-minutes", String(input.maxMinutes)];
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...input.env,
    MAGPI_TEST_BASE_URL: input.previewUrl,
    MAGPI_TEST_REPO_URL: input.repoUrl,
    MAGPI_TEST_REF: input.ref,
  };

  console.log("[testdriver:magpi] spawning CLI", {
    bin: input.bin,
    args,
    targetDir: input.targetDir,
    previewUrl: input.previewUrl,
    repoUrl: input.repoUrl,
    ref: input.ref,
    hasOpenRouterKey: Boolean(env.OPENROUTER_API_KEY),
  });

  let stdout = "";
  let stderr = "";
  let code = 1;
  let spawnError: string | undefined;

  try {
    const result = await spawnCapture(input.bin, args, env, input.targetDir);
    stdout = result.stdout;
    stderr = result.stderr;
    code = result.code;
    spawnError = result.spawnError;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      pass: false,
      summary: `Failed to spawn Magpi Test: ${message}`,
      artifactLinks: [],
      exitCode: 1,
    };
  }

  if (spawnError) {
    return {
      pass: false,
      summary: `Failed to spawn Magpi Test: ${spawnError}`,
      artifactLinks: [],
      exitCode: 1,
    };
  }

  const report = readReport(input.targetDir);
  const artifactLinks: string[] = [];
  if (report) artifactLinks.push(report.path);

  const reportExcerpt = report ? excerpt(report.text, EXCERPT_MAX) : undefined;
  const stdoutTail = excerpt(stdout, STDOUT_TAIL);
  const stderrTail = excerpt(stderr, 800);

  const pass = code === MAGPI_EXIT.ok;
  const parts = [
    summarizeExit(code),
    reportExcerpt ? `\n\n<details><summary>report.md</summary>\n\n\`\`\`\n${reportExcerpt}\n\`\`\`\n</details>` : "",
    !reportExcerpt && stdoutTail ? `\n\n<details><summary>stdout</summary>\n\n\`\`\`\n${stdoutTail}\n\`\`\`\n</details>` : "",
    !pass && stderrTail ? `\n\n<details><summary>stderr</summary>\n\n\`\`\`\n${stderrTail}\n\`\`\`\n</details>` : "",
  ];

  return {
    pass,
    summary: parts.join("").trim(),
    artifactLinks,
    exitCode: code,
  };
}
