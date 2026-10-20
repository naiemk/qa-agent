/**
 * Module-local configuration from testdriver/.env (see .env.example).
 * Does not read Magpi Test internals.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(moduleRoot, "..");

export interface TestdriverConfig {
  appId: string;
  privateKey: string;
  webhookSecret: string;
  /** Comment trigger, e.g. "@magpi-test" or "magpi-test". */
  triggerPhrase: string;
  magpiTestBin: string;
  magpiTestBaseUrl: string | undefined;
  magpiTestWorkdir: string | undefined;
  jobMaxMinutes: number;
  openRouterApiKey: string | undefined;
  port: number;
  webhookProxyUrl: string | undefined;
  moduleRoot: string;
  repoRoot: string;
}

function loadDotEnv(): void {
  const envPath = path.join(moduleRoot, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function resolvePrivateKey(): string {
  const inline = process.env.PRIVATE_KEY;
  if (inline) return inline.replace(/\\n/g, "\n");
  const keyPath = process.env.PRIVATE_KEY_PATH;
  if (keyPath) {
    const abs = path.isAbsolute(keyPath) ? keyPath : path.join(moduleRoot, keyPath);
    if (existsSync(abs)) return readFileSync(abs, "utf8");
  }
  return "";
}

/** Normalize TRIGGER_PHRASE; keep a leading @ for display, match without requiring it. */
export function normalizeTriggerPhrase(raw: string): string {
  const trimmed = raw.trim() || "@magpi-test";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

export function loadConfig(): TestdriverConfig {
  loadDotEnv();
  const defaultBin = path.join(repoRoot, "bin", "magpi-test.mjs");
  return {
    appId: process.env.APP_ID ?? "",
    privateKey: resolvePrivateKey(),
    webhookSecret: process.env.WEBHOOK_SECRET ?? "",
    triggerPhrase: normalizeTriggerPhrase(
      process.env.TRIGGER_PHRASE ?? process.env.MENTION_HANDLE ?? "@magpi-test",
    ),
    magpiTestBin: process.env.MAGPI_TEST_BIN || defaultBin,
    magpiTestBaseUrl: process.env.MAGPI_TEST_BASE_URL || undefined,
    magpiTestWorkdir: process.env.MAGPI_TEST_WORKDIR || undefined,
    jobMaxMinutes: Number(process.env.JOB_MAX_MINUTES ?? "30") || 30,
    openRouterApiKey: process.env.OPENROUTER_API_KEY || undefined,
    port: Number(process.env.PORT ?? "3000") || 3000,
    webhookProxyUrl: process.env.WEBHOOK_PROXY_URL || undefined,
    moduleRoot,
    repoRoot,
  };
}

export function hasAppCredentials(config: TestdriverConfig): boolean {
  return Boolean(config.appId && config.privateKey && config.webhookSecret);
}
