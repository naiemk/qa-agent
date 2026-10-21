import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAcceptance, type PlaywrightSpawner } from "../accept/run.ts";
import { BudgetExceeded, createBudget, meteredModel, type Budget } from "../budget.ts";
import { loadManifest, ManifestError, type Manifest } from "../config/index.ts";
import { buildAppMap, type AppMap } from "../discover/app-map.ts";
import { agentPrompt, briefFromDocs, BriefFormatError, collectDocs, GENERATED_HEADER, parseBrief, renderBrief, type QaBrief } from "../discover/brief.ts";
import { changedFiles, computeImpact } from "../discover/impact.ts";
import { liveSurvey, type LiveSurvey } from "../discover/live-survey.ts";
import { staticScan, type StaticScan } from "../discover/static-scan.ts";
import { draftScenario, planPasses } from "../explore/planner.ts";
import { AnswerKeyError, fileAccess } from "../files/index.ts";
import type { Spawner } from "../magpi/run.ts";
import type { ModelClient } from "../model/index.ts";
import { MissingKeyError, openRouterClient, ProviderCreditError } from "../model/openrouter.ts";
import { writeManual } from "../manual/index.ts";
import { acceptTrajectory, runScenario, saveScenario, writeConfigs, type PipelineContext } from "../pipeline.ts";
import { renderReport, type RunRecord } from "../report/index.ts";
import type { TrivialCheck } from "../scenario/criteria.ts";
import { parseScenarioMarkdown } from "../scenario/markdown.ts";
import { LENSES, type Lens, type Scenario } from "../scenario/types.ts";
import { attachEnv, EnvNotReadyError, EnvResetError, readyTimeout, waitReady, type AttachedEnv } from "../stack/index.ts";
import { readJson, readRecords, targetPaths, writeJson, writeText, type TargetPaths } from "../state/index.ts";
import type { Trajectory } from "../synth/types.ts";

export const EXIT = { ok: 0, internal: 1, usage: 2, envNotReady: 2, briefMissing: 3, budget: 4 } as const;

export const HELP = `magpi-test — an autonomous QA engineer on top of Magpi

Usage: magpi-test <command> --target <dir> [options]

Commands:
  init       Write or validate magpi-tests/qa-brief.md; prints an agent prompt and exits 3 if docs are too thin
  discover   QA brief + static scan + live survey → state/app-map.json
  guided     magpi-tests/scenarios/*.md → accepted specs
  explore    Critical paths × lenses → candidate scenarios → accepted specs
  accept     Re-run acceptance for pending trajectories (--all replays accepted specs)
  run        init + discover (once) + guided + explore + manual + report (what the QA CI job runs)
  impact     Changed files since --base <ref> → areas, specs to re-run, areas to re-explore

Options:
  --target <dir>        Target project root (default: cwd)
  --max-passes <n>      Explore passes (default 12)
  --paths a,b           Only these critical path ids
  --lenses x,y          Only these lenses (${LENSES.join(", ")})
  --max-turns <n>       Magpi turns per bounded run (default 24)
  --magpi-attempts <n>  Bounded runs per scenario when criteria are not met (default 2)
  --rediscover          run: rebuild state/app-map.json even if it exists
  --max-tokens <n>      Stop cleanly when this many tokens are spent (exit 4)
  --max-minutes <n>     Stop cleanly after this many minutes (exit 4)
  --model <id>          Magpi Test's own model (default MAGPI_TEST_MODEL or google/gemini-2.5-flash)
  --magpi-model <id>    Model for Magpi browsing (default: manifest model.magpi or Magpi's choice)
  --force               Redo scenarios already accepted or quarantined
  --headed              Show the browser during Magpi runs
  --base <ref>          impact: git ref to diff against

Exit codes: 0 ran, 1 internal error, 2 usage error or environment not ready, 3 QA brief missing, 4 budget spent.
Environment: MAGPI_TEST_BASE_URL, MAGPI_TEST_READY_URL, MAGPI_TEST_RESET_CMD, MAGPI_TEST_ENV_KIND, OPENROUTER_API_KEY.
`;

export interface Deps {
  model?: ModelClient;
  magpiSpawner?: Spawner;
  acceptSpawner?: PlaywrightSpawner;
  trivialCheck?: TrivialCheck;
  survey?: (baseURL: string, routes: string[], locale: string) => Promise<LiveSurvey>;
  skipReady?: boolean;
  out?: (line: string) => void;
}

interface Args {
  command: string;
  flags: Record<string, string | boolean>;
  positional: string[];
}

