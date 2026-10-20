/**
 * Magpi Test GitHub App entry (TestDriver-pattern).
 *
 *   npm run serve          — HTTP webhook server (Probot verifies signatures)
 *   npm run replay-fixture — offline routing proof via fixtures/sample-mention.json
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createNodeMiddleware } from "probot";
import { loadConfig, type TestdriverConfig } from "./config.ts";
import { createApp } from "./github/app.ts";
import { registerWebhooks } from "./github/webhooks.ts";

function parseArgv(argv: string[]): { replay: string | undefined; port: number | undefined } {
  let replay: string | undefined;
  let port: number | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--replay") {
      const next = argv[i + 1];
      if (next && !next.startsWith("-")) {
        replay = next;
        i++;
      } else {
        replay = "fixtures/sample-mention.json";
      }
    } else if (a.startsWith("--replay=")) {
      replay = a.slice("--replay=".length);
    } else if (a === "--port") {
      port = Number(argv[++i]);
    }
  }
  return { replay, port };
}

export async function replayFixture(
  config: TestdriverConfig,
  fixtureRel: string,
): Promise<void> {
  const fixturePath = path.isAbsolute(fixtureRel)
    ? fixtureRel
    : path.join(config.moduleRoot, fixtureRel);
  const payload = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, unknown>;
  const probot = createApp(config, { replay: true });
  registerWebhooks(probot, config);

  console.log("[testdriver] replaying fixture", fixturePath);
  await probot.receive({
    id: "fixture-replay",
    name: "issue_comment",
    payload: payload as never,
  });
  console.log("[testdriver] replay complete — routing exercised without live GitHub");
}

async function serveHttp(config: TestdriverConfig, port: number): Promise<void> {
  const probot = createApp(config);
  const middleware = createNodeMiddleware(
    (app) => {
      registerWebhooks(app, config);
    },
    { probot, webhooksPath: "/api/github/webhooks" },
  );

  const httpServer = createServer((req, res) => {
    if (req.url === "/healthz") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
      return;
    }
    void middleware(req, res, () => {
      res.writeHead(404);
      res.end("not found");
    });
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, () => resolve());
  });

  console.log(
    `[testdriver] listening on :${port}  webhook=/api/github/webhooks  trigger=${config.triggerPhrase}`,
  );
  if (config.webhookProxyUrl) {
    console.log(`[testdriver] WEBHOOK_PROXY_URL=${config.webhookProxyUrl}`);
  } else {
    console.log(
      "[testdriver] For local dogfood, expose this port with cloudflared or localtunnel and set the App webhook URL",
    );
  }
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const config = loadConfig();
  const args = parseArgv(argv);
  const port = args.port ?? config.port;

  if (args.replay !== undefined) {
    await replayFixture(config, args.replay);
    return;
  }

  await serveHttp(config, port);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
