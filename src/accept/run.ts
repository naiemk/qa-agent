import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type FailureClass = "locator" | "assertion" | "timeout" | "environment" | "other";

export interface SpecRun {
  file: string;
  passed: number;
  failed: number;
  error?: { message: string; class: FailureClass; ariaSnapshot?: string; line?: number };
}

export interface AcceptanceResult {
  runs: SpecRun[];
  exitCode: number;
  stderrTail: string;
}

export type PlaywrightSpawner = (bin: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) => Promise<{ code: number; stdout: string; stderr: string }>;

export function playwrightBin(targetRoot: string): string {
  const local = path.join(targetRoot, "node_modules", ".bin", "playwright");
  return existsSync(local) ? local : fileURLToPath(new URL("../../node_modules/.bin/playwright", import.meta.url));
}

export function classifyError(message: string): FailureClass {
  const text = message.replace(/\u001b\[[0-9;]*m/g, "");
  if (/ECONNREFUSED|net::ERR_|ERR_CONNECTION|browserType\.launch|Executable doesn't exist/.test(text)) return "environment";
  if (/strict mode violation/.test(text)) return "locator";
  if (/expect\(.*\)\.(?!.*locator\.)/.test(text.split("\n")[0]) || /^\s*Error: expect\(/m.test(text)) return "assertion";
  if (/locator\.\w+: Timeout|waiting for (getBy|locator)/.test(text)) return "locator";
  if (/Timeout|timed out/i.test(text)) return "timeout";
  return "other";
}

interface JsonReport {
  suites?: JsonSuite[];
  errors?: { message?: string }[];
}
interface JsonSuite {
  file?: string;
  suites?: JsonSuite[];
  specs?: { file: string; tests: { results: { status: string; error?: { message?: string; location?: { line: number } }; attachments?: { name: string; path?: string; body?: string }[] }[] }[] }[];
}

export async function parseReport(report: JsonReport, configDir: string): Promise<SpecRun[]> {
  const runs = new Map<string, SpecRun>();
  const visit = async (suite: JsonSuite) => {
    for (const spec of suite.specs ?? []) {
      const run = runs.get(spec.file) ?? { file: spec.file, passed: 0, failed: 0 };
      runs.set(spec.file, run);
      for (const test of spec.tests) {
        for (const result of test.results) {
          if (result.status === "passed") {
            run.passed++;
            continue;
          }
          run.failed++;
          if (run.error) continue;
          const message = (result.error?.message ?? result.status).replace(/\u001b\[[0-9;]*m/g, "").split("\n").slice(0, 40).join("\n");
          const context = result.attachments?.find((a) => a.name === "error-context");
          let ariaSnapshot: string | undefined;
          if (context?.path) ariaSnapshot = await readFile(path.resolve(configDir, context.path), "utf8").catch(() => undefined);
          else if (context?.body) ariaSnapshot = Buffer.from(context.body, "base64").toString("utf8");
          run.error = {
            message,
            class: result.status === "timedOut" ? "timeout" : classifyError(message),
            ariaSnapshot: ariaSnapshot?.split("\n").slice(0, 200).join("\n"),
            line: result.error?.location?.line,
          };
        }
      }
    }
    for (const child of suite.suites ?? []) await visit(child);
  };
  for (const suite of report.suites ?? []) await visit(suite);
  return [...runs.values()];
}

/**
 * Runs specs `repeat` times with --retries=0. With a reset (QD15) each repetition is a
 * separate invocation preceded by the reset; otherwise one `--repeat-each` invocation.
 */
export async function runAcceptance(options: {
  targetRoot: string;
  config: string;
  files: string[];
  env: Record<string, string>;
  repeat?: number;
  reset?: () => Promise<void>;
  spawner?: PlaywrightSpawner;
}): Promise<AcceptanceResult> {
  const repeat = options.repeat ?? 3;
  const spawner = options.spawner ?? defaultSpawner;
  const bin = playwrightBin(options.targetRoot);
  const invocations = options.reset ? repeat : 1;
  const merged = new Map<string, SpecRun>();
  let exitCode = 0;
  let stderrTail = "";
  for (let i = 0; i < invocations; i++) {
    if (options.reset) await options.reset();
    const args = ["test", "--config", options.config, ...options.files, "--retries=0", "--workers=1", "--reporter=json"];
    if (!options.reset) args.push(`--repeat-each=${repeat}`);
    // A provider key must not be needed on replay: strip every *_API_KEY from the env.
    const env = Object.fromEntries(Object.entries({ ...process.env, ...options.env }).filter(([k]) => !/API_KEY$/i.test(k)));
    const { code, stdout, stderr } = await spawner(bin, args, options.targetRoot, env);
    exitCode = Math.max(exitCode, code);
    stderrTail = stderr.slice(-2000);
    let report: JsonReport;
    try {
      report = JSON.parse(stdout.slice(stdout.indexOf("{")));
    } catch {
      return { runs: options.files.map((file) => ({ file, passed: 0, failed: repeat, error: { message: `playwright produced no JSON report:\n${stderr.slice(-1500)}`, class: "environment" } })), exitCode: code, stderrTail };
    }
    const configDir = path.dirname(path.resolve(options.targetRoot, options.config));
    for (const run of await parseReport(report, configDir)) {
      const key = path.basename(run.file);
      const prior = merged.get(key);
      if (!prior) merged.set(key, { ...run, file: key });
      else merged.set(key, { file: key, passed: prior.passed + run.passed, failed: prior.failed + run.failed, error: prior.error ?? run.error });
    }
    if (report.errors?.length && merged.size === 0) {
      return { runs: options.files.map((file) => ({ file, passed: 0, failed: repeat, error: { message: report.errors!.map((e) => e.message).join("\n").slice(0, 2000), class: "other" } })), exitCode: code, stderrTail };
    }
  }
  return { runs: [...merged.values()], exitCode, stderrTail };
}

const defaultSpawner: PlaywrightSpawner = (bin, args, cwd, env) =>
  new Promise((resolve) => {
    const child = spawn(bin, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => (stdout += c));
    child.stderr.on("data", (c) => (stderr += c));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    child.on("error", (error) => resolve({ code: 127, stdout, stderr: error.message }));
  });
