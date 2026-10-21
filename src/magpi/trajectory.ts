import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Predicate, Scenario } from "../scenario/types.ts";
import type { Action, Step, Target, Trajectory, Value } from "../synth/types.ts";

interface LedgerTarget {
  role: string;
  name: string;
  tag: string;
  href?: string;
  inputType?: string;
}

interface LedgerEvent {
  type: string;
  intent?: string;
  before?: { url: string; title: string };
  action?: { kind: string; ref?: string; url?: string; target?: LedgerTarget; input?: string };
  after?: { url: string; title: string };
  outcome?: { ok: boolean; detail: string };
}

export class TrajectoryBuildError extends Error {}

// `restore` is a marker: Magpi ledgers the navigate and re-type actions that rebuild the
// checkpoint just before it, so replaying the ledger in order already restores the page.
const IGNORED_KINDS = new Set(["scroll", "wait", "restore"]);
const ARIA_ROLES = new Set([
  "button", "link", "textbox", "searchbox", "checkbox", "radio", "combobox", "listbox", "option", "tab", "menuitem",
  "menuitemcheckbox", "menuitemradio", "switch", "slider", "spinbutton", "treeitem", "gridcell", "row", "cell", "heading", "img", "dialog",
]);

export async function readLedger(goalDir: string): Promise<LedgerEvent[]> {
  const text = await readFile(path.join(goalDir, "events.jsonl"), "utf8");
  return text.split("\n").filter(Boolean).map((line) => JSON.parse(line) as LedgerEvent);
}

/** Magpi's role is a snapshot role, not ARIA (magpi-integration.md "The second trap"). */
export function ariaRole(target: LedgerTarget): string | undefined {
  const role = target.role?.toLowerCase();
  const tag = target.tag?.toLowerCase();
  const inputType = target.inputType?.toLowerCase();
  if (role === "password" || inputType === "password") return undefined;
  if (role && ARIA_ROLES.has(role)) return role;
  const byRole: Record<string, string> = {
    a: "link", submit: "button", reset: "button", image: "button", text: "textbox", email: "textbox", tel: "textbox",
    url: "textbox", number: "spinbutton", search: "searchbox", "select-one": "combobox", "select-multiple": "listbox",
    textarea: "textbox", checkbox: "checkbox", radio: "radio", range: "slider",
  };
  if (role && byRole[role]) return byRole[role];
  if (tag === "a") return "link";
  if (tag === "button") return "button";
  if (tag === "textarea") return "textbox";
  if (tag === "select") return "combobox";
  if (tag === "input") return byRole[inputType ?? "text"] ?? "textbox";
  return undefined;
}

export function targetFor(target: LedgerTarget | undefined): Target {
  if (!target) throw new TrajectoryBuildError("ledger action has no target; Magpi must include MT-2.1 (ledger action target)");
  const name = (target.name ?? "").trim();
  const role = ariaRole(target);
  if (!role) {
    if (name) return { by: "label", text: name, exact: true };
    throw new TrajectoryBuildError(`unresolvable-target: ${target.tag} without a name`);
  }
  if (name) return { by: "role", role, name, exact: true };
  throw new TrajectoryBuildError(`unresolvable-target: ${role} without a name`);
}

/** Keep the stable prefix of a path: stop at the first id-like segment. Drops query strings. */
export function stablePath(urlOrPath: string, base = "http://x"): string {
  const pathname = new URL(urlOrPath, base).pathname;
  const kept: string[] = [];
  for (const segment of pathname.split("/").filter(Boolean)) {
    if (isDynamic(segment)) break;
    kept.push(segment);
  }
  return `/${kept.join("/")}`;
}

export function isDynamic(text: string): boolean {
  return /^0x[0-9a-f]{6,}$/i.test(text)
    || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)
    || /\d{5,}/.test(text)
    || /^[1-9A-HJ-NP-Za-km-z]{20,}$/.test(text);
}

