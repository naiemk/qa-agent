/** Copied from Magpi `src/core/types.ts` (not exported). tests/unit/scenario.test.ts pins the kinds. */
export type Predicate =
  | { kind: "url_includes"; text: string }
  | { kind: "title_includes"; text: string }
  | { kind: "text_visible"; text: string }
  | { kind: "text_absent"; text: string }
  | { kind: "ref_exists"; ref: string }
  | { kind: "control_exists"; role?: string; name?: string }
  | { kind: "control_absent"; role?: string; name?: string }
  | { kind: "value_equals"; name: string; text: string }
  | { kind: "value_includes"; name: string; text: string }
  | { kind: "no_console_error" }
  | { kind: "dialog_open"; open: boolean }
  | { kind: "all"; of: Predicate[] }
  | { kind: "any"; of: Predicate[] }
  | { kind: "not"; of: Predicate };

export const PREDICATE_KINDS = [
  "url_includes", "title_includes", "text_visible", "text_absent", "ref_exists",
  "control_exists", "control_absent", "value_equals", "value_includes",
  "no_console_error", "dialog_open", "all", "any", "not",
] as const;

export const LENSES = ["happy", "invalid-input", "empty-or-error", "alternate-entry", "deep"] as const;
export type Lens = (typeof LENSES)[number];

export type ScenarioStatus = "pending" | "running" | "trajectory" | "accepted" | "quarantined" | "skipped";

export interface Scenario {
  schemaVersion: 1;
  id: string;
  title: string;
  source: "human" | "explore" | "discover";
  area: string;
  /** Critical path this scenario exercises, when known (QD17). */
  path?: string;
  lens: Lens;
  startPath: string;
  preconditions: string[];
  steps: string[];
  expected: string[];
  criteria: Predicate[];
  criteriaStatus: "human" | "compiled" | "approved" | "none";
  needsFixture?: string[];
  priority: 1 | 2 | 3;
  status: ScenarioStatus;
  notes?: string[];
  /** Filled by the pipeline. */
  specFile?: string;
  quarantine?: { suspected: string; error: string };
}

const PREDICATE_FIELDS: Record<string, string[]> = {
  url_includes: ["text"], title_includes: ["text"], text_visible: ["text"], text_absent: ["text"], ref_exists: ["ref"],
  control_exists: ["role", "name"], control_absent: ["role", "name"], value_equals: ["name", "text"], value_includes: ["name", "text"],
  no_console_error: [], dialog_open: ["open"], all: ["of"], any: ["of"], not: ["of"],
};

export function validatePredicate(value: unknown, where = "criterion"): string[] {
  if (!value || typeof value !== "object") return [`${where}: not an object`];
  const p = value as Record<string, unknown>;
  const kind = p.kind as string;
  if (!PREDICATE_KINDS.includes(kind as never)) return [`${where}: unknown kind ${String(kind)}`];
  // Unknown fields (a model's "negate": true) would be silently ignored by Magpi and the emitter.
  const extra = Object.keys(p).filter((key) => key !== "kind" && !PREDICATE_FIELDS[kind].includes(key));
  if (extra.length) return [`${where}: ${kind} does not take ${extra.join(", ")} (use text_absent / control_absent for negation)`];
  const needText = ["url_includes", "title_includes", "text_visible", "text_absent"];
  if (needText.includes(kind) && (typeof p.text !== "string" || !p.text)) return [`${where}: ${kind} needs text`];
  if ((kind === "value_equals" || kind === "value_includes") && (typeof p.name !== "string" || typeof p.text !== "string")) {
    return [`${where}: ${kind} needs name and text`];
  }
  if ((kind === "control_exists" || kind === "control_absent") && !p.role && !p.name) return [`${where}: ${kind} needs role or name`];
  if (kind === "dialog_open" && typeof p.open !== "boolean") return [`${where}: dialog_open needs open`];
  if (kind === "ref_exists") return [`${where}: ref_exists is not allowed (refs are per-session)`];
  if (kind === "all" || kind === "any") {
    if (!Array.isArray(p.of)) return [`${where}: ${kind} needs of[]`];
    return (p.of as unknown[]).flatMap((child, i) => validatePredicate(child, `${where}.of[${i}]`));
  }
  if (kind === "not") return validatePredicate(p.of, `${where}.of`);
  return [];
}

export function validateScenario(value: unknown): string[] {
  const s = value as Scenario;
  const errors: string[] = [];
  if (!s || typeof s !== "object") return ["scenario: not an object"];
  if (!/^[a-z0-9][a-z0-9-]*$/.test(s.id ?? "")) errors.push("id must be kebab-case");
  if (!s.title) errors.push("title is required");
  if (!s.area) errors.push("area is required");
  if (!LENSES.includes(s.lens)) errors.push(`lens must be one of ${LENSES.join(", ")}`);
  if (typeof s.startPath !== "string" || !s.startPath.startsWith("/")) errors.push("startPath must start with /");
  if (!Array.isArray(s.steps)) errors.push("steps must be an array");
  if (!Array.isArray(s.expected)) errors.push("expected must be an array");
  (s.criteria ?? []).forEach((c, i) => errors.push(...validatePredicate(c, `criteria[${i}]`)));
  if (![1, 2, 3].includes(s.priority)) errors.push("priority must be 1, 2, or 3");
  return errors;
}

export function slug(text: string, max = 60): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/, "") || "scenario";
}

/** "kind: text" shorthand or JSON, as Magpi's --criterion accepts. */
export function parseCriterionLine(line: string): Predicate {
  const trimmed = line.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed) as Predicate;
  const match = trimmed.match(/^([a-z_]+)\s*:\s*(.*)$/);
  if (match && PREDICATE_KINDS.includes(match[1] as never)) {
    const [, kind, rest] = match;
    if (kind === "no_console_error") return { kind };
    if (kind === "dialog_open") return { kind, open: rest.trim() !== "false" };
    if (kind === "control_exists" || kind === "control_absent") {
      const [role, ...name] = rest.split("|").map((part) => part.trim());
      return { kind, ...(role ? { role } : {}), ...(name.length ? { name: name.join("|") } : {}) };
    }
    return { kind, text: rest.trim() } as Predicate;
  }
  return { kind: "text_visible", text: trimmed };
}

export function formatCriterion(p: Predicate): string {
  switch (p.kind) {
    case "url_includes":
    case "title_includes":
    case "text_visible":
    case "text_absent":
      return `${p.kind}: ${p.text}`;
    case "no_console_error":
      return "no_console_error:";
    default:
      return JSON.stringify(p);
  }
}
