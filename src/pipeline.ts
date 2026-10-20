import { readFileSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkIsolation } from "./accept/isolation.ts";
import { applyRepair, proposeRepair } from "./accept/repair.ts";
import { runAcceptance, type PlaywrightSpawner, type SpecRun } from "./accept/run.ts";
import type { Budget } from "./budget.ts";
import type { Manifest } from "./config/index.ts";
import type { QaBrief } from "./discover/brief.ts";
import type { LiveSurvey } from "./discover/live-survey.ts";
import { runBounded, type BoundedRunResult, type Spawner } from "./magpi/run.ts";
import { buildTrajectory, readLedger, TrajectoryBuildError } from "./magpi/trajectory.ts";
import type { ModelClient } from "./model/index.ts";
import type { RunRecord } from "./report/index.ts";
import { compileCriteria, trivialOnStartPage, type TrivialCheck } from "./scenario/criteria.ts";
import type { Scenario } from "./scenario/types.ts";
import { type AttachedEnv } from "./stack/index.ts";
import { appendLine, readJson, writeJson, writeText, type TargetPaths } from "./state/index.ts";
import { playwrightConfig } from "./synth/config.ts";
import { emitSpec } from "./synth/emit.ts";
import { checkNoAi } from "./synth/guard.ts";
import type { Trajectory } from "./synth/types.ts";

export interface PipelineContext {
  paths: TargetPaths;
  manifest: Manifest;
  env: AttachedEnv;
  model: ModelClient;
  budget: Budget;
  survey?: LiveSurvey;
  brief?: QaBrief;
  /** `attempts`: bounded runs per scenario when the criteria are not met (default 2). */
  magpi: { model?: string; maxTurns: number; attempts?: number; spawner?: Spawner; headed?: boolean };
  acceptSpawner?: PlaywrightSpawner;
  trivialCheck?: TrivialCheck;
  repairAttempts?: number;
  log: (line: string) => void;
}

export const ACCEPT_CONFIG = "playwright.accept.config.ts";

export function magpiVersion(): string {
  try {
    const file = fileURLToPath(new URL("../node_modules/@naiemk/magpi/package.json", import.meta.url));
    return (JSON.parse(readFileSync(file, "utf8")) as { version: string }).version;
  } catch {
    return "unknown";
  }
}

export async function writeConfigs(paths: TargetPaths, manifest: Manifest): Promise<void> {
  await writeText(path.join(paths.magpiTests, "playwright.config.ts"), playwrightConfig(manifest, { testDir: "./specs", outputDir: "./state/test-results" }));
  await writeText(path.join(paths.state, ACCEPT_CONFIG), playwrightConfig(manifest, { testDir: "./pending", outputDir: "./test-results" }));
}

export async function saveScenario(paths: TargetPaths, scenario: Scenario): Promise<void> {
  await writeJson(path.join(paths.state, "scenarios", `${scenario.id}.json`), scenario);
}

