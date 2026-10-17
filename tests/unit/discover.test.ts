import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { buildAppMap, inferFixtures, routeMatches } from "../../src/discover/app-map.ts";
import { agentPrompt, briefFromDocs, collectDocs, GENERATED_HEADER, parseBrief, renderBrief, type QaBrief } from "../../src/discover/brief.ts";
import { computeImpact } from "../../src/discover/impact.ts";
import type { LiveSurvey } from "../../src/discover/live-survey.ts";
import { findRoutes, importsOf, staticScan } from "../../src/discover/static-scan.ts";
import { fileAccess } from "../../src/files/index.ts";
import { fakeModel } from "../../src/model/fake.ts";
import type { Scenario } from "../../src/scenario/types.ts";
import { tempDir, tempTarget } from "../helpers.ts";

const INCLUDE = ["README.md", "AGENTS.md", "docs/**/*.md", "src/**/*.{ts,tsx}", "e2e/helpers/**"];

test("static scan resolves nested routers, source files, docs, helpers, hints — never the answer key", async () => {
  const { root, cleanup } = await tempTarget("target-basic");
  try {
    const scan = await staticScan(fileAccess(root, ["e2e/*.spec.ts"]), INCLUDE, ["e2e/helpers/**"]);
    assert.deepEqual(scan.routes.map((r) => r.path), ["/", "/order", "/shop", "/shop/catalog", "/shop/item/:id"].map((p) => (p === "/shop" ? "/shop/*" : p)));
    const order = scan.routes.find((r) => r.path === "/order")!;
    assert.deepEqual(order.sourceFiles, ["src/pages/shop/OrderForm.tsx", "src/pages/shop/OrderPage.tsx"]);
    assert.equal(order.file, "src/App.tsx");
    assert.deepEqual(scan.routes.find((r) => r.path === "/shop/catalog")!.sourceFiles, ["src/pages/shop/CatalogPage.tsx"]);
    assert.deepEqual(scan.helpers, [{ file: "e2e/helpers/wallet.ts", exports: ["fundWallet", "devOtp"] }]);
    assert.ok(scan.docs.some((d) => d.file === "docs/guide.md" && d.headings.includes("Ordering")));
    assert.ok(scan.locatorHints.some((h) => h.testIds.includes("order-form")));
    assert.ok(!JSON.stringify(scan).includes("answer-key-route"));
    assert.ok(!JSON.stringify(scan).includes("CANARY"));
  } finally {
    await cleanup();
  }
});

test("route regexes cover JSX, Component props, and route objects", () => {
  assert.deepEqual(findRoutes(`<Route path="/a" element={<A/>} />\n<Route path={"/b"} Component={B} />`).map((r) => [r.path, r.component]), [["/a", "A"], ["/b", "B"]]);
  assert.deepEqual(findRoutes(`createBrowserRouter([{ path: "/c", element: <C /> }])`).map((r) => [r.path, r.component]), [["/c", "C"]]);
  assert.equal(importsOf(`import X, { Y as Z } from "./y";`).get("Z"), "./y");
});

const BRIEF: QaBrief = {
  product: "Fixture Shop",
  summary: "A tiny shop.",
  users: ["buyer: places orders"],
  areas: [{ id: "shop", title: "Shop", routes: ["/order", "/shop/catalog"], source: ["src/pages/shop/"] }],
  flows: [{ title: "Place an order", area: "shop", why: "core purchase" }],
  testData: ["any name works"],
  offLimits: ["never pay for real"],
  fixtures: [],
};

test("brief renders and parses back; unknown headings fail", () => {
  const text = renderBrief(BRIEF, GENERATED_HEADER);
  assert.deepEqual(parseBrief(text), BRIEF);
  assert.equal(renderBrief(parseBrief(text), GENERATED_HEADER), text);
  assert.throws(() => parseBrief(text.replace("## Test data", "## Data")), /unknown heading/);
});

test("brief ingest reads the repo's docs within budget and keeps the canary out", async () => {
  const { root, cleanup } = await tempTarget("target-basic");
  try {
    const docs = await collectDocs(fileAccess(root, ["e2e/*.spec.ts"]));
    assert.equal(docs.thin, false);
    assert.deepEqual(docs.files.map((d) => d.file), ["AGENTS.md", "README.md", "docs/guide.md"]);
    const log = path.join(await tempDir(), "prompts.jsonl");
    const model = fakeModel([BRIEF], log);
    assert.deepEqual(await briefFromDocs(docs, model), BRIEF);
    const prompts = await readFile(log, "utf8");
    assert.ok(prompts.length < 40_000);
    assert.ok(!prompts.includes("CANARY-7f3a"));
  } finally {
    await cleanup();
  }
});

