import { LENSES, formatCriterion, parseCriterionLine, slug, type Lens, type Scenario } from "./types.ts";

/**
 * The guided scenario format. The manual test renderer writes the same format plus one
 * `status:` line, so a corrected manual case is a valid guided input (QD16).
 */
const FRONT_KEYS = ["id", "area", "path", "start", "priority", "lens", "status", "fixtures"] as const;
const SECTIONS = ["preconditions", "steps", "expected", "criteria", "notes"] as const;

export class ScenarioFormatError extends Error {}

export function parseScenarioMarkdown(text: string, fallbackId?: string): Scenario {
  const lines = text.split(/\r?\n/);
  let title = "";
  const front: Record<string, string> = {};
  const sections: Record<string, string[]> = {};
  let current: string | undefined;
  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trimEnd();
    if (!line.trim() || line.trim().startsWith("<!--")) continue;
    const where = `line ${index + 1}`;
    if (line.startsWith("# ")) {
      if (title) throw new ScenarioFormatError(`${where}: only one title allowed`);
      title = line.slice(2).trim();
      continue;
    }
    if (line.startsWith("## ")) {
      const name = line.slice(3).trim().toLowerCase();
      if (!SECTIONS.includes(name as never)) throw new ScenarioFormatError(`${where}: unknown heading "${line.slice(3).trim()}"`);
      current = name;
      sections[name] = [];
      continue;
    }
    if (current) {
      const item = line.replace(/^\s*(?:[-*]|\d+[.)])\s+/, "").trim();
      sections[current].push(item);
      continue;
    }
    const match = line.match(/^([a-z]+):\s*(.*)$/);
    if (!match) throw new ScenarioFormatError(`${where}: expected "key: value" before the first section`);
    if (!FRONT_KEYS.includes(match[1] as never)) throw new ScenarioFormatError(`${where}: unknown key "${match[1]}"`);
    front[match[1]] = match[2].trim();
  }
  if (!title) throw new ScenarioFormatError("missing # title");
  if (!front.area) throw new ScenarioFormatError("missing area:");
  if (!front.start) throw new ScenarioFormatError("missing start:");
  const lens = (front.lens ?? "happy") as Lens;
  if (!LENSES.includes(lens)) throw new ScenarioFormatError(`unknown lens ${lens}`);
  const priority = Number(front.priority ?? 2);
  if (![1, 2, 3].includes(priority)) throw new ScenarioFormatError("priority must be 1, 2, or 3");
  const criteria = (sections.criteria ?? []).map((line) => parseCriterionLine(line));
  return {
    schemaVersion: 1,
    id: front.id || fallbackId || slug(title),
    title,
    source: "human",
    area: front.area,
    ...(front.path ? { path: front.path } : {}),
    lens,
    startPath: front.start,
    preconditions: sections.preconditions ?? [],
    steps: sections.steps ?? [],
    expected: sections.expected ?? [],
    criteria,
    criteriaStatus: criteria.length ? "human" : "none",
    ...(front.fixtures ? { needsFixture: front.fixtures.split(",").map((f) => f.trim()).filter(Boolean) } : {}),
    priority: priority as 1 | 2 | 3,
    status: "pending",
    ...(sections.notes?.length ? { notes: sections.notes } : {}),
  };
}

export function renderScenarioMarkdown(scenario: Scenario, status?: string): string {
  const out = [`# ${scenario.title}`, "", `id: ${scenario.id}`, `area: ${scenario.area}`];
  if (scenario.path) out.push(`path: ${scenario.path}`);
  out.push(`start: ${scenario.startPath}`, `priority: ${scenario.priority}`, `lens: ${scenario.lens}`);
  if (scenario.needsFixture?.length) out.push(`fixtures: ${scenario.needsFixture.join(", ")}`);
  if (status) out.push(`status: ${status}`);
  const section = (name: string, items: string[], numbered = false) => {
    if (!items.length) return;
    out.push("", `## ${name}`);
    items.forEach((item, i) => out.push(numbered ? `${i + 1}. ${item}` : `- ${item}`));
  };
  section("Preconditions", scenario.preconditions);
  section("Steps", scenario.steps, true);
  section("Expected", scenario.expected);
  section("Criteria", scenario.criteria.map(formatCriterion));
  section("Notes", scenario.notes ?? []);
  return `${out.join("\n")}\n`;
}
