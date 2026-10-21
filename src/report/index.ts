import type { Budget } from "../budget.ts";
import type { AppMap } from "../discover/app-map.ts";
import type { Scenario } from "../scenario/types.ts";

export interface RunRecord {
  scenarioId: string;
  goalId?: string;
  status: string;
  turns: number;
  tokens: number;
  costUsd: number;
  coachedBy: "magpi" | "magpi-test-fallback" | "none";
  durationMs: number;
}

export function renderReport(input: { target: string; baseURL: string; map?: AppMap; scenarios: Scenario[]; runs: RunRecord[]; budget: Budget; stability?: string; note?: string }): string {
  const { scenarios, runs, budget, map } = input;
  const by = (status: Scenario["status"]) => scenarios.filter((s) => s.status === status);
  const accepted = by("accepted");
  const totalTokens = budget.tokens.model + budget.tokens.magpi;
  const actions = runs.reduce((sum, r) => sum + r.turns, 0);
  const lines = [
    `# Magpi Test report: ${input.target}`,
    "",
    `Run at ${new Date().toISOString()} against ${input.baseURL}.`,
    input.note ? `\n> ${input.note}\n` : "",
    "## Summary",
    "",
    "| | |",
    "| --- | --- |",
    `| Scenarios | ${scenarios.length} |`,
    `| Accepted specs | ${accepted.length} |`,
    `| Quarantined | ${by("quarantined").length} |`,
    `| Skipped (fixtures) | ${by("skipped").length} |`,
    `| Pending | ${scenarios.filter((s) => ["pending", "running", "trajectory"].includes(s.status)).length} |`,
    `| Tokens (Magpi Test / Magpi) | ${budget.tokens.model} / ${budget.tokens.magpi} |`,
    `| Spend (provider-reported) | $${budget.costUsd.toFixed(4)} |`,
    `| Tokens per accepted spec | ${accepted.length ? Math.round(totalTokens / accepted.length) : "-"} |`,
    `| Magpi turns per accepted spec | ${accepted.length ? (actions / accepted.length).toFixed(1) : "-"} |`,
    `| Passes coached by Magpi | ${runs.filter((r) => r.coachedBy === "magpi").length} of ${runs.length} |`,
    `| Wall clock | ${((Date.now() - budget.started) / 60_000).toFixed(1)} min |`,
    "",
  ];
  if (map) {
    lines.push("## App map", "", "| Area | Routes | Source files |", "| --- | --- | --- |");
    for (const area of map.areas) lines.push(`| ${area.id} | ${area.routes.join(", ")} | ${area.sourceFiles.length} |`);
    lines.push("", "### Critical paths", "", "| P | Path | Start | Lenses | Fixtures |", "| --- | --- | --- | --- | --- |");
    for (const p of map.criticalPaths) lines.push(`| ${p.priority} | ${p.title} | ${p.startPath} | ${p.lenses.join(", ")} | ${p.needsFixture.join(", ") || "-"} |`);
    lines.push("");
  }
  lines.push("## Accepted", "", ...(accepted.length ? accepted.map((s) => `- **${s.title}** (${s.source}, ${s.lens}) → \`${s.specFile}\``) : ["- none"]), "");
  lines.push("## Quarantined", "", ...(by("quarantined").length ? by("quarantined").map((s) => `- **${s.title}** — suspected ${s.quarantine?.suspected}: ${(s.quarantine?.error ?? "").split("\n")[0].slice(0, 200)}`) : ["- none"]), "");
  lines.push("## Skipped", "", ...(by("skipped").length ? by("skipped").map((s) => `- **${s.title}** — ${(s.needsFixture ?? []).join(", ") || (s.notes ?? []).join("; ")}`) : ["- none"]), "");
  const bugs = by("quarantined").filter((s) => s.quarantine?.suspected === "product-bug");
  lines.push("## Suspected product bugs", "", ...(bugs.length ? bugs.map((s) => `- ${s.title}: ${s.quarantine?.error.split("\n")[0]}`) : ["- none"]), "");
  if (input.stability) lines.push("## Stability", "", input.stability, "");
  return lines.join("\n");
}
