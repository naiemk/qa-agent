import type { Predicate } from "../scenario/types.ts";

export type Target =
  | { by: "role"; role: string; name: string; exact?: boolean }
  | { by: "label"; text: string; exact?: boolean }
  | { by: "placeholder"; text: string }
  | { by: "text"; text: string; exact?: boolean }
  | { by: "testId"; id: string };

export type Value = { literal: string } | { env: string } | { unique: string };

export type Action =
  | { kind: "goto"; path: string }
  | { kind: "click"; target: Target }
  | { kind: "fill"; target: Target; value: Value }
  | { kind: "select"; target: Target; value: Value }
  | { kind: "check" | "uncheck"; target: Target }
  | { kind: "press"; target: Target; key: string };

export interface Step {
  intent: string;
  action: Action;
  waitFor?: Predicate[];
}

export interface RepairNote {
  at: string;
  error: string;
  change: string;
}

export interface Trajectory {
  schemaVersion: 1;
  id: string;
  scenarioId: string;
  title: string;
  source: { goalId: string; magpiRoot: string; magpiVersion: string; locatorRecovery: "ledger-target" | "payload-join" };
  startPath: string;
  steps: Step[];
  assertions: Predicate[];
  status: "draft" | "accepted" | "quarantined";
  repairs: RepairNote[];
}

export function validateTrajectory(value: unknown): string[] {
  const t = value as Trajectory;
  const errors: string[] = [];
  if (!t || typeof t !== "object") return ["trajectory: not an object"];
  if (!t.id || !t.scenarioId) errors.push("id and scenarioId are required");
  if (!t.startPath?.startsWith("/")) errors.push("startPath must start with /");
  if (!Array.isArray(t.steps)) errors.push("steps must be an array");
  for (const [i, step] of (t.steps ?? []).entries()) {
    const a = step.action as Action;
    if (!a || !["goto", "click", "fill", "select", "check", "uncheck", "press"].includes(a.kind)) {
      errors.push(`steps[${i}]: unknown action`);
      continue;
    }
    if (a.kind !== "goto") errors.push(...validateTarget((a as { target: Target }).target, `steps[${i}].target`));
    if ((a.kind === "fill" || a.kind === "select") && !isValue(a.value)) errors.push(`steps[${i}]: bad value`);
  }
  if (JSON.stringify(t).includes("data-core-ref")) errors.push("trajectory must not contain Magpi refs");
  if (!Array.isArray(t.assertions) || t.assertions.length === 0) errors.push("assertions must not be empty");
  return errors;
}

export function validateTarget(target: Target | undefined, where: string): string[] {
  if (!target) return [`${where}: missing`];
  switch (target.by) {
    case "role":
      return target.role && typeof target.name === "string" ? [] : [`${where}: role target needs role and name`];
    case "label":
    case "placeholder":
    case "text":
      return target.text ? [] : [`${where}: ${target.by} target needs text`];
    case "testId":
      return target.id ? [] : [`${where}: testId target needs id`];
    default:
      return [`${where}: unknown target kind`];
  }
}

function isValue(value: unknown): value is Value {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.literal === "string" || typeof v.env === "string" || typeof v.unique === "string";
}
