import path from "node:path";
import { readJson, targetPaths } from "../state/index.ts";

export type StartMode =
  | { attach: Record<string, never> }
  | { fromPlaywrightConfig: string }
  | { processes: { name: string; command: string; readyURL: string; env?: Record<string, string>; timeoutMs?: number }[] };

export interface Manifest {
  schemaVersion: 1;
  name: string;
  baseURL: string;
  start: StartMode;
  allowedHosts: string[];
  playwrightConfig?: string;
  read: { include: string[]; answerKey: string[] };
  brief: string;
  fixtures: { allowedImports: string[] };
  policy: "auto" | "ask" | "never";
  locale: string;
  model?: { magpi?: string; magpiTest?: string };
}

export class ManifestError extends Error {}

const DEFAULT_INCLUDE = ["README*", "AGENTS.md", "CLAUDE.md", "QA.md", "docs/**", "src/**", "app/**", "ui/src/**"];
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export async function loadManifest(targetDir: string): Promise<Manifest> {
  const file = path.join(targetPaths(targetDir).magpiTests, "magpi-test.json");
  const raw = await readJson<Record<string, unknown>>(file);
  if (!raw) throw new ManifestError(`no manifest at ${file}`);
  return validateManifest(raw);
}

export function validateManifest(raw: Record<string, unknown>, env: NodeJS.ProcessEnv = process.env): Manifest {
  const errors: string[] = [];
  if (raw.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (typeof raw.name !== "string" || !raw.name) errors.push("name is required");
  if (typeof raw.baseURL !== "string") errors.push("baseURL is required");
  const start = raw.start as StartMode | undefined;
  if (!start || typeof start !== "object" || !("attach" in start || "fromPlaywrightConfig" in start || "processes" in start)) {
    errors.push("start must be one of {attach}, {fromPlaywrightConfig}, {processes}");
  }
  const read = (raw.read ?? {}) as Partial<Manifest["read"]>;
  const policy = (raw.policy ?? "auto") as Manifest["policy"];
  if (!["auto", "ask", "never"].includes(policy)) errors.push("policy must be auto, ask, or never");
  if (errors.length) throw new ManifestError(`invalid manifest: ${errors.join("; ")}`);

  const manifest: Manifest = {
    schemaVersion: 1,
    name: raw.name as string,
    baseURL: raw.baseURL as string,
    start: start!,
    allowedHosts: (raw.allowedHosts as string[] | undefined) ?? [],
    playwrightConfig: raw.playwrightConfig as string | undefined,
    read: { include: read.include ?? DEFAULT_INCLUDE, answerKey: read.answerKey ?? [] },
    brief: (raw.brief as string | undefined) ?? "magpi-tests/qa-brief.md",
    fixtures: { allowedImports: ((raw.fixtures as Manifest["fixtures"] | undefined)?.allowedImports) ?? [] },
    policy,
    locale: (raw.locale as string | undefined) ?? "en-US",
    model: raw.model as Manifest["model"],
  };
  checkPolicy(manifest, env);
  return manifest;
}

/** QD12: unattended `auto` only against local or explicitly listed simulated hosts. */
export function checkPolicy(manifest: Manifest, env: NodeJS.ProcessEnv = process.env): void {
  if (manifest.policy !== "auto") return;
  const kind = env.MAGPI_TEST_ENV_KIND ?? "simulated";
  if (kind === "shared") throw new ManifestError("policy auto is refused when MAGPI_TEST_ENV_KIND=shared");
  const host = new URL(effectiveBaseURL(manifest, env)).hostname;
  if (!LOCAL_HOSTS.has(host) && !manifest.allowedHosts.includes(host)) {
    throw new ManifestError(`policy auto is refused for host ${host}; add it to allowedHosts if it is a simulated environment`);
  }
}

export function effectiveBaseURL(manifest: Manifest, env: NodeJS.ProcessEnv = process.env): string {
  return (env.MAGPI_TEST_BASE_URL || manifest.baseURL).replace(/\/+$/, "");
}
