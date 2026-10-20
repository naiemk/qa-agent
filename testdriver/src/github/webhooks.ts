/**
 * Webhook routing.
 * Placeholder — days 0–2: subscribe to issue_comment (and later pull_request).
 */
import type { TestdriverConfig } from "../config.ts";
import type { AppHandle } from "./app.ts";
import { parseMention } from "./mention.ts";

export function registerWebhooks(app: AppHandle, config: TestdriverConfig): void {
  // TODO(days 0–2): app.on("issue_comment.created", async (context) => { ... })
  // TODO(days 2–7): if parseMention hits, enqueue job + ack comment
  void app;
  void config;
  void parseMention;
  console.log("[testdriver] webhooks: placeholder (no subscriptions yet)");
}