export function parseArgs(argv: string[]): Args {
  const [command = "help", ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg.startsWith("--")) {
      const [key, inline] = arg.slice(2).split("=", 2);
      if (inline !== undefined) flags[key] = inline;
      else if (rest[i + 1] && !rest[i + 1].startsWith("--")) flags[key] = rest[++i];
      else flags[key] = true;
    } else positional.push(arg);
  }
  return { command, flags, positional };
}

const COMMANDS = ["init", "discover", "guided", "explore", "accept", "run", "impact"];

/** Loads magpi-test's own `.env` (gitignored) so a developer can keep the key there. */
export function loadOwnEnv(): void {
  const file = fileURLToPath(new URL("../../.env", import.meta.url));
  if (existsSync(file)) process.loadEnvFile(file);
}

export async function main(argv: string[], deps: Deps = {}): Promise<number> {
  const args = parseArgs(argv);
  const out = deps.out ?? ((line: string) => process.stdout.write(`${line}\n`));
  if (args.command === "help" || args.command === "--help" || args.flags.help) {
    out(HELP);
    return EXIT.ok;
  }
  if (!COMMANDS.includes(args.command)) {
    process.stderr.write(`unknown command: ${args.command}\n\n${HELP}`);
    return EXIT.usage;
  }
  try {
    return await dispatch(args, deps, out);
  } catch (error) {
    if (error instanceof ManifestError || error instanceof MissingKeyError) {
      process.stderr.write(`${error.message}\n`);
      return EXIT.usage;
    }
    if (error instanceof EnvNotReadyError || error instanceof EnvResetError) {
      process.stderr.write(`environment not ready: ${error.message}\n`);
      return EXIT.envNotReady;
    }
    if (error instanceof ProviderCreditError) {
      process.stderr.write(`${error.message}\nAdd credits at https://openrouter.ai/settings/credits; partial results are in magpi-tests/\n`);
      return EXIT.budget;
    }
    if (error instanceof BudgetExceeded) {
      process.stderr.write(`${error.message}; partial results are in magpi-tests/\n`);
      return EXIT.budget;
    }
    if (error instanceof AnswerKeyError) {
      process.stderr.write(`${error.message}\n`);
      return EXIT.internal;
    }
    process.stderr.write(`${(error as Error).stack ?? error}\n`);
    return EXIT.internal;
  }
}

interface Session {
  paths: TargetPaths;
  manifest: Manifest;
  budget: Budget;
  out: (line: string) => void;
  flags: Args["flags"];
  deps: Deps;
  model?: ModelClient;
  env?: AttachedEnv;
  stabilityNote?: string;
}

async function dispatch(args: Args, deps: Deps, out: (line: string) => void): Promise<number> {
  const target = path.resolve(String(args.flags.target ?? process.cwd()));
  const paths = targetPaths(target);
  if (args.command === "impact") return impact(paths, args.flags, out);
  const manifest = await loadManifest(target);
  const budget = createBudget({
    maxTokens: args.flags["max-tokens"] ? Number(args.flags["max-tokens"]) : undefined,
    maxMinutes: args.flags["max-minutes"] ? Number(args.flags["max-minutes"]) : undefined,
  });
  const session: Session = { paths, manifest, budget, out, flags: args.flags, deps };
  try {
    switch (args.command) {
      case "init":
        return (await init(session)).code;
      case "discover": {
        const brief = await init(session);
        if (brief.code !== EXIT.ok) return brief.code;
        await discover(session, brief.brief);
        return EXIT.ok;
      }
      case "guided":
        await guided(session, args.positional);
        return EXIT.ok;
      case "explore":
        await explore(session);
        return EXIT.ok;
      case "accept":
        await accept(session);
        return EXIT.ok;
      case "run":
        return await run(session);
    }
  } finally {
    if (args.command !== "init") await finishOutputs(session).catch((error) => process.stderr.write(`could not write outputs: ${(error as Error).message}\n`));
  }
  return EXIT.usage;
}

function model(session: Session): ModelClient {
  if (!session.model) {
    const base = session.deps.model ?? openRouterClient({ model: (session.flags.model as string | undefined) ?? session.manifest.model?.magpiTest, promptLog: path.join(session.paths.state, "prompts.jsonl") });
    session.model = meteredModel(base, session.budget);
  }
  return session.model;
}

