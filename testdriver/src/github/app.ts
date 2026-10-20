/**
 * Probot factory. Signature verification is handled by Probot's webhook middleware
 * when serving over HTTP (WEBHOOK_SECRET).
 */
import { generateKeyPairSync } from "node:crypto";
import { createProbot, type Probot } from "probot";
import type { TestdriverConfig } from "../config.ts";
import { hasAppCredentials } from "../config.ts";

/** Ephemeral RSA key for fixture replay when no App credentials are configured. */
export function ephemeralPrivateKey(): string {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return privateKey.export({ type: "pkcs1", format: "pem" }).toString();
}

export function createApp(config: TestdriverConfig, opts?: { replay?: boolean }): Probot {
  const replay = opts?.replay === true;
  const appId = config.appId || (replay ? "1" : "");
  const privateKey = config.privateKey || (replay ? ephemeralPrivateKey() : "");
  const secret = config.webhookSecret || (replay ? "development" : "");

  if (!replay && !hasAppCredentials({ ...config, appId, privateKey, webhookSecret: secret })) {
    console.warn(
      "[testdriver] Missing APP_ID / PRIVATE_KEY / WEBHOOK_SECRET — use --replay for offline routing, or fill testdriver/.env",
    );
  }

  return createProbot({
    overrides: {
      appId: Number(appId) || 1,
      privateKey: privateKey || ephemeralPrivateKey(),
      secret: secret || "development",
      // Avoid Probot trying to load .env from cwd in surprising ways when we already did.
    },
  });
}

export type { Probot };
