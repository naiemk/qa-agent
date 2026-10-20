/**
 * Boot the Magpi Test GitHub App (TestDriver-pattern).
 * Placeholder — days 0–2: wire Probot with config + webhooks.
 *
 * Run: `npm run serve` from testdriver/
 */
import { loadConfig } from "./config.ts";
import { createApp } from "./github/app.ts";
import { registerWebhooks } from "./github/webhooks.ts";

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await createApp(config);
  registerWebhooks(app, config);

  // TODO(days 0–2): start Probot server / webhook proxy.
  // eslint-disable-next-line no-console
  console.log(
    `[testdriver] placeholder boot — mention @${config.mentionHandle}; port=${config.port}`,
  );
  // eslint-disable-next-line no-console
  console.log(
    "[testdriver] Magpi bin boundary:",
    config.magpiTestBin,
    "(subprocess only; no imports from ../src)",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