async function environment(session: Session): Promise<AttachedEnv> {
  if (!session.env) {
    if (!("attach" in session.manifest.start)) {
      session.out("note: only attach mode is implemented; start the app yourself and set MAGPI_TEST_BASE_URL (QD11)");
    }
    const env = attachEnv(session.manifest, { targetRoot: session.paths.root, logsDir: session.paths.logs });
    if (!session.deps.skipReady) {
      session.out(`waiting for ${env.readyURL}`);
      await waitReady(env.readyURL, readyTimeout());
      if (env.readyURL !== env.baseURL) await waitReady(env.baseURL, readyTimeout());
    }
    session.out(`attached to ${env.baseURL}${env.reset ? " (reset command available)" : ""}`);
    session.env = env;
  }
  return session.env;
}

async function init(session: Session): Promise<{ code: number; brief?: QaBrief }> {
  const files = fileAccess(session.paths.root, session.manifest.read.answerKey);
  const briefFile = path.resolve(session.paths.root, session.manifest.brief);
  if (existsSync(briefFile)) {
    try {
      const brief = parseBrief(await readFile(briefFile, "utf8"));
      session.out(`QA brief: ${path.relative(session.paths.root, briefFile)} (${brief.areas.length} areas, ${brief.flows.length} flows)`);
      return { code: EXIT.ok, brief };
    } catch (error) {
      if (error instanceof BriefFormatError) {
        process.stderr.write(`invalid QA brief ${briefFile}: ${error.message}\n`);
        return { code: EXIT.briefMissing };
      }
      throw error;
    }
  }
  const docs = await collectDocs(files);
  if (docs.thin) {
    session.out(`No QA brief and the repo's docs are too thin to build one.\nAsk your coding agent (Claude Code, Cursor, ...) to run this prompt, review the result, and commit it:\n`);
    session.out(agentPrompt(path.relative(session.paths.root, briefFile), session.manifest.read.answerKey));
    return { code: EXIT.briefMissing };
  }
  session.out(`building QA brief from ${docs.files.map((d) => d.file).join(", ")}`);
  const brief = await briefFromDocs(docs, model(session));
  await writeText(briefFile, renderBrief(brief, GENERATED_HEADER));
  session.out(`wrote ${path.relative(session.paths.root, briefFile)}; review and commit it`);
  return { code: EXIT.ok, brief };
}

async function discover(session: Session, brief?: QaBrief): Promise<AppMap> {
  const files = fileAccess(session.paths.root, session.manifest.read.answerKey);
  const helperGlobs = session.manifest.read.include.filter((glob) => /helper/i.test(glob));
  const scan: StaticScan = await staticScan(files, session.manifest.read.include, helperGlobs);
  await writeJson(path.join(session.paths.state, "static-scan.json"), scan);
  session.out(`static scan: ${scan.routes.length} routes, ${scan.docs.length} docs, ${scan.helpers.length} helper files`);
  const env = await environment(session);
  const routes = scan.routes.map((r) => r.path);
  const survey = await (session.deps.survey ?? ((base, r, locale) => liveSurvey(base, r, { locale })))(env.baseURL, routes, session.manifest.locale);
  await writeJson(path.join(session.paths.state, "live-survey.json"), survey);
  session.out(`live survey: ${survey.pages.filter((p) => !p.error).length} pages reached, ${survey.pages.filter((p) => p.error).length} failed`);
  const map = await buildAppMap(scan, survey, model(session), brief);
  await writeJson(path.join(session.paths.state, "app-map.json"), map);
  session.out(`app map: ${map.areas.length} areas, ${map.criticalPaths.length} critical paths`);
  for (const p of map.criticalPaths) session.out(`  P${p.priority} ${p.id} ${p.startPath} [${p.lenses.join(", ")}]${p.needsFixture.length ? ` needs ${p.needsFixture.join(", ")}` : ""}`);
  return map;
}

async function pipelineContext(session: Session): Promise<PipelineContext> {
  const env = await environment(session);
  const survey = await readJson<LiveSurvey>(path.join(session.paths.state, "live-survey.json"));
  const briefFile = path.resolve(session.paths.root, session.manifest.brief);
  const brief = existsSync(briefFile) ? parseBrief(await readFile(briefFile, "utf8")) : undefined;
  await writeConfigs(session.paths, session.manifest);
  return {
    paths: session.paths,
    manifest: session.manifest,
    env,
    model: model(session),
    budget: session.budget,
    survey,
    brief,
    magpi: {
      model: (session.flags["magpi-model"] as string | undefined) ?? session.manifest.model?.magpi,
      maxTurns: Number(session.flags["max-turns"] ?? 24),
      attempts: Number(session.flags["magpi-attempts"] ?? 2),
      spawner: session.deps.magpiSpawner,
      headed: Boolean(session.flags.headed),
    },
    acceptSpawner: session.deps.acceptSpawner,
    trivialCheck: session.deps.trivialCheck,
    log: session.out,
  };
}