function goalText(scenario: Scenario, brief?: QaBrief, previous?: BoundedRunResult): string {
  const failed = previous?.checks.filter((c) => !c.passed).map((c) => `- ${c.predicate}: ${c.detail}`) ?? [];
  return [
    `Test scenario: ${scenario.title}`,
    scenario.preconditions.length ? `Preconditions: ${scenario.preconditions.join("; ")}` : "",
    `Steps:\n${scenario.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
    `Expected:\n${scenario.expected.map((s) => `- ${s}`).join("\n")}`,
    "This is a local test environment; use the fake data given in the steps. Stop as soon as the expected outcome is visible.",
    brief?.offLimits.length ? `Never: ${brief.offLimits.join("; ")}` : "",
    previous
      ? `A previous attempt stopped after ${previous.turns} turns before the expected outcome. These checks failed on its final page:\n${failed.join("\n")}\n` +
        "Carry out every step before finishing. If a control from the steps is not visible, look for the button, tab, or section that reveals it."
      : "",
  ].filter(Boolean).join("\n\n");
}

/**
 * QD3: guided and explored scenarios share this path.
 * Scenario → bounded Magpi run with fixed criteria → Trajectory → spec → acceptance.
 */
export async function runScenario(input: Scenario, ctx: PipelineContext): Promise<Scenario> {
  let scenario: Scenario = { ...input };
  const save = async () => saveScenario(ctx.paths, scenario);
  const quarantine = async (suspected: string, error: string) => {
    scenario = { ...scenario, status: "quarantined", quarantine: { suspected, error } };
    await save();
    ctx.log(`  quarantined ${scenario.id}: ${suspected} — ${error.split("\n")[0].slice(0, 160)}`);
    return scenario;
  };

  if (scenario.needsFixture?.length) {
    scenario = { ...scenario, status: "skipped", notes: [...(scenario.notes ?? []), `needs fixtures: ${scenario.needsFixture.join(", ")} (M3)`] };
    await save();
    return scenario;
  }

  const startURL = `${ctx.env.baseURL}${scenario.startPath}`;
  const trivial = ctx.trivialCheck ?? trivialOnStartPage;
  if (scenario.criteria.length === 0) {
    const page = ctx.survey?.pages.find((p) => p.route === scenario.startPath.split("?")[0]);
    const facts = page ? { url: page.finalURL, title: page.title, headings: page.headings, controls: [...page.buttons, ...page.fields] } : undefined;
    for (let attempt = 0; attempt < 2 && scenario.criteria.length === 0; attempt++) {
      const criteria = await compileCriteria({ ...scenario, page: facts }, ctx.model);
      if (await trivial(startURL, criteria)) {
        scenario.notes = [...(scenario.notes ?? []), `compiled criteria already true on the start page: ${JSON.stringify(criteria)}`];
        continue;
      }
      scenario = { ...scenario, criteria, criteriaStatus: "compiled" };
    }
    if (scenario.criteria.length === 0) {
      scenario = { ...scenario, status: "skipped" };
      await save();
      return scenario;
    }
  } else if (scenario.criteriaStatus === "compiled" && (await trivial(startURL, scenario.criteria))) {
    scenario = { ...scenario, status: "skipped", notes: [...(scenario.notes ?? []), "criteria already true on the start page (do-nothing run would pass)"] };
    await save();
    return scenario;
  }

  scenario = { ...scenario, status: "running" };
  await save();
  const attempts = ctx.magpi.attempts ?? 2;
  const totals = { turns: 0, tokens: 0, costUsd: 0, durationMs: 0 };
  let run: BoundedRunResult | undefined;
  let attempt = 0;
  // A failed run gets another try told which checks failed; the criteria never change.
  while (attempt < attempts && (!run || run.status === "failed")) {
    ctx.budget.check();
    attempt++;
    ctx.log(`  magpi run ${scenario.id} (${scenario.lens}) at ${scenario.startPath}${attempt > 1 ? ` (attempt ${attempt})` : ""}`);
    run = await runBounded(
      { goal: goalText(scenario, ctx.brief, run), url: startURL, criteria: scenario.criteria, policy: ctx.manifest.policy, maxTurns: ctx.magpi.maxTurns, model: ctx.magpi.model, root: ctx.paths.magpiHome, headed: ctx.magpi.headed },
      ctx.magpi.spawner,
    );
    ctx.budget.tokens.magpi += run.tokens;
    ctx.budget.costUsd += run.costUsd;
    ctx.budget.browserActions += run.turns;
    totals.turns += run.turns;
    totals.tokens += run.tokens;
    totals.costUsd += run.costUsd;
    totals.durationMs += run.durationMs;
    if (run.status === "success") break;
  }
  run = run!;
  const record: RunRecord & { checks: unknown; attempts: number; stderrTail?: string } = {
    scenarioId: scenario.id, goalId: run.goalId, status: run.status, ...totals, coachedBy: "none", checks: run.checks, attempts: attempt,
    ...(run.status === "error" ? { stderrTail: run.stderrTail } : {}),
  };
  await writeJson(path.join(ctx.paths.state, "runs", `${scenario.id}.json`), record);
  if (run.status !== "success" || !run.goalId) {
    const failedChecks = run.checks.filter((c) => !c.passed).map((c) => `${c.predicate}: ${c.detail}`).join("; ");
    const detail = run.status === "error" ? `magpi error: ${run.stderrTail.split("\n").filter(Boolean).slice(-3).join(" | ")}` : `criteria not met after ${attempt} run(s), ${totals.turns} turns: ${failedChecks}`;
    return quarantine(run.status === "error" ? "environment" : "exploration", detail);
  }

  let trajectory: Trajectory;
  try {
    const events = await readLedger(path.join(ctx.paths.magpiHome, "goals", run.goalId));
    trajectory = buildTrajectory(events, { scenario, goalId: run.goalId, magpiRoot: ctx.paths.magpiHome, magpiVersion: magpiVersion(), baseURL: ctx.env.baseURL });
  } catch (error) {
    if (error instanceof TrajectoryBuildError) return quarantine("locator", error.message);
    throw error;
  }
  return acceptTrajectory(scenario, trajectory, ctx);
}

/** Emit → guard → isolation → 3x replay, with up to N repairs of the trajectory JSON. */
export async function acceptTrajectory(scenario: Scenario, initial: Trajectory, ctx: PipelineContext): Promise<Scenario> {
  let trajectory = initial;
  const attempts = ctx.repairAttempts ?? 2;
  const trajectoryFile = path.join(ctx.paths.state, "trajectories", `${scenario.id}.json`);
  const pendingFile = path.join(ctx.paths.pending, `${scenario.id}.spec.ts`);
  const finish = async (status: Scenario["status"], extra: Partial<Scenario>) => {
    trajectory = { ...trajectory, status: status === "accepted" ? "accepted" : "quarantined" };
    await writeJson(trajectoryFile, trajectory);
    const next: Scenario = { ...scenario, status, ...extra };
    await saveScenario(ctx.paths, next);
    return next;
  };

  if (!ctx.env.reset) {
    const isolation = checkIsolation(trajectory);
    if (isolation.length) return finish("quarantined", { quarantine: { suspected: "criteria", error: `not self-isolating without a reset command: ${isolation.join("; ")}` } });
  }
  await writeConfigs(ctx.paths, ctx.manifest);
  await mkdir(ctx.paths.pending, { recursive: true });

  let lastFailure: SpecRun["error"];
  for (let attempt = 0; attempt <= attempts; attempt++) {
    await writeJson(trajectoryFile, trajectory);
    let source: string;
    try {
      source = emitSpec(trajectory);
    } catch (error) {
      return finish("quarantined", { quarantine: { suspected: "criteria", error: (error as Error).message } });
    }
    const guard = checkNoAi(source, ctx.manifest.fixtures.allowedImports);
    if (guard.length) return finish("quarantined", { quarantine: { suspected: "other", error: `no-AI guard: ${guard.join("; ")}` } });
    await writeText(pendingFile, source);

    ctx.log(`  accept ${scenario.id} (attempt ${attempt + 1})`);
    const result = await runAcceptance({
      targetRoot: ctx.paths.root,
      config: path.join(ctx.paths.state, ACCEPT_CONFIG),
      files: [path.basename(pendingFile)],
      env: ctx.env.replayEnv,
      reset: ctx.env.reset,
      spawner: ctx.acceptSpawner,
    });
    const specRun = result.runs.find((r) => r.file === path.basename(pendingFile));
    if (specRun && specRun.passed === 3 && specRun.failed === 0) {
      const specFile = path.join(ctx.paths.specs, `${scenario.id}.spec.ts`);
      await writeText(specFile, source);
      await rm(pendingFile, { force: true });
      ctx.log(`  accepted ${scenario.id} → ${path.relative(ctx.paths.root, specFile)}`);
      return finish("accepted", { specFile: path.relative(ctx.paths.magpiTests, specFile), quarantine: undefined });
    }
    lastFailure = specRun?.error ?? { message: `passed ${specRun?.passed ?? 0}/3; ${result.stderrTail.slice(-500)}`, class: "other" };
    if (specRun && specRun.passed > 0) lastFailure = { ...lastFailure, message: `flaky: passed ${specRun.passed}/3\n${lastFailure.message}` };
    await appendLine(path.join(ctx.paths.state, "acceptance.jsonl"), { at: new Date().toISOString(), scenarioId: scenario.id, attempt, passed: specRun?.passed ?? 0, error: lastFailure.message.split("\n")[0], class: lastFailure.class });
    if (lastFailure.class === "environment") break;
    if (attempt === attempts) break;
    ctx.budget.check();
    const proposal = await proposeRepair(trajectory, lastFailure, ctx.model);
    if (proposal.suspected === "criteria" || proposal.suspected === "product-bug" || proposal.changes.length === 0) {
      await rm(pendingFile, { force: true });
      return finish("quarantined", { quarantine: { suspected: proposal.suspected ?? lastFailure.class, error: lastFailure.message } });
    }
    trajectory = applyRepair(trajectory, proposal, lastFailure.message);
  }
  await rm(pendingFile, { force: true });
  const suspected = lastFailure?.class === "assertion" ? "criteria" : lastFailure?.class ?? "other";
  return finish("quarantined", { quarantine: { suspected, error: lastFailure?.message ?? "unknown" } });
}

export async function loadScenarioState(paths: TargetPaths, id: string): Promise<Scenario | undefined> {
  return readJson<Scenario>(path.join(paths.state, "scenarios", `${id}.json`));
}