function valueFor(input: string | undefined, target?: LedgerTarget): Value {
  const text = input ?? "";
  // Magpi redacts passwords on write; replay reads them from the environment instead.
  if (text === "[redacted]" || target?.inputType === "password") {
    return { env: `QA_SECRET_${(target?.name || "password").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "")}` };
  }
  // Self-isolating data (QD15): emails are the common uniqueness key.
  const email = text.match(/^([^@\s]+)@([^@\s]+\.[a-z]{2,})$/i);
  if (email) return { unique: `${email[1]}+{n}@${email[2]}` };
  return { literal: text };
}

function sameTarget(a: Action, b: Action): boolean {
  return "target" in a && "target" in b && JSON.stringify(a.target) === JSON.stringify(b.target);
}

export interface BuildOptions {
  scenario: Scenario;
  goalId: string;
  magpiRoot: string;
  magpiVersion: string;
  baseURL: string;
  attempt?: number;
}

/** The 7 steps in scenario-and-trajectory.md "Building a Trajectory from a Magpi goal". */
export function buildTrajectory(events: LedgerEvent[], options: BuildOptions): Trajectory {
  const base = new URL(options.baseURL);
  const steps: Step[] = [];
  for (const event of events) {
    if (event.type !== "action" || !event.action || event.outcome?.ok === false) continue;
    const kind = event.action.kind;
    if (IGNORED_KINDS.has(kind)) continue;
    const intent = (event.intent ?? kind).trim();
    let action: Action;
    if (kind === "navigate") {
      const target = new URL(event.action.url ?? "/", base);
      if (target.origin !== base.origin) throw new TrajectoryBuildError(`navigation leaves the app: ${target.origin}`);
      action = { kind: "goto", path: `${target.pathname}${target.search}` };
    } else if (kind === "click") {
      action = { kind: "click", target: targetFor(event.action.target) };
      if (event.action.target?.inputType === "checkbox") action = { kind: "check", target: action.target };
    } else if (kind === "type") {
      action = { kind: "fill", target: targetFor(event.action.target), value: valueFor(event.action.input, event.action.target) };
    } else if (kind === "select") {
      action = { kind: "select", target: targetFor(event.action.target), value: { literal: event.action.input ?? "" } };
    } else if (kind === "check") {
      action = { kind: "check", target: targetFor(event.action.target) };
    } else if (kind === "upload") {
      throw new TrajectoryBuildError("upload needs a fixture file to replay (M3); not supported in M1");
    } else {
      throw new TrajectoryBuildError(`unsupported Magpi action kind "${kind}"`);
    }
    const waitFor: Predicate[] = [];
    if (event.before?.url && event.after?.url && kind !== "navigate") {
      const before = new URL(event.before.url).pathname;
      const after = new URL(event.after.url);
      if (after.origin === base.origin && after.pathname !== before) {
        const stable = stablePath(after.pathname);
        if (stable !== "/") waitFor.push({ kind: "url_includes", text: stable });
      }
    }
    steps.push({ intent, action, ...(waitFor.length ? { waitFor } : {}) });
  }

  const collapsed: Step[] = [];
  for (const step of steps) {
    const previous = collapsed.at(-1);
    if (previous && previous.action.kind === "fill" && step.action.kind === "fill" && sameTarget(previous.action, step.action)) {
      collapsed[collapsed.length - 1] = step;
      continue;
    }
    if (previous && previous.action.kind === "click" && step.action.kind === "fill" && sameTarget(previous.action, step.action)) {
      collapsed[collapsed.length - 1] = step;
      continue;
    }
    collapsed.push(step);
  }
  // The spec starts with page.goto(startPath); a leading navigate there is redundant.
  const startPath = options.scenario.startPath;
  while (collapsed[0]?.action.kind === "goto" && stablePath(collapsed[0].action.path) === stablePath(startPath)) collapsed.shift();

  return {
    schemaVersion: 1,
    id: `${options.scenario.id}--${options.attempt ?? 1}`,
    scenarioId: options.scenario.id,
    title: options.scenario.title,
    source: { goalId: options.goalId, magpiRoot: options.magpiRoot, magpiVersion: options.magpiVersion, locatorRecovery: "ledger-target" },
    startPath,
    steps: collapsed,
    assertions: structuredClone(options.scenario.criteria),
    status: "draft",
    repairs: [],
  };
}