const done = (s?: Scenario) => s && ["accepted", "quarantined", "skipped"].includes(s.status);

async function guided(session: Session, only: string[]): Promise<void> {
  let names: string[] = [];
  try {
    names = (await readdir(session.paths.scenariosMd)).filter((n) => n.endsWith(".md")).sort();
  } catch {
    session.out("guided: no magpi-tests/scenarios/ folder");
    return;
  }
  if (only.length) names = names.filter((n) => only.some((o) => path.basename(o) === n));
  if (names.length === 0) return;
  const ctx = await pipelineContext(session);
  for (const name of names) {
    const parsed = parseScenarioMarkdown(await readFile(path.join(session.paths.scenariosMd, name), "utf8"), name.replace(/\.md$/, ""));
    const prior = await readJson<Scenario>(path.join(session.paths.state, "scenarios", `${parsed.id}.json`));
    if (done(prior) && !session.flags.force) {
      session.out(`guided ${parsed.id}: ${prior!.status} (kept)`);
      continue;
    }
    const result = await runScenario(parsed, ctx);
    session.out(`guided ${result.id}: ${result.status}${result.specFile ? ` → ${result.specFile}` : ""}`);
  }
}

async function explore(session: Session): Promise<void> {
  const map = await readJson<AppMap>(path.join(session.paths.state, "app-map.json"));
  if (!map) throw new ManifestError("no state/app-map.json; run magpi-test discover first");
  const ctx = await pipelineContext(session);
  const { passes, skipped } = planPasses(map, {
    maxPasses: Number(session.flags["max-passes"] ?? 12),
    paths: typeof session.flags.paths === "string" ? session.flags.paths.split(",") : undefined,
    lenses: typeof session.flags.lenses === "string" ? (session.flags.lenses.split(",") as Lens[]) : undefined,
  });
  for (const path_ of skipped) {
    const id = `${path_.id}-needs-fixture`.replace(/[^a-z0-9-]+/g, "-");
    const scenario: Scenario = {
      schemaVersion: 1, id, title: path_.title, source: "discover", area: path_.area, path: path_.id, lens: path_.lenses[0] ?? "happy",
      startPath: path_.startPath, preconditions: [], steps: [], expected: [path_.why], criteria: [], criteriaStatus: "none",
      needsFixture: path_.needsFixture, priority: path_.priority, status: "skipped", notes: [`needs fixtures: ${path_.needsFixture.join(", ")} (M3)`],
    };
    await saveScenario(session.paths, scenario);
  }
  session.out(`explore: ${passes.length} passes, ${skipped.length} critical paths skipped for fixtures`);
  const existing = await readRecords<Scenario>(path.join(session.paths.state, "scenarios"));
  for (const pass of passes) {
    const passFile = path.join(session.paths.state, "passes", `${pass.id}.json`);
    const record = await readJson<{ scenarioId: string }>(passFile);
    const prior = record ? existing.find((s) => s.id === record.scenarioId) : undefined;
    if (done(prior) && !session.flags.force) {
      session.out(`pass ${pass.id}: ${prior!.status} (kept)`);
      continue;
    }
    session.budget.check();
    const avoid = existing.filter((s) => s.path === pass.path.id).map((s) => s.title);
    let scenario: Scenario;
    try {
      scenario = await draftScenario(pass, ctx.survey ?? { schemaVersion: 1, baseURL: ctx.env.baseURL, implementation: "playwright", pages: [] }, ctx.model, avoid);
    } catch (error) {
      if (error instanceof ProviderCreditError) throw error;
      session.out(`pass ${pass.id}: could not draft a scenario (${(error as Error).message.split("\n")[0]})`);
      continue;
    }
    await writeJson(passFile, { passId: pass.id, path: pass.path.id, lens: pass.lens, scenarioId: scenario.id, coachedBy: "none" });
    session.out(`pass ${pass.id}: "${scenario.title}"`);
    const result = await runScenario(scenario, ctx);
    existing.push(result);
    session.out(`pass ${pass.id}: ${result.status}${result.specFile ? ` → ${result.specFile}` : ""}`);
  }
}

