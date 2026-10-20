/**
 * Spawns Magpi Test CLI. No imports from Magpi Test TypeScript sources.
 * Placeholder — days 2–7: real spawn + report.md read.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { MagpiRunRequest, MagpiRunResult } from "./contract.ts";

const REPORT_REL = path.join("magpi-tests", "state", "report.md");
const EXCERPT_MAX = 4000;

function excerptFile(filePath: string): string | undefined {
  if (!existsSync(filePath)) return undefined;
  const text = readFileSync(filePath, "utf8");
  return text.length <= EXCERPT_MAX ? text : `${text.slice(0, EXCERPT_MAX)}\n…(truncated)`;
}

/**
 * Run `magpi-test run --target …` as a child process.
 * Stub returns a non-zero result until days 2–7 wire the real spawn path in tests.
 */
export async function runMagpiTest(req: MagpiRunRequest): Promise<MagpiRunResult> {
  if (!existsSync(req.bin)) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: "",
      reportExcerpt: undefined,
      reportPath: undefined,
      errorMessage: `Magpi Test bin not found: ${req.bin}`,
    };
  }

  const args = ["run", "--target", req.targetDir, "--max-minutes", String(req.maxMinutes)];
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...req.env,
    MAGPI_TEST_BASE_URL: req.baseUrl,
  };
  if (req.readyUrl) env.MAGPI_TEST_READY_URL = req.readyUrl;

  const { stdout, stderr, code } = await spawnCapture(req.bin, args, env, req.targetDir);
  const reportPath = path.join(req.targetDir, REPORT_REL);
  const reportExcerpt = excerptFile(reportPath);

  return {
    exitCode: code,
    stdout,
    stderr,
    reportExcerpt,
    reportPath: reportExcerpt ? reportPath : undefined,
    errorMessage: code === 0 ? undefined : summarizeFailure(code, stderr),
  };
}

function summarizeFailure(code: number, stderr: string): string {
  const tail = stderr.trim().split("\n").slice(-5).join(" ");
  return `magpi-test exited ${code}${tail ? `: ${tail}` : ""}`;
}

function spawnCapture(
  bin: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  cwd: string,
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    // node bin/magpi-test.mjs … — bin is already the magpi-test.mjs path
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
      resolve({ stdout, stderr: `${stderr}\n${err.message}`, code: 1 });
    });
    child.on("close", (code) => {
      resolve({ stdout, stderr, code: code ?? 1 });
    });
  });
}
