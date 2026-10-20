/**
 * Probot / Octokit factory.
 * Placeholder — days 0–2: return a real Probot instance from APP_ID + key.
 */
import type { TestdriverConfig } from "../config.ts";

/** Opaque handle until Probot is wired. */
export interface AppHandle {
  config: TestdriverConfig;
  kind: "placeholder";
}

export async function createApp(config: TestdriverConfig): Promise<AppHandle> {
  // TODO(days 0–2):
  //   import { Probot, run } from "probot";
  //   return new Probot({ appId, privateKey, secret: webhookSecret });
  if (!config.appId || !config.privateKey || !config.webhookSecret) {
    // Scaffold / local structure check — credentials filled during dogfood.
    console.warn("[testdriver] App credentials incomplete; placeholder mode");
  }
  return { config, kind: "placeholder" };
}