async function accept(session: Session): Promise<void> {
  const ctx = await pipelineContext(session);
  const scenarios = await readRecords<Scenario>(path.join(session.paths.state, "scenarios"));
  for (const scenario of scenarios) {
    if (scenario.status === "accepted" && !session.flags.force) continue;
    const trajectory = await readJson<Trajectory>(path.join(session.paths.state, "trajectories", `${scenario.id}.json`));
    if (!trajectory) continue;
    const result = await acceptTrajectory(scenario, { ...trajectory, status: "draft" }, ctx);
    session.out(`accept ${result.id}: ${result.status}`);
  }
  if (session.flags.all) session.out(await stability(session, ctx.env));
}

async function stability(session: Session, env: AttachedEnv): Promise<string> {
  const specs = existsSync(session.paths.specs) ? (await readdir(session.paths.specs)).filter((n) => n.endsWith(".spec.ts")) : [];
  if (specs.length === 0) return "No accepted specs to replay.";
  const result = await runAcceptance({ targetRoot: session.paths.root, config: path.join(session.paths.magpiTests, "playwright.config.ts"), files: [], env: env.replayEnv, repeat: 1, reset: env.reset, spawner: session.deps.acceptSpawner });
  const passed = result.runs.filter((r) => r.failed === 0 && r.passed > 0).length;
  return `Final replay of all accepted specs (no AI, provider keys stripped): ${passed}/${result.runs.length} passed.`;
}

async function run(session: Session): Promise<number> {
  const brief = await init(session);
  if (brief.code !== EXIT.ok) return brief.code;
  // Pass ids come from the map's path ids, which a fresh model call may rename; reusing
  // the map keeps earlier passes recognised instead of paying for near-duplicates.
  const mapFile = path.join(session.paths.state, "app-map.json");
  const survey = await readJson<LiveSurvey>(path.join(session.paths.state, "live-survey.json"));
  const surveyed = survey?.pages.some((p) => !p.error) ?? false;
  if (!session.flags.rediscover && existsSync(mapFile) && surveyed) {
    session.out(`app map: reusing ${path.relative(session.paths.root, mapFile)} (--rediscover to rebuild)`);
  } else {
    await discover(session, brief.brief);
  }
  await guided(session, []);
  await explore(session);
  const env = await environment(session);
  session.stabilityNote = await stability(session, env);
  return EXIT.ok;
}

async function finishOutputs(session: Session): Promise<void> {
  const scenarios = await readRecords<Scenario>(path.join(session.paths.state, "scenarios"));
  if (scenarios.length === 0 && !existsSync(path.join(session.paths.state, "app-map.json"))) return;
  const written = await writeManual(session.paths.manual, scenarios);
  const runs = await readRecords<RunRecord>(path.join(session.paths.state, "runs"));
  const map = await readJson<AppMap>(path.join(session.paths.state, "app-map.json"));
  const report = renderReport({ target: session.manifest.name, baseURL: session.env?.baseURL ?? session.manifest.baseURL, map, scenarios, runs, budget: session.budget, stability: session.stabilityNote });
  await writeText(path.join(session.paths.state, "report.md"), report);
  session.out(`wrote ${written.length} manual test files and magpi-tests/state/report.md`);
}

async function impact(paths: TargetPaths, flags: Args["flags"], out: (line: string) => void): Promise<number> {
  const base = flags.base;
  if (typeof base !== "string") {
    process.stderr.write("impact needs --base <ref>\n");
    return EXIT.usage;
  }
  const map = await readJson<AppMap>(path.join(paths.state, "app-map.json"));
  if (!map) {
    process.stderr.write("no state/app-map.json; run magpi-test discover first\n");
    return EXIT.usage;
  }
  const manifest = await loadManifest(paths.root).catch(() => undefined);
  const changed = await changedFiles(paths.root, base);
  const guard = fileAccess(paths.root, manifest?.read.answerKey ?? []);
  const scenarios = await readRecords<Scenario>(path.join(paths.state, "scenarios"));
  const result = computeImpact(base, changed, map, scenarios);
  await writeJson(path.join(paths.state, "impact.json"), result);
  out(`changed files: ${changed.length}${changed.some((f) => guard.isAnswerKey(f)) ? " (includes answer-key files, listed by path only)" : ""}`);
  out(`impacted areas: ${result.areas.join(", ") || "none"}`);
  out(`impacted critical paths: ${result.paths.join(", ") || "none"}`);
  out(`re-run specs: ${result.rerunSpecs.join(", ") || "none"}`);
  out(`re-explore areas (no accepted spec yet): ${result.reexploreAreas.join(", ") || "none"}`);
  out(`unmapped files: ${result.unmapped.length}`);
  return EXIT.ok;
}
