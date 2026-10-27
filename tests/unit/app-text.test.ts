import assert from "node:assert/strict";
import { test } from "node:test";
import { groundingErrors, isUiString, knownText, linkedPages, relatedStrings, uiStrings } from "../../src/discover/app-text.ts";
import type { SurveyedPage } from "../../src/discover/live-survey.ts";

const page = (route: string, extra: Partial<SurveyedPage> = {}): SurveyedPage => ({
  route, source: "scan", finalURL: `http://x${route}`, status: 200, title: "", headings: [], links: [], forms: [], buttons: [], fields: [], consoleErrors: [], truncated: false, ...extra,
});

test("uiStrings keeps human text and drops class lists, paths, identifiers, and code", () => {
  const source = `const a = "No invoices match these filters."; <p className="space-y-2 text-sm">Pay link missing</p>
    import x from "./OrderForm"; const k = "OrderForm"; const u = "https://x.dev"; t("create.whoLabel"); const s = \`Hi \${name}\`; <h1>Invoices</h1>`;
  assert.deepEqual(uiStrings(source).sort(), ["Invoices", "No invoices match these filters.", "Pay link missing"]);
  assert.equal(isUiString("EVM address must be a 0x-prefixed 40-hex-character address"), true);
  assert.equal(isUiString("text-sm font-medium"), false);
});

test("criteria must quote text the app can show, case-insensitively", () => {
  const isKnown = knownText({ pages: [page("/terms", { title: "Terms of Use · Shop", headings: ["Terms of Use"] })], strings: ["No invoices match these filters."] });
  assert.deepEqual(groundingErrors([{ kind: "text_visible", text: "terms of use" }, { kind: "text_absent", text: "No invoices match" }, { kind: "url_includes", text: "/made-up" }], isKnown), []);
  const errors = groundingErrors([{ kind: "text_visible", text: "Terms of Service" }, { kind: "all", of: [{ kind: "control_exists", role: "button", name: "Add a passkey" }] }], isKnown);
  assert.equal(errors.length, 2);
  assert.match(errors[0], /criteria\[0\]: "Terms of Service" does not appear/);
  assert.match(errors[1], /criteria\[1\]\.of\[0\]/);
});

test("linked pages and related strings feed the drafter", () => {
  const survey = { schemaVersion: 1 as const, baseURL: "http://x", implementation: "playwright" as const, pages: [
    page("/legal", { links: [{ name: "Terms", href: "http://x/terms" }, { name: "Away", href: "https://elsewhere.dev/terms" }] }),
    page("/terms", { headings: ["Terms of Use"] }),
    page("/broken", { error: "timeout" }),
  ] };
  assert.deepEqual(linkedPages(survey, "/legal").map((p) => p.route), ["/terms"]);
  assert.deepEqual(relatedStrings(["No invoices match these filters.", "Welcome back", "Invoice not found"], "View merchant invoices", "empty-or-error"), ["Invoice not found", "No invoices match these filters."]);
});

test("text_absent of start-page text is split off; other criteria are kept", async () => {
  const { withoutStartTextAbsent } = await import("../../src/discover/app-text.ts");
  const start = page("/legal", { headings: ["Legal documents"] });
  const criteria = [{ kind: "url_includes" as const, text: "/terms" }, { kind: "text_absent" as const, text: "legal documents" }, { kind: "text_absent" as const, text: "Your payment link is ready" }];
  const { kept, dropped } = withoutStartTextAbsent(criteria, start);
  assert.deepEqual(kept, [criteria[0], criteria[2]]);
  assert.deepEqual(dropped, [criteria[1]]);
  assert.deepEqual(withoutStartTextAbsent(criteria, undefined).kept, criteria);
});
