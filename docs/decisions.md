# Decisions

Append only. Each entry: status, the decision, why, and what evidence would reopen it.
Supersede an entry by adding a new one and marking the old one `superseded by QDn`.
Statuses: `accepted` (settled), `proposed` (working assumption for M1, may change after
a spike), `rejected`.

Magpi's own decisions (`D5`, `D17`, ...) live in
`browser-session-agent/docs/decisions.md`. We cite them; we do not copy them.

---

## QD1. Magpi Test is a separate package that uses Magpi as an engine — accepted

Magpi stays a general browser agent (brief section 3). This repo depends on
`@naiemk/magpi` and calls it. Upstream Magpi changes are allowed only when small,
generic, and tested in Magpi.

## QD2. Magpi Test talks to Magpi as a "parent" over the CLI and the goal directory — proposed

Magpi already defines how another agent delegates work to it: start a Pi session with
`magpie --json [--plan-file plan.md] "<objective>"`, continue with
`magpie --session <id> -p "..."`, read results from `~/.browser-agent-core/goals/<goalId>/`
(Magpi D55, D59, `docs/parent-agent.md`). Bounded, criteria-checked runs use
`browser-agent run`. Magpi's package only exports `"."`, and `runTask`,
`createLiveModel`, `Ledger`, and the coach are not exported, so deep imports would couple
us to internals.

Reopen if: MT-0.2 shows the CLI path cannot run coached sessions unattended, or process
startup cost dominates. Then prefer adding a small exported API to Magpi over deep imports.

## QD3. One pipeline, two front doors — accepted

Guided scenarios and exploration both produce `Scenario → Magpi run → Trajectory →
Playwright spec → acceptance`. Exploration differs only in who writes the scenario
(Magpi's coached passes instead of a human).

## QD4. Trajectory JSON is the boundary between AI and code — accepted

Models write and repair `Scenario` and `Trajectory` JSON. A deterministic emitter turns a
Trajectory into Playwright source. Models never edit generated `.spec.ts` files.
Why: cheap models are much more reliable at filling a typed structure than writing
correct test code, and template output is reviewable and diffable.

## QD5. Target vocabulary mirrors Magpi page-plan targets and Playwright locators — proposed

`Target` is one of `role+name`, `label`, `placeholder`, `text`, `testId`. These map 1:1
to Playwright `getByRole`, `getByLabel`, `getByPlaceholder`, `getByText`, `getByTestId`,
and the first four already exist as Magpi page-plan targets (`src/plan/types.ts`).
No CSS, no XPath, no Magpi `data-core-ref` in generated code.

## QD6. Acceptance means 3 green replays from a fresh stack — accepted (start mode only; attach mode: see QD15)

`CI=1 npx playwright test --config magpi-tests/playwright.config.ts <spec>
--repeat-each=3 --retries=0 --workers=1`. `CI=1` makes onchain-invoice's `webServer`
entries start fresh instead of reusing the exploration stack. Fewer than 3/3 means
quarantine, not acceptance.

## QD7. Output lives in the target repo under `magpi-tests/` — proposed

```text
<target>/magpi-tests/
  playwright.config.ts   generated; extends the target's own config
  specs/                 accepted specs only
  state/                 app map, scenarios, trajectories, run records, quarantine, report
```

Committing `state/` is how M2 will avoid rediscovery. Hand-written scenarios live in
`<target>/magpi-tests/scenarios/*.md`.

## QD8. The target supplies startup; Magpi Test does not build environments in M1 — superseded in part by QD11

The target manifest names start commands and readiness URLs. If the target already
declares Playwright `webServer` entries, the manifest may point to that config instead.

## QD9. The hidden answer key is enforced in code, not by convention — accepted

The manifest lists `answerKey` globs. A single file-access module refuses them, and a
test proves no answer-key text reaches a model prompt.

## QD10. License hygiene — proposed

This repo is GPL-3.0. Magpi is MIT (fine to depend on). TestZeus Hercules is AGPL-3.0:
study, never copy. Emitted test files go into other people's repos, so emitter templates
must stay trivial boilerplate. Revisit the repo license, or add an explicit exception
for generated output, before any external user.

## QD11. Attach mode is the primary way to get an environment — accepted (2026-10-16)

The target's own QA CI job brings the app up in a simulated environment and hands Magpi
Test an environment contract (`MAGPI_TEST_BASE_URL`, optional `MAGPI_TEST_READY_URL`,
`MAGPI_TEST_RESET_CMD`, `MAGPI_TEST_ENV_KIND`). Magpi Test checks readiness and never
starts or provisions anything. QD8's `webServer` / `processes` start stays as a
local-dev convenience (`start` in the manifest), no longer the default.
Why: real teams already own how their app comes up in CI; owning it ourselves is the
expensive, app-specific part we do not want.
Reopen if: most early users have no CI-provided environment at all.

## QD12. `policy: auto` is allowed on listed hosts, not only localhost — accepted (2026-10-16)

The manifest lists `allowedHosts`. `auto` is allowed when the base URL host is
localhost/127.0.0.1 or in `allowedHosts`, and `MAGPI_TEST_ENV_KIND` is `simulated`.
With `ENV_KIND=shared`, exploration runs with lenses that never submit destructive
actions, and `auto` is refused.
Why: a CI-provided environment is often a container hostname or preview URL.

## QD13. Trajectory JSON is the test script; `.spec.ts` is a build artifact — accepted (2026-10-16)

There is no new DSL in the MVP. The hard-coded, AI-free test is the Trajectory JSON
(QD4). The emitted Playwright spec is committed so plain `npx playwright test` works,
but it is never edited by hand or by a model: change the Trajectory and re-emit. The
human-editable form of a test is the manual test case (QD16).
Reopen if: users want to hand-edit tests and the manual format does not cover it.

## QD14. Codebase understanding comes from a QA brief — accepted (2026-10-16)

`<target>/magpi-tests/qa-brief.md` with fixed headings. `magpi-test init` builds it by
condensing the repo's existing agent and docs files (`AGENTS.md`, `CLAUDE.md`, `QA.md`,
`README*`, `.cursor/rules/**`, `docs/**`) through the answer-key guard. If they are too
thin, it prints a prompt for the user's own coding agent to write the brief, exits 3,
and does nothing else. Discovery treats the brief as hints the static scan or live
survey must confirm.
Why: the user's coding agent already understands their repo better and cheaper than we
can; the repo's own docs are the next best source.
Reopen if: briefs written by user agents leak answer-key content or are routinely wrong.