test("a docs-less repo is thin and the agent prompt names the answer key", async () => {
  const { root, cleanup } = await tempTarget("target-nodocs");
  try {
    assert.equal((await collectDocs(fileAccess(root, ["secret/**"]))).thin, true);
    const prompt = agentPrompt("magpi-tests/qa-brief.md", ["secret/**", "e2e/*.spec.ts"]);
    assert.match(prompt, /- secret\/\*\*/);
    assert.match(prompt, /- e2e\/\*\.spec\.ts/);
    assert.match(prompt, /Write only that file/);
  } finally {
    await cleanup();
  }
});

const survey: LiveSurvey = {
  schemaVersion: 1, baseURL: "http://x", implementation: "playwright",
  pages: [
    { route: "/", source: "scan", finalURL: "http://x/", status: 200, title: "Home", headings: ["Shop"], links: [], forms: [], buttons: [], fields: [], consoleErrors: [], truncated: false },
    { route: "/order", source: "scan", finalURL: "http://x/order", status: 200, title: "Order", headings: ["Order"], links: [], forms: [{ fields: ["Your name"], submits: ["Place order"] }], buttons: ["Place order"], fields: ["Your name"], consoleErrors: [], truncated: false },
  ],
};

test("app map rejects invented routes, keeps source files from the scan, and infers fixtures", async () => {
  const { root, cleanup } = await tempTarget("target-basic");
  try {
    const scan = await staticScan(fileAccess(root, ["e2e/*.spec.ts"]), INCLUDE, ["e2e/helpers/**"]);
    const bad = { areas: [{ id: "shop", title: "Shop", routes: ["/order"], summary: "" }], criticalPaths: [{ id: "shop.ghost", area: "shop", title: "Ghost", startPath: "/ghost", why: "", priority: 1 }] };
    const good = {
      areas: [{ id: "shop", title: "Shop", routes: ["/order", "/shop/catalog"], summary: "orders" }, { id: "account", title: "Account", routes: ["/"], summary: "" }],
      criticalPaths: [
        { id: "shop.order", area: "shop", title: "Place an order", startPath: "/order", why: "core", priority: 1, lenses: ["happy", "invalid-input", "bogus"], sourceFiles: ["made/up.ts"], fromBrief: true },
        { id: "account.wallet-passkey", area: "account", title: "Create wallet with passkey", startPath: "/shop/item/42", why: "identity", priority: 2, needsFixture: [] },
      ],
    };
    const model = fakeModel([bad, good]);
    const map = await buildAppMap(scan, survey, model, BRIEF);
    assert.match(model.requests[1].user, /not a known route/);
    assert.deepEqual(map.criticalPaths[0].sourceFiles, ["src/pages/shop/OrderForm.tsx", "src/pages/shop/OrderPage.tsx"]);
    assert.deepEqual(map.criticalPaths[0].lenses, ["happy", "invalid-input"]);
    assert.equal(map.criticalPaths[0].fromBrief, true);
    assert.deepEqual(map.criticalPaths[1].needsFixture, ["webauthn"]);
    assert.deepEqual(map.areas[0].sourceFiles, ["src/pages/shop/CatalogPage.tsx", "src/pages/shop/OrderForm.tsx", "src/pages/shop/OrderPage.tsx"]);
    assert.ok(model.requests[0].user.includes("Place an order (shop)"));
  } finally {
    await cleanup();
  }
});

test("route matching and fixture inference", () => {
  assert.equal(routeMatches("/merchant/settings?x=1", ["/merchant/*"]), "/merchant/*");
  assert.equal(routeMatches("/shop/item/9", ["/shop/item/:id"]), "/shop/item/:id");
  assert.equal(routeMatches("/nope", ["/"]), undefined);
  assert.deepEqual(inferFixtures("verify email OTP then fund"), ["email-otp", "funding"]);
});

test("impact maps changed files to areas, specs, and re-explore", () => {
  const map = {
    schemaVersion: 1 as const, generatedAt: "", unexplored: [],
    areas: [{ id: "shop", title: "", routes: [], summary: "", sourceFiles: ["src/pages/shop/OrderPage.tsx"] }, { id: "legal", title: "", routes: [], summary: "", sourceFiles: ["src/pages/Legal.tsx"] }],
    criticalPaths: [{ id: "shop.order", area: "shop", title: "", startPath: "/order", why: "", priority: 1 as const, needsFixture: [], lenses: [], sourceFiles: ["src/pages/shop/OrderPage.tsx"], fromBrief: false }],
  };
  const accepted = { id: "a", area: "shop", path: "shop.order", status: "accepted", specFile: "specs/a.spec.ts" } as Scenario;
  const impact = computeImpact("main", ["src/pages/shop/OrderPage.tsx", "src/pages/Legal.tsx", "package.json"], map, [accepted]);
  assert.deepEqual(impact.areas, ["legal", "shop"]);
  assert.deepEqual(impact.paths, ["shop.order"]);
  assert.deepEqual(impact.rerunSpecs, ["specs/a.spec.ts"]);
  assert.deepEqual(impact.reexploreAreas, ["legal"]);
  assert.deepEqual(impact.unmapped, ["package.json"]);
});
