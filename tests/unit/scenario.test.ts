import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { parseScenarioMarkdown, renderScenarioMarkdown, ScenarioFormatError } from "../../src/scenario/markdown.ts";
import { parseCriterionLine, PREDICATE_KINDS, validateScenario } from "../../src/scenario/types.ts";

const EXAMPLE = `# Create invoice with a custom payout address

area: commerce.create
start: /create
priority: 1

## Steps
- Choose a network and token
- Pick "custom address" for payout and enter 0x1111111111111111111111111111111111111111
- Enter amount 25
- Create the invoice

## Expected
- A pay link for the new invoice is shown
- The amount 25 is displayed

## Criteria
- text_visible: 25
- {"kind":"url_includes","text":"/pay"}
`;

test("parses the spec example", () => {
  const s = parseScenarioMarkdown(EXAMPLE);
  assert.equal(s.id, "create-invoice-with-a-custom-payout-address");
  assert.equal(s.area, "commerce.create");
  assert.equal(s.steps.length, 4);
  assert.deepEqual(s.criteria, [{ kind: "text_visible", text: "25" }, { kind: "url_includes", text: "/pay" }]);
  assert.equal(s.criteriaStatus, "human");
  assert.deepEqual(validateScenario(s), []);
});

test("unknown headings and keys are errors", () => {
  assert.throws(() => parseScenarioMarkdown(EXAMPLE.replace("## Expected", "## Outcome")), ScenarioFormatError);
  assert.throws(() => parseScenarioMarkdown(EXAMPLE.replace("priority: 1", "owner: me")), ScenarioFormatError);
});

test("render → parse round-trips", () => {
  const s = parseScenarioMarkdown(EXAMPLE);
  const again = parseScenarioMarkdown(renderScenarioMarkdown({ ...s, preconditions: ["signed out"], needsFixture: ["webauthn"] }));
  assert.deepEqual(again, { ...s, preconditions: ["signed out"], needsFixture: ["webauthn"] });
});

test("ref_exists is rejected", () => {
  const s = parseScenarioMarkdown(EXAMPLE.replace("- text_visible: 25", '- {"kind":"ref_exists","ref":"e1"}'));
  assert.match(validateScenario(s).join(), /ref_exists/);
});

test("unknown predicate fields are rejected", () => {
  const s = parseScenarioMarkdown(EXAMPLE.replace("- text_visible: 25", '- {"kind":"url_includes","text":"/pay","negate":true}'));
  assert.match(validateScenario(s).join(), /does not take negate/);
});

test("criterion shorthand", () => {
  assert.deepEqual(parseCriterionLine("control_exists: button|Create invoice"), { kind: "control_exists", role: "button", name: "Create invoice" });
  assert.deepEqual(parseCriterionLine("no_console_error:"), { kind: "no_console_error" });
  assert.deepEqual(parseCriterionLine("Invoice created"), { kind: "text_visible", text: "Invoice created" });
});

test("predicate kinds match Magpi's Predicate union", async () => {
  const source = await readFile(new URL("../../../browser-session-agent/src/core/types.ts", import.meta.url), "utf8").catch(() => undefined);
  if (!source) return; // Magpi checkout not present: the list in magpi-integration.md is the reference.
  const start = source.indexOf("export type Predicate");
  const union = source.slice(start, source.indexOf("\n\n", start));
  const kinds = [...union.matchAll(/kind: "([a-z_]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(kinds, [...PREDICATE_KINDS].sort());
});
