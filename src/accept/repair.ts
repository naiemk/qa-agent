import type { ModelClient } from "../model/index.ts";
import { validateTarget, type Step, type Target, type Trajectory, type Value } from "../synth/types.ts";
import type { SpecRun } from "./run.ts";

interface RepairChange {
  step: number;
  target?: Target;
  value?: Value;
  waitFor?: Step["waitFor"];
  remove?: boolean;
  why: string;
}

export interface RepairProposal {
  changes: RepairChange[];
  suspected?: "locator" | "criteria" | "product-bug";
}

/**
 * MT-6.4: the model may change a step's target, value, or waitFor, or drop a step. It can
 * never touch `assertions` (that would be grading itself, invariant 5).
 */
export async function proposeRepair(trajectory: Trajectory, failure: NonNullable<SpecRun["error"]>, model: ModelClient): Promise<RepairProposal> {
  const { value } = await model.completeJson<RepairProposal>({
    purpose: "repair",
    system:
      "A generated Playwright test failed. Fix the trajectory's steps so the test passes against the real page. " +
      "You may change steps[i].target (by: role|label|placeholder|text|testId), steps[i].value, steps[i].waitFor, or remove a step. " +
      "You must NOT change assertions. Use the ARIA snapshot to pick locators that exist. Prefer role+name, then label, then placeholder, then text. " +
      'If the assertion itself is wrong set suspected "criteria"; if the app looks broken set "product-bug"; then changes may be empty.',
    user: [
      `Trajectory:\n${JSON.stringify({ startPath: trajectory.startPath, steps: trajectory.steps.map((s, i) => ({ i, ...s })), assertions: trajectory.assertions }, null, 1)}`,
      `Error:\n${failure.message}`,
      failure.ariaSnapshot ? `ARIA snapshot at failure:\n${failure.ariaSnapshot}` : "No ARIA snapshot.",
    ].join("\n\n"),
    schemaHint: '{"changes":[{"step":2,"target":{"by":"role","role":"button","name":"Create invoice","exact":true},"why":"button name differs"}],"suspected":"locator"}',
    validate: (v) => {
      const p = v as RepairProposal;
      if (!p || !Array.isArray(p.changes)) return ["need changes[]"];
      if (JSON.stringify(p).includes('"assertions"')) return ["assertions cannot be changed"];
      const errors: string[] = [];
      for (const [i, c] of p.changes.entries()) {
        if (!Number.isInteger(c.step) || c.step < 0 || c.step >= trajectory.steps.length) errors.push(`changes[${i}].step out of range`);
        if (c.target) errors.push(...validateTarget(c.target, `changes[${i}].target`));
      }
      return errors;
    },
  });
  return value;
}

export function applyRepair(trajectory: Trajectory, proposal: RepairProposal, error: string): Trajectory {
  const next = structuredClone(trajectory);
  const removals = new Set<number>();
  for (const change of proposal.changes) {
    const step = next.steps[change.step];
    if (change.remove) {
      removals.add(change.step);
      continue;
    }
    if (change.target && "target" in step.action) step.action.target = change.target;
    if (change.value && "value" in step.action) step.action.value = change.value;
    if (change.waitFor) step.waitFor = change.waitFor;
  }
  next.steps = next.steps.filter((_, i) => !removals.has(i));
  next.repairs.push({ at: new Date().toISOString(), error: error.split("\n")[0].slice(0, 300), change: proposal.changes.map((c) => `step ${c.step}: ${c.why}`).join("; ") || "none" });
  return next;
}
