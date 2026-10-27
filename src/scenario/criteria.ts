import { chromium } from "@playwright/test";
import type { ModelClient } from "../model/index.ts";
import { evaluateOnPage } from "../synth/assertions.ts";
import { isDynamic } from "../magpi/trajectory.ts";
import { validatePredicate, type Predicate } from "./types.ts";

export const CRITERIA_RULES = [
  "Criteria are checked in code on the final page, so they must be exact visible strings or URL fragments from the app.",
  "Allowed kinds: url_includes, title_includes, text_visible, text_absent, control_exists {role,name}, control_absent, value_equals {name,text}, value_includes, dialog_open {open}.",
  "Include at least one criterion that is FALSE on the start page before any action (otherwise a do-nothing run passes): text or a URL fragment the result shows, not the disappearance of start-page text.",
  "Never use values that change per run: addresses (0x...), ids, UUIDs, hashes, timestamps, long numbers. Assert the stable label instead.",
  "Prefer 1-3 criteria. Do not use any, not, or ref_exists.",
].join("\n");

export function dynamicValueErrors(criteria: Predicate[]): string[] {
  const errors: string[] = [];
  for (const [i, c] of criteria.entries()) {
    const text = "text" in c ? c.text : "";
    if (text && text.split(/[\s/?=&]+/).some((part) => isDynamic(part))) errors.push(`criteria[${i}] uses a per-run value "${text}"`);
    if (c.kind === "any" || c.kind === "not") errors.push(`criteria[${i}]: ${c.kind} is not supported`);
  }
  return errors;
}

export function validateCriteria(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) return ["need a non-empty array of criteria"];
  const errors = value.flatMap((c, i) => validatePredicate(c, `criteria[${i}]`));
  return errors.length ? errors : dynamicValueErrors(value as Predicate[]);
}

export interface StartPageFacts {
  url: string;
  title: string;
  headings: string[];
  controls: string[];
}

export type TrivialCheck = (startURL: string, criteria: Predicate[]) => Promise<boolean>;

/** True when every predicate already passes on a fresh load of the start page. */
export const trivialOnStartPage: TrivialCheck = async (startURL, criteria) => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const consoleErrors: string[] = [];
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
    await page.goto(startURL, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => undefined);
    for (const criterion of criteria) if (!(await evaluateOnPage(page, criterion, consoleErrors))) return false;
    return true;
  } finally {
    await browser.close();
  }
};

/** MT-4.2: expected outcome → predicates, fixed before the run. Human criteria are never changed. */
export async function compileCriteria(
  input: { title: string; startPath: string; steps: string[]; expected: string[]; page?: StartPageFacts },
  model: ModelClient,
): Promise<Predicate[]> {
  const { value } = await model.completeJson<Predicate[]>({
    purpose: "criteria",
    system: `You turn a test scenario's expected outcome into machine-checkable success criteria.\n${CRITERIA_RULES}`,
    user: [
      `Scenario: ${input.title}`,
      `Start path: ${input.startPath}`,
      `Steps:\n${input.steps.map((s) => `- ${s}`).join("\n")}`,
      `Expected:\n${input.expected.map((s) => `- ${s}`).join("\n")}`,
      input.page ? `Start page: "${input.page.title}"; headings: ${input.page.headings.join(" | ")}; controls: ${input.page.controls.slice(0, 40).join(", ")}` : "",
    ].join("\n\n"),
    schemaHint: '[{"kind":"text_visible","text":"Invoice created"},{"kind":"url_includes","text":"/pay"}]',
    validate: validateCriteria,
  });
  return value;
}
