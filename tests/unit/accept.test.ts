import assert from "node:assert/strict";
import { test } from "node:test";
import { checkIsolation } from "../../src/accept/isolation.ts";
import { applyRepair, proposeRepair } from "../../src/accept/repair.ts";
import { classifyError, parseReport } from "../../src/accept/run.ts";
import { fakeModel } from "../../src/model/fake.ts";
import { planPasses } from "../../src/explore/planner.ts";
import { renderManual, splitManual } from "../../src/manual/index.ts";
import { parseScenarioMarkdown } from "../../src/scenario/markdown.ts";
import type { Scenario } from "../../src/scenario/types.ts";
import { sampleTrajectory } from "./emit.test.ts";

test("failure classification from Playwright messages", () => {
  assert.equal(classifyError("Error: expect(locator).toBeVisible() failed\n\nLocator: getByText('x')"), "assertion");
  assert.equal(classifyError("Error: locator.click: Timeout 10000ms exceeded.\nCall log:\n  - waiting for getByRole('button', { name: 'Go' })"), "locator");
  assert.equal(classifyError("Error: locator.fill: Error: strict mode violation: getByLabel('Name') resolved to 2 elements"), "locator");
  assert.equal(classifyError("Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:1/"), "environment");
  assert.equal(classifyError("Test timeout of 60000ms exceeded."), "timeout");
});

test("parseReport counts repeats and keeps the first error with its ARIA snapshot", async () => {
  const report = { suites: [{ file: "a.spec.ts", specs: [{ file: "a.spec.ts", tests: [{ results: [
    { status: "passed" },
    { status: "failed", error: { message: "Error: expect(locator).toBeVisible() failed", location: { line: 9 } }, attachments: [{ name: "error-context", body: Buffer.from("- button \"Go\"").toString("base64") }] },
    { status: "passed" },
  ] }] }] }] };
  const [run] = await parseReport(report, "/tmp");
  assert.equal(run.passed, 2);
  assert.equal(run.failed, 1);
  assert.equal(run.error?.class, "assertion");
  assert.equal(run.error?.ariaSnapshot, '- button "Go"');
});

test("isolation rejects assertions on shared state (QD15)", () => {
  assert.deepEqual(checkIsolation(sampleTrajectory), []);
  const stateful = { ...sampleTrajectory, assertions: [{ kind: "text_visible" as const, text: "No invoices yet" }] };
  assert.match(checkIsolation(stateful).join(), /shared state/);
});

test("repair may change targets but never assertions", async () => {
  const failure = { message: "locator.click: Timeout", class: "locator" as const, ariaSnapshot: '- button "Place my order"' };
  const model = fakeModel([
    { changes: [{ step: 5, target: { by: "role", role: "button", name: "Place my order" } }], assertions: [], why: "x" },
    { changes: [{ step: 5, target: { by: "role", role: "button", name: "Place my order", exact: true }, why: "name differs" }] },
  ]);
  const proposal = await proposeRepair(sampleTrajectory, failure, model);
  assert.match(model.requests[1].user, /assertions cannot be changed/);
  const repaired = applyRepair(sampleTrajectory, proposal, failure.message);
  assert.deepEqual((repaired.steps[5].action as { target: unknown }).target, { by: "role", role: "button", name: "Place my order", exact: true });
  assert.deepEqual(repaired.assertions, sampleTrajectory.assertions);
  assert.equal(repaired.repairs.length, 1);
});

const scenario = (over: Partial<Scenario>): Scenario => ({
  schemaVersion: 1, id: "s", title: "Place an order", source: "explore", area: "shop", lens: "happy", startPath: "/order", preconditions: [],
  steps: ["Enter name Ada", "Click Place order"], expected: ["Order placed"], criteria: [{ kind: "text_visible", text: "Order placed" }],
  criteriaStatus: "compiled", priority: 1, status: "accepted", specFile: "specs/s.spec.ts", ...over,
});

test("manual cases round-trip into guided scenarios (QD16)", () => {
  const scenarios = [
    scenario({}),
    scenario({ id: "q", title: "Bad name", lens: "invalid-input", status: "quarantined", quarantine: { suspected: "criteria", error: "x" }, specFile: undefined }),
    scenario({ id: "w", area: "wallet", title: "Create wallet", status: "skipped", needsFixture: ["webauthn"], steps: [], criteria: [], specFile: undefined }),
  ];
  const files = renderManual(scenarios);
  assert.deepEqual([...files.keys()], ["shop.md", "wallet.md"]);
  assert.match(files.get("shop.md")!, /status: automated \(specs\/s\.spec\.ts\)/);
  assert.match(files.get("shop.md")!, /status: quarantined \(criteria\)/);
  assert.match(files.get("wallet.md")!, /status: needs-fixture \(webauthn\)/);
  const cases = splitManual(files.get("shop.md")!).map((text) => parseScenarioMarkdown(text));
  assert.equal(cases.length, 2);
  for (const parsed of cases) {
    const original = scenarios.find((s) => s.id === parsed.id)!;
    for (const key of ["title", "area", "lens", "startPath", "steps", "expected", "criteria", "priority"] as const) assert.deepEqual(parsed[key], original[key]);
  }
});

test("pass planner: breadth first by priority, skips fixture paths, respects filters", () => {
  const p = (id: string, priority: 1 | 2 | 3, lenses: Scenario["lens"][], needsFixture: string[] = []) => ({ id, area: "a", title: id, startPath: "/", why: "", priority, needsFixture, lenses, sourceFiles: [], fromBrief: false });
  const map = { schemaVersion: 1 as const, generatedAt: "", areas: [], unexplored: [], criticalPaths: [p("b", 2, ["happy"]), p("a", 1, ["happy", "invalid-input"]), p("w", 1, ["happy"], ["webauthn"])] };
  const { passes, skipped } = planPasses(map);
  assert.deepEqual(passes.map((x) => x.id), ["a--happy", "b--happy", "a--invalid-input"]);
  assert.deepEqual(skipped.map((x) => x.id), ["w"]);
  assert.deepEqual(planPasses(map, { maxPasses: 1 }).passes.map((x) => x.id), ["a--happy"]);
  assert.deepEqual(planPasses(map, { lenses: ["invalid-input"] }).passes.map((x) => x.id), ["a--invalid-input"]);
});
