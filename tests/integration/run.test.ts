import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { after, before, test } from "node:test";
import { main } from "../../src/cli/main.ts";
import type { Spawner } from "../../src/magpi/run.ts";
import { fakeModel } from "../../src/model/fake.ts";
import { tempTarget } from "../helpers.ts";

const PAGES: Record<string, string> = {
  "/": `<title>Shop</title><h1>Fixture Shop</h1><a href="/order">Place an order</a>`,
  "/order": `<title>Order</title><h1>New order</h1>
    <form id="f"><label for="n">Your name</label><input id="n" name="n">
    <button type="submit">Place order</button><p id="err" role="alert"></p></form>
    <script>
      document.getElementById("f").addEventListener("submit", (e) => {
        e.preventDefault();
        const name = document.getElementById("n").value.trim();
        if (!name) { document.getElementById("err").textContent = "Name is required"; return; }
        location.href = "/orders/0x" + Math.random().toString(16).slice(2).padEnd(12, "0") + "?name=" + encodeURIComponent(name);
      });
    </script>`,
};

let server: Server;
let baseURL: string;

before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    if (url.pathname.startsWith("/orders/")) {
      res.writeHead(200, { "content-type": "text/html" }).end(`<title>Order</title><h1>Order placed</h1><p>Thanks, ${url.searchParams.get("name")}</p>`);
      return;
    }
    const page = PAGES[url.pathname];
    res.writeHead(page ? 200 : 404, { "content-type": "text/html" }).end(page ?? "<h1>Not found</h1>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseURL = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

after(() => server.close());

/** Stands in for `browser-agent run`: writes a goal directory like Magpi's and prints the JSON result. */
function fakeMagpi(calls: string[][], options: { failFirst?: boolean } = {}): Spawner {
  let n = 0;
  return async (_command, args) => {
    calls.push(args);
    if (options.failFirst && calls.length === 1) {
      return { code: 0, stdout: JSON.stringify({ goalId: "goal_gaveup", status: "failed", turns: 2, tokens: 300, costUsd: 0.0002, checks: [{ passed: false, detail: "no match", predicate: 'text visible "Order placed"' }] }), stderr: "goal goal_gaveup\n" };
    }
    const root = args[args.indexOf("--root") + 1];
    const url = args[args.indexOf("--url") + 1];
    const goalId = `goal_fake${++n}`;
    const dir = path.join(root, "goals", goalId);
    await mkdir(dir, { recursive: true });
    const name = { role: "text", name: "Your name", tag: "input", inputType: "text" };
    const at = (p: string) => ({ url: new URL(p, url).href, title: "Order", controls: 3 });
    const events = [
      { type: "action", intent: "Type the buyer name", before: at("/order"), action: { kind: "type", ref: "e2", target: name, input: "Ada" }, after: at("/order"), outcome: { ok: true, detail: "" } },
      { type: "action", intent: "Submit the order", before: at("/order"), action: { kind: "click", ref: "e3", target: { role: "submit", name: "Place order", tag: "button" } }, after: at("/orders/0xdeadbeef1234?name=Ada"), outcome: { ok: true, detail: "" } },
    ];
    await writeFile(path.join(dir, "events.jsonl"), events.map((e) => JSON.stringify(e)).join("\n") + "\n");
    return { code: 0, stdout: JSON.stringify({ goalId, status: "success", turns: 4, tokens: 1000, costUsd: 0.001, checks: [{ passed: true, detail: "ok", predicate: "text_visible" }] }), stderr: `goal ${goalId}\n` };
  };
}

function routedModel() {
  return fakeModel(Array.from({ length: 20 }, () => (request: { system: string; user: string }) => {
    if (request.system.includes("QA brief")) {
      return { product: "Fixture Shop", summary: "A tiny shop.", users: ["buyer: orders"], areas: [{ id: "shop", title: "Shop", routes: ["/order"], source: ["src/pages/shop/"] }], flows: [{ title: "Place an order", area: "shop", why: "core purchase" }], testData: [], offLimits: ["no real payments"], fixtures: [] };
    }
    if (request.system.includes("mapping a web app")) {
      return {
        areas: [{ id: "shop", title: "Shop", routes: ["/order", "/"], summary: "ordering" }, { id: "wallet", title: "Wallet", routes: ["/shop/catalog"], summary: "" }],
        criticalPaths: [
          { id: "shop.order", area: "shop", title: "Place an order", startPath: "/order", why: "core purchase", priority: 1, lenses: ["happy"], fromBrief: true },
          { id: "wallet.passkey", area: "wallet", title: "Create a passkey wallet", startPath: "/shop/catalog", why: "identity", priority: 2, lenses: ["happy"], needsFixture: ["webauthn"] },
        ],
      };
    }
    if (request.system.includes("ONE concrete")) {
      return { title: "Place an order with a name", steps: ["Enter Ada as your name", "Click Place order"], expected: ["The order confirmation is shown"], criteria: [{ kind: "text_visible", text: "Order placed" }, { kind: "url_includes", text: "/orders" }] };
    }
    throw new Error(`unexpected prompt: ${request.system.slice(0, 80)}`);
  }));
}

test("magpi-test run: brief → map → guided + explore → accepted specs, manual cases, report", { timeout: 240_000 }, async () => {
  const { root, cleanup } = await tempTarget("target-basic");
  const previous = process.env.MAGPI_TEST_BASE_URL;
  process.env.MAGPI_TEST_BASE_URL = baseURL;
  try {
    await mkdir(path.join(root, "magpi-tests", "scenarios"), { recursive: true });
    await writeFile(path.join(root, "magpi-tests", "scenarios", "order-guided.md"), `# Guided order\n\narea: shop\nstart: /order\npriority: 1\n\n## Steps\n- Enter Ada\n- Place order\n\n## Expected\n- Confirmation\n\n## Criteria\n- text_visible: Order placed\n`);
    const calls: string[][] = [];
    const lines: string[] = [];
    const model = routedModel();
    const code = await main(["run", "--target", root], { model, magpiSpawner: fakeMagpi(calls), out: (l) => lines.push(l) });
    assert.equal(code, 0, lines.join("\n"));

    const mt = path.join(root, "magpi-tests");
    assert.match(await readFile(path.join(mt, "qa-brief.md"), "utf8"), /^<!-- generated by magpi-test init/);
    const map = JSON.parse(await readFile(path.join(mt, "state", "app-map.json"), "utf8"));
    assert.deepEqual(map.criticalPaths[0].sourceFiles, ["src/pages/shop/OrderForm.tsx", "src/pages/shop/OrderPage.tsx"]);
    // The real survey ran in the browser (a tsx `__name` helper once broke every page).
    const survey = JSON.parse(await readFile(path.join(mt, "state", "live-survey.json"), "utf8"));
    assert.deepEqual(survey.pages.filter((p: { error?: string }) => p.error), []);
    assert.deepEqual(survey.pages.find((p: { route: string }) => p.route === "/order").fields, ["Your name"]);

    const specs = (await readdir(path.join(mt, "specs"))).sort();
    assert.equal(specs.length, 2, lines.join("\n"));
    for (const spec of specs) {
      const source = await readFile(path.join(mt, "specs", spec), "utf8");
      assert.match(source, /getByRole\("textbox", \{ name: "Your name", exact: true \}\)\.fill\("Ada"\)/);
      assert.match(source, /toHaveURL\(new RegExp\("\\\\\/orders"\)\)/);
      assert.ok(!source.includes("e2"), "no Magpi refs in generated code");
    }

    // Every Magpi run had real criteria and the attach URL.
    assert.equal(calls.length, 2);
    for (const args of calls) {
      assert.ok(args.includes("--criterion"));
      assert.ok(args[args.indexOf("--url") + 1].startsWith(`${baseURL}/order`));
      assert.equal(args[args.indexOf("--policy") + 1], "auto");
    }

    const manual = await readFile(path.join(mt, "manual", "shop.md"), "utf8");
    assert.match(manual, /status: automated \(specs\//);
    assert.match(await readFile(path.join(mt, "manual", "wallet.md"), "utf8"), /status: needs-fixture \(webauthn\)/);
    const report = await readFile(path.join(mt, "state", "report.md"), "utf8");
    assert.match(report, /\| Accepted specs \| 2 \|/);
    assert.match(report, /Final replay of all accepted specs \(no AI, provider keys stripped\): 2\/2 passed/);

    // Answer-key canary never reached a prompt.
    for (const request of model.requests) assert.ok(!`${request.system}${request.user}`.includes("CANARY-7f3a"));

    // Resumable: a second run reuses the map, keeps accepted work, and makes no new Magpi runs.
    const secondModel = routedModel();
    const secondLines: string[] = [];
    const again = await main(["run", "--target", root], { model: secondModel, magpiSpawner: fakeMagpi(calls), out: (l) => secondLines.push(l) });
    assert.equal(again, 0);
    assert.equal(calls.length, 2);
    assert.match(secondLines.join("\n"), /app map: reusing/);
    assert.ok(!secondModel.requests.some((r) => r.system.includes("mapping a web app")));
    assert.ok(existsSync(path.join(mt, "playwright.config.ts")));
    const ignore = await readFile(path.join(mt, ".gitignore"), "utf8");
    assert.match(ignore, /^state\/magpi-home\/$/m);
    assert.doesNotMatch(ignore, /app-map|scenarios|trajectories|specs/);
  } finally {
    if (previous === undefined) delete process.env.MAGPI_TEST_BASE_URL;
    else process.env.MAGPI_TEST_BASE_URL = previous;
    await cleanup();
  }
});

test("a Magpi run that misses its criteria is retried once with the failed checks", { timeout: 120_000 }, async () => {
  const { root, cleanup } = await tempTarget("target-basic");
  const previous = process.env.MAGPI_TEST_BASE_URL;
  process.env.MAGPI_TEST_BASE_URL = baseURL;
  try {
    await mkdir(path.join(root, "magpi-tests", "scenarios"), { recursive: true });
    await writeFile(path.join(root, "magpi-tests", "scenarios", "order-guided.md"), `# Guided order\n\narea: shop\nstart: /order\npriority: 1\n\n## Steps\n- Enter Ada\n- Place order\n\n## Expected\n- Confirmation\n\n## Criteria\n- text_visible: Order placed\n`);
    const calls: string[][] = [];
    const lines: string[] = [];
    assert.equal(await main(["guided", "--target", root], { model: fakeModel([]), magpiSpawner: fakeMagpi(calls, { failFirst: true }), out: (l) => lines.push(l) }), 0);
    assert.equal(calls.length, 2, lines.join("\n"));
    assert.ok(!calls[0][1].includes("previous attempt"));
    assert.match(calls[1][1], /A previous attempt stopped after 2 turns[\s\S]*text visible "Order placed": no match/);
    assert.deepEqual(calls[0].filter((a) => a.startsWith("{")), calls[1].filter((a) => a.startsWith("{")), "criteria are identical across attempts");
    const record = JSON.parse(await readFile(path.join(root, "magpi-tests", "state", "runs", "order-guided.json"), "utf8"));
    assert.equal(record.attempts, 2);
    assert.equal(record.turns, 6);
    assert.match(lines.join("\n"), /guided order-guided: accepted/);

    // An environment quarantine is retried without --force; other quarantines are kept.
    const stateFile = path.join(root, "magpi-tests", "state", "scenarios", "order-guided.json");
    const saved = JSON.parse(await readFile(stateFile, "utf8"));
    await writeFile(stateFile, JSON.stringify({ ...saved, status: "quarantined", quarantine: { suspected: "environment", error: "stack down" } }));
    const retried: string[][] = [];
    assert.equal(await main(["guided", "--target", root], { model: fakeModel([]), magpiSpawner: fakeMagpi(retried), out: () => undefined }), 0);
    assert.equal(retried.length, 1);
    await writeFile(stateFile, JSON.stringify({ ...saved, status: "quarantined", quarantine: { suspected: "exploration", error: "criteria not met" } }));
    const notRetried: string[][] = [];
    assert.equal(await main(["guided", "--target", root], { model: fakeModel([]), magpiSpawner: fakeMagpi(notRetried), out: () => undefined }), 0);
    assert.equal(notRetried.length, 0);

    // A spend stop between attempts exits 4 and keeps the first attempt's record.
    const stopped: string[][] = [];
    const write = process.stderr.write;
    process.stderr.write = (() => true) as typeof process.stderr.write;
    try {
      assert.equal(await main(["guided", "--target", root, "--force", "--max-usd", "0.0001"], { model: fakeModel([]), magpiSpawner: fakeMagpi(stopped, { failFirst: true }), out: () => undefined }), 4);
    } finally {
      process.stderr.write = write;
    }
    assert.equal(stopped.length, 1);
    const kept = JSON.parse(await readFile(path.join(root, "magpi-tests", "state", "runs", "order-guided.json"), "utf8"));
    assert.equal(kept.attempts, 1);
    assert.equal(kept.goalId, "goal_gaveup");
  } finally {
    if (previous === undefined) delete process.env.MAGPI_TEST_BASE_URL;
    else process.env.MAGPI_TEST_BASE_URL = previous;
    await cleanup();
  }
});

test("docs-less target: init prints the agent prompt and exits 3", async () => {
  const { root, cleanup } = await tempTarget("target-nodocs");
  try {
    const lines: string[] = [];
    const model = fakeModel([]);
    assert.equal(await main(["init", "--target", root], { model, out: (l) => lines.push(l) }), 3);
    assert.equal(model.requests.length, 0);
    assert.match(lines.join("\n"), /secret\/\*\*/);
  } finally {
    await cleanup();
  }
});

test("environment not ready exits 2", async () => {
  const { root, cleanup } = await tempTarget("target-basic");
  const saved = { ...process.env };
  process.env.MAGPI_TEST_BASE_URL = "http://127.0.0.1:1";
  process.env.MAGPI_TEST_READY_TIMEOUT_MS = "300";
  const write = process.stderr.write;
  process.stderr.write = (() => true) as typeof process.stderr.write;
  try {
    await writeFile(path.join(root, "magpi-tests", "qa-brief.md"), "# QA brief: x\n\n## Product\nx\n");
    assert.equal(await main(["discover", "--target", root], { model: fakeModel([]), out: () => undefined }), 2);
  } finally {
    process.stderr.write = write;
    process.env = saved;
    await cleanup();
  }
});

test("budget exhaustion exits 4 with partial results", async () => {
  const { root, cleanup } = await tempTarget("target-basic");
  const previous = process.env.MAGPI_TEST_BASE_URL;
  process.env.MAGPI_TEST_BASE_URL = baseURL;
  const write = process.stderr.write;
  process.stderr.write = (() => true) as typeof process.stderr.write;
  try {
    assert.equal(await main(["run", "--target", root, "--max-tokens", "20"], { model: routedModel(), magpiSpawner: fakeMagpi([]), out: () => undefined }), 4);
    assert.ok(existsSync(path.join(root, "magpi-tests", "qa-brief.md")));
  } finally {
    process.stderr.write = write;
    if (previous === undefined) delete process.env.MAGPI_TEST_BASE_URL;
    else process.env.MAGPI_TEST_BASE_URL = previous;
    await cleanup();
  }
});
