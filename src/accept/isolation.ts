import type { Predicate } from "../scenario/types.ts";
import type { Trajectory } from "../synth/types.ts";

const STATEFUL_TEXT = /\b(no \w+ (yet|found)|nothing here|empty|0 (items|results|invoices|orders)|first row|showing \d+)\b/i;

/**
 * QD15 without a reset command: every replay shares the live environment, so a spec must
 * create unique data and must not assert on state earlier runs could have changed.
 */
export function checkIsolation(trajectory: Trajectory): string[] {
  const errors: string[] = [];
  const check = (p: Predicate, where: string) => {
    if ("text" in p && STATEFUL_TEXT.test(p.text)) errors.push(`${where}: "${p.text}" depends on shared state`);
    if (p.kind === "all") p.of.forEach((child, i) => check(child, `${where}.of[${i}]`));
  };
  trajectory.assertions.forEach((p, i) => check(p, `assertions[${i}]`));
  return errors;
}
