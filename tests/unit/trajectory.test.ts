import assert from "node:assert/strict";
import { test } from "node:test";
import { ariaRole, buildTrajectory, stablePath, TrajectoryBuildError } from "../../src/magpi/trajectory.ts";
import type { Scenario } from "../../src/scenario/types.ts";
import { validateTrajectory } from "../../src/synth/types.ts";

const scenario: Scenario = {
  schemaVersion: 1, id: "create-order", title: "Create an order", source: "human", area: "shop", lens: "happy", startPath: "/order",
  preconditions: [], steps: [], expected: [], criteria: [{ kind: "text_visible", text: "Order placed" }], criteriaStatus: "human", priority: 1, status: "running",
};
const base = { goalId: "goal_1", magpiRoot: "/tmp/m", magpiVersion: "0.1.8", baseURL: "http://127.0.0.1:4599", scenario };
const at = (url: string) => ({ url: `http://127.0.0.1:4599${url}`, title: "t", controls: 3 });

const events = [
  { type: "action", intent: "open order page", before: at("/"), action: { kind: "navigate", url: "http://127.0.0.1:4599/order" }, after: at("/order"), outcome: { ok: true, detail: "" } },
  { type: "action", intent: "focus name", before: at("/order"), action: { kind: "click", ref: "e3", target: { role: "text", name: "Your name", tag: "input", inputType: "text" } }, after: at("/order"), outcome: { ok: true, detail: "" } },
  { type: "action", intent: "type name", before: at("/order"), action: { kind: "type", ref: "e3", target: { role: "text", name: "Your name", tag: "input", inputType: "text" }, input: "Ad" }, after: at("/order"), outcome: { ok: true, detail: "" } },
  { type: "action", intent: "type full name", before: at("/order"), action: { kind: "type", ref: "e3", target: { role: "text", name: "Your name", tag: "input", inputType: "text" }, input: "Ada" }, after: at("/order"), outcome: { ok: true, detail: "" } },
  { type: "failure", intent: "bad click", before: at("/order"), action: { kind: "click", ref: "e9" }, outcome: { ok: false, detail: "" } },
  { type: "note", intent: "thinking" },
  { type: "action", intent: "scroll", before: at("/order"), action: { kind: "scroll" }, after: at("/order"), outcome: { ok: true, detail: "" } },
  { type: "action", intent: "password", before: at("/order"), action: { kind: "type", ref: "e4", target: { role: "password", name: "Password", tag: "input", inputType: "password" }, input: "[redacted]" }, after: at("/order"), outcome: { ok: true, detail: "" } },
  { type: "action", intent: "email", before: at("/order"), action: { kind: "type", ref: "e5", target: { role: "email", name: "Email", tag: "input", inputType: "email" }, input: "qa@example.com" }, after: at("/order"), outcome: { ok: true, detail: "" } },
  { type: "action", intent: "size", before: at("/order"), action: { kind: "select", ref: "e6", target: { role: "select-one", name: "Size", tag: "select" }, input: "L" }, after: at("/order"), outcome: { ok: true, detail: "" } },
  { type: "action", intent: "place order", before: at("/order"), action: { kind: "click", ref: "e7", target: { role: "submit", name: "Place order", tag: "button" } }, after: at("/orders/0xabcdef1234567890/view?x=1"), outcome: { ok: true, detail: "" } },
];

test("builds a ref-free trajectory with the spec's rules", () => {
  const t = buildTrajectory(events, base);
  assert.deepEqual(validateTrajectory(t), []);
  assert.ok(!JSON.stringify(t).includes('"e3"'));
  assert.deepEqual(t.steps.map((s) => s.action.kind), ["fill", "fill", "fill", "select", "click"]);
  assert.deepEqual(t.steps[0].action, { kind: "fill", target: { by: "role", role: "textbox", name: "Your name", exact: true }, value: { literal: "Ada" } });
  assert.deepEqual((t.steps[1].action as { target: unknown }).target, { by: "label", text: "Password", exact: true });
  assert.deepEqual((t.steps[1].action as { value: unknown }).value, { env: "QA_SECRET_PASSWORD" });
  assert.deepEqual((t.steps[2].action as { value: unknown }).value, { unique: "qa+{n}@example.com" });
  assert.deepEqual((t.steps[3].action as { target: unknown }).target, { by: "role", role: "combobox", name: "Size", exact: true });
  assert.deepEqual(t.steps[4].waitFor, [{ kind: "url_includes", text: "/orders" }]);
  assert.deepEqual(t.assertions, scenario.criteria);
  assert.equal(t.source.locatorRecovery, "ledger-target");
});

test("unsupported kinds and target-less actions fail clearly", () => {
  assert.throws(() => buildTrajectory([{ type: "action", action: { kind: "upload" }, outcome: { ok: true, detail: "" } }], base), /unsupported Magpi action kind "upload"/);
  assert.throws(() => buildTrajectory([{ type: "action", action: { kind: "click", ref: "e1" }, outcome: { ok: true, detail: "" } }], base), TrajectoryBuildError);
  assert.throws(() => buildTrajectory([{ type: "action", action: { kind: "navigate", url: "https://evil.example/" }, outcome: { ok: true, detail: "" } }], base), /leaves the app/);
});

test("aria role mapping follows the magpi-integration table", () => {
  assert.equal(ariaRole({ role: "a", name: "x", tag: "a" }), "link");
  assert.equal(ariaRole({ role: "submit", name: "x", tag: "button" }), "button");
  assert.equal(ariaRole({ role: "search", name: "x", tag: "input", inputType: "search" }), "searchbox");
  assert.equal(ariaRole({ role: "tab", name: "x", tag: "div" }), "tab");
  assert.equal(ariaRole({ role: "password", name: "x", tag: "input", inputType: "password" }), undefined);
  assert.equal(ariaRole({ role: "div", name: "x", tag: "div" }), undefined);
});

test("stablePath cuts at ids and drops queries", () => {
  assert.equal(stablePath("/pay/0xabcdef12345678?amount=1"), "/pay");
  assert.equal(stablePath("/orders/550e8400-e29b-41d4-a716-446655440000/view"), "/orders");
  assert.equal(stablePath("/merchant/settings"), "/merchant/settings");
});
