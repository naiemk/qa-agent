# Discovery and exploration

Status: **proposed (M1)**. Decisions: QD2, QD3. Depends on MT-0.2 for the coached path.

## Goals

1. Drop on a codebase and find the UI surface and the critical paths without being told.
2. Explore each critical path from several depths and points of view, using Magpi's
   planner and coach, so coverage is not one agent's single wander.
3. Spend tokens on local problems; keep the big picture in files.

## Discovery (MT-3.1 → MT-3.3)

Three cheap steps, in order. The output is `state/app-map.json`.

### 1. Static scan (no browser, no model)

Through `src/files/` only (answer key enforced):

- Routes: find router declarations in `read.include` source. M1 handles
  React Router (`<Route path=...>`, `createBrowserRouter([...])`, `path:` objects) by
  regex over source text, not a full parser. Record path, file, line, component name.
- Docs: titles and headings of `README*`, `AGENTS.md`, `docs/**/*.md`.
- Existing helpers: list exported function names from files the manifest allows
  under test-helper folders (for onchain-invoice: `ui/e2e/helpers/*.ts`). These hint
  at what needs fixtures; they are not scenarios.
- `data-testid` values and `aria-label`s per component file, as locator hints.

Output: `state/static-scan.json`. Deterministic; unit-tested against a fixture repo.

### 2. Live surface survey (browser, no model or cheap)

Start the stack. For each static route without path params (and the base URL):

- load it, wait for network idle with a cap (10 s), record title, final URL, HTTP
  status, console errors;
- record what the page advertises: navigation links, tabs, forms, primary buttons.
  Magpi's `surveyAffordances` does exactly this; MT-3.2 decides between a Magpi run
  that reports the survey and a small exported Magpi API, and records the decision.
  A plain Playwright pass (`page.getByRole("link")`, `ariaSnapshot()`) is acceptable as
  a stopgap and costs no tokens;
- follow in-app links one level from the base URL to catch routes the scan missed.

Never submit forms here. Output: `state/live-survey.json`.

### 3. App map and critical paths (one or two cheap model calls)

Input: the static scan summary and live survey summary (trimmed: route, title,
headings, forms, primary buttons; no source code), plus the top docs headings.

Output `state/app-map.json`:

```ts
interface AppMap {
  schemaVersion: 1;
  generatedAt: string;
  areas: { id: string; title: string; routes: string[]; summary: string }[];
  criticalPaths: {
    id: string;                 // "commerce.create-invoice"
    area: string;
    title: string;
    startPath: string;
    why: string;                // one sentence: why this matters to users
    priority: 1 | 2 | 3;
    needsFixture: string[];     // inferred from helpers/routes: "webauthn", "email-otp", ...
    lenses: Lens[];             // which lenses make sense here
  }[];
  unexplored: string[];         // routes seen but not understood
}
```

The model ranks and groups; it does not invent routes. Validation rejects any
`startPath` not present in the scan or survey.

## Exploration (MT-5.1 → MT-5.3)

### Pass planner (MT-5.1)

`criticalPaths` (priority order, `needsFixture` empty in M1) × their `lenses` →
a list of passes, capped by `--max-passes` (default 12). Each pass has a plan file:

```markdown
# Objective
Explore "<critical path title>" on <baseURL><startPath> as a QA engineer.
Lens: <lens>. <lens instruction>

# Constraints
- Local test environment; irreversible actions are allowed here.
- Stay within: <routes of this area>.
- Do not use real personal data. Use obviously fake values.
- Record each distinct flow you complete: what you did, and what on the page proved it worked.
- Record flows you notice but do not finish, with why.

# Stop
- After <N> distinct completed flows, or <M> turns.
```

No click/type instructions in the plan file (Magpi PARENT-05).

### Coached pass runner (MT-5.2)

Preferred path, if MT-0.2 confirms it works unattended:

1. `magpie --json --name <passId> --plan-file <plan.md> "<objective>"` → session id,
   goal id. Record in `state/runs/<passId>.json`.
2. `magpie --session <id> -p "continue"` until the session reports done, blocked, or
   the pass budget is spent. Poll status with `magpie --json --session <id>`.
3. Confirm the goal directory shows either a `strategyArtifact` fact (coached) or a
   recorded `known_flow` classification (coach correctly skipped). Record which.

Fallback, if the parent path is not usable unattended yet:

1. Scout: one `browser-agent run` with the objective plus "survey and record what
   flows exist; do not submit" and a weak criterion (`url_includes` of the start path).
2. Coach: one Magpi Test model call (stronger model allowed, read-only) over a
   compressed digest of the scout's ledger, producing a short strategy: which flows to
   try, in what order, what to avoid. Mirror Magpi's `StrategyArtifact` fields so the
   swap to the real coach later is mechanical.
3. Execute: `browser-agent run` per suggested flow with the strategy in the goal text
   and criteria from the candidate scenario.
4. Record `coachedBy: "magpi-test-fallback"` so the report is honest about it.

Either way, Magpi Test does not drive the browser itself and does not reimplement the
planner.

### Pass harvest (MT-5.3)

After a pass, read its goal directory:

- **Completed flows** become candidate Scenarios with `source: "explore"`. Their
  criteria are compiled from what the pass recorded as proof (remember notes,
  `after.changes`, final page text), through the same criteria compiler as guided
  scenarios, then checked against the start page (must fail there).
- **Noticed but unfinished flows** become candidate Scenarios with `status: "pending"`.
- Every candidate then goes through the bounded-run path (fixed criteria → Magpi run
  → Trajectory). A coached pass's own trajectory is not turned into a test directly,
  because its success was not checked against criteria fixed beforehand. This costs
  one extra run per test and is what keeps exploration honest (D20).
- Deduplicate candidates by `(area, lens, normalized steps)`.

## Budgets (defaults; flags override)

| Budget | Default |
| --- | --- |
| Passes per `explore` | 12 |
| Turns per coached pass | 40 |
| Turns per bounded run | 24 |
| Repair attempts per trajectory | 2 |
| Candidates turned into runs per pass | 5 |

## Open

- Whether exploration should reuse Magpi's `PlanStore` task graph as the app map in M2
  instead of our own `app-map.json`. Brief section 4 suggests it might. Decide in M2
  with evidence from M1 runs.
