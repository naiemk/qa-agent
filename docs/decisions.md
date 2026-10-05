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

## QD6. Acceptance means 3 green replays from a fresh stack — accepted

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

## QD8. The target supplies startup; Magpi Test does not build environments in M1 — accepted

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