## QD15. Acceptance under attach: reset if offered, otherwise self-isolating data — accepted (2026-10-16)

Still 3/3 green with `--retries=0`. If `MAGPI_TEST_RESET_CMD` is set, it runs before
each replay. If not, all replays share the live environment and a spec is accepted
only if every value it creates is a `unique` value (run-unique suffix) and its
assertions do not depend on pre-existing counts or lists. Amends QD6 for attach mode.
Why: we cannot restart a stack we do not own, and requiring every CI to expose a reset
raises the bar to adopt.

## QD16. Manual test cases are rendered from Scenarios in the guided format — accepted (2026-10-16)

After a run, `magpi-tests/manual/<area>.md` holds one case per Scenario, rendered
deterministically (no model) in the same markdown format guided scenarios use, plus a
status line. A human-corrected case can be moved to `scenarios/` and becomes a guided
input unchanged.
Why: the manual cases are what a QA lead reviews, and the round trip makes review
produce tests instead of comments.

## QD17. Site-map nodes link to source files — accepted (2026-10-16)

Every app-map area and critical path carries `sourceFiles`, and every accepted spec
records the critical path it covers. `magpi-test impact --base <ref>` maps a git diff
to areas, specs to re-run, and areas to re-explore, deterministically. It reports only
in M1; acting on it is M4.
Why: "we know what to test when your code changes" is the pitch, and it needs this
data from the first run.

## QD18. M1 explore drafts one scenario per pass and runs it bounded — proposed (2026-10-17)

For each critical path × lens, one cheap model call writes a candidate Scenario (steps,
expected, criteria) from what the start page advertises. The criteria pass the
trivial-truth check, then the scenario goes through the same bounded-run pipeline as
guided input. Run records say `coachedBy: "none"`. The coached `magpie` parent path
(MT-2.3, MT-5.2) and pass harvest (MT-5.3) are not built yet.
Why: it keeps every test on fixed, external criteria (invariant 5) with one code path,
and it does not depend on the unverified unattended `magpie -p` loop (roadmap risk 1).
Reopen when: MT-0.2's parent-path check passes; then a coached pass replaces the
drafting call and its findings feed the same pipeline.

## QD19. The live survey is plain Playwright — accepted (2026-10-17)

MT-3.2 visits parameter-free routes with Playwright, reads headings, links, forms,
buttons and fields in the page, follows home-page links one level, and blocks non-GET
document requests. No Magpi run and no tokens. `surveyAffordances` stays internal to
Magpi; revisit only if the survey misses things Magpi's perception would catch.

## QD20. A bounded run that misses its criteria gets one retry with the failed checks — accepted (2026-10-20)

When Magpi ends a run with `status: failed`, magpi-test starts one more bounded run on
the same scenario with the same criteria, adding the failed checks and "carry out every
step" to the goal text (`--magpi-attempts`, default 2). Errors are not retried. The run
record sums turns, tokens and cost over attempts and says how many there were.
Why: the first live run lost a pass because Magpi's model stopped after one look at the
page. The criteria stay fixed (invariant 5); only the instructions to the explorer change.

## QD21. `run` reuses an existing app map — accepted (2026-10-20)

`magpi-test run` skips discovery when `state/app-map.json` exists and the saved live
survey reached at least one page. `--rediscover` (or `magpi-test discover`) rebuilds it.
Why: pass ids come from the map's critical path ids, which a fresh model call may rename,
so rediscovering on every run re-drafts and re-pays for passes already done. M2 replaces
this with proper knowledge reuse.

## QD22. Budgets are in provider-reported dollars — accepted (2026-10-21)

`--max-usd` stops a run (exit 4) when Magpi's reported `costUsd` plus OpenRouter's
`usage.cost` for magpi-test's own calls reaches the cap. `--max-tokens` stays, but token
counts are not comparable across models (reasoning tokens inflate them) and are not what
the user pays. Budgets are checked between calls, so one Magpi run can overshoot by its
own cost (about $0.02 at 16 turns on Gemini 2.5 Flash).

