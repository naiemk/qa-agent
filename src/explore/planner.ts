import type { AppMap, CriticalPath } from "../discover/app-map.ts";
import { groundingErrors, knownText, linkedPages, relatedStrings, withoutStartTextAbsent, type AppText } from "../discover/app-text.ts";
import type { LiveSurvey, SurveyedPage } from "../discover/live-survey.ts";
import type { ModelClient } from "../model/index.ts";
import { CRITERIA_RULES, validateCriteria } from "../scenario/criteria.ts";
import { LENSES, slug, type Lens, type Predicate, type Scenario } from "../scenario/types.ts";
import { LENS_INSTRUCTIONS } from "./lenses.ts";

export interface Pass {
  id: string;
  path: CriticalPath;
  lens: Lens;
}

/** MT-5.1: critical paths in priority order × their lenses, skipping fixture flows. */
export function planPasses(map: AppMap, options: { maxPasses?: number; paths?: string[]; lenses?: Lens[] } = {}): { passes: Pass[]; skipped: CriticalPath[] } {
  const passes: Pass[] = [];
  const skipped: CriticalPath[] = [];
  const paths = [...map.criticalPaths].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  // Breadth first: every path's first lens before any path's second lens.
  const maxLenses = Math.max(0, ...paths.map((p) => p.lenses.length));
  for (const path of paths) {
    if (options.paths && !options.paths.includes(path.id)) continue;
    if (path.needsFixture.length) skipped.push(path);
  }
  for (let round = 0; round < maxLenses; round++) {
    for (const path of paths) {
      if (path.needsFixture.length || (options.paths && !options.paths.includes(path.id))) continue;
      const lens = path.lenses[round];
      if (!lens || (options.lenses && !options.lenses.includes(lens))) continue;
      passes.push({ id: `${slug(path.id, 50)}--${lens}`, path, lens });
    }
  }
  return { passes: passes.slice(0, options.maxPasses ?? 12), skipped };
}

interface DraftScenario {
  title: string;
  preconditions?: string[];
  steps: string[];
  expected: string[];
  criteria: Predicate[];
}

/**
 * Writes the candidate scenario for one pass from what the start page advertises.
 * Steps are guidance for Magpi, not code; criteria are fixed here, before the run.
 */
const pageLine = (p: SurveyedPage) => `${p.route} "${p.title}" — headings: ${p.headings.slice(0, 6).join(" | ")} — buttons: ${p.buttons.slice(0, 8).join(", ")}`;

export async function draftScenario(pass: Pass, survey: LiveSurvey, model: ModelClient, avoid: string[] = [], uiStrings: string[] = []): Promise<Scenario> {
  const page = survey.pages.find((p) => p.route === pass.path.startPath.split("?")[0]);
  const lens = LENS_INSTRUCTIONS[pass.lens];
  const appText: AppText = { pages: survey.pages.filter((p) => !p.error), strings: uiStrings };
  const grounded = appText.pages.length > 0 || uiStrings.length > 0;
  const isKnown = knownText(appText);
  const linked = linkedPages(survey, pass.path.startPath);
  const messages = relatedStrings(uiStrings, `${pass.path.title} ${pass.path.why} ${pass.path.startPath}`, pass.lens);
  const { value } = await model.completeJson<DraftScenario>({
    purpose: "explore.scenario",
    system:
      "You are a QA engineer writing ONE concrete, short end-to-end test scenario for a browser agent to execute in a local test environment. " +
      "Use only controls that exist on the page. Use obviously fake data (e.g. qa@example.com, 0x1111111111111111111111111111111111111111). " +
      `Lens: ${pass.lens}. ${lens.asks} The test asserts ${lens.asserts}.\n${CRITERIA_RULES}`,
    user: [
      `Critical path: ${pass.path.title} — ${pass.path.why}`,
      `Start path: ${pass.path.startPath}`,
      page
        ? `Start page "${page.title}"\nheadings: ${page.headings.join(" | ")}\nbuttons: ${page.buttons.join(", ")}\nfields: ${page.fields.join(", ")}\nlinks: ${page.links.slice(0, 30).map((l) => `${l.name} -> ${new URL(l.href).pathname}`).join(", ")}`
        : "Start page was not surveyed.",
      linked.length ? `Pages the start page links to:\n${linked.map(pageLine).join("\n")}` : "",
      messages.length ? `Text the app can show somewhere (from its source; it may belong to other pages):\n${messages.map((m) => `- ${m}`).join("\n")}` : "",
      grounded
        ? "Every text in criteria must be copied exactly from the page lists or the source text above. For where you end up, use text from the start page or the pages it links to; use source text only for a validation or error message this page shows."
        : "",
      avoid.length ? `Already covered, do something different:\n${avoid.map((a) => `- ${a}`).join("\n")}` : "",
    ].filter(Boolean).join("\n\n"),
    schemaHint: '{"title":"Create invoice with a custom payout address","preconditions":[],"steps":["Enter amount 25","Click Create invoice"],"expected":["The pay link page is shown"],"criteria":[{"kind":"url_includes","text":"/pay"}]}',
    validate: (v) => {
      const d = v as DraftScenario;
      if (!d || !d.title || !Array.isArray(d.steps) || !Array.isArray(d.expected)) return ["need title, steps[], expected[], criteria[]"];
      if (d.steps.length === 0 || d.steps.length > 12) return ["steps must have 1-12 items"];
      const errors = validateCriteria(d.criteria);
      if (errors.length || !grounded) return errors;
      const grounding = groundingErrors(d.criteria, isKnown);
      if (grounding.length) return grounding;
      return withoutStartTextAbsent(d.criteria, page).kept.length ? [] : ["every criterion only says start-page text disappears; add text or a URL the result shows"];
    },
  });
  const { kept, dropped } = withoutStartTextAbsent(value.criteria, page);
  return {
    schemaVersion: 1,
    id: slug(`${pass.path.id}-${pass.lens}-${value.title}`, 70),
    title: value.title,
    source: "explore",
    area: pass.path.area,
    path: pass.path.id,
    lens: pass.lens,
    startPath: pass.path.startPath,
    preconditions: value.preconditions ?? [],
    steps: value.steps,
    expected: value.expected,
    criteria: kept,
    criteriaStatus: "compiled",
    priority: pass.path.priority,
    status: "pending",
    ...(dropped.length ? { notes: [`dropped start-page text_absent: ${dropped.map((p) => JSON.stringify(p)).join(", ")}`] } : {}),
  };
}

export { LENSES };
