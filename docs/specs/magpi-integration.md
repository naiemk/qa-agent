# Magpi integration

Status: **proposed (M1)**. Facts verified against `browser-session-agent` at
`@naiemk/magpi` 0.1.8 on 2026-10-04. If you find a fact here is wrong, fix this file in
the same PR and note it under "Corrections" at the bottom.

Magpi repo: `naiemk/browser-session-agent` (local checkout `../browser-session-agent`).
All Magpi paths below are relative to that repo.

## The mental model in one paragraph

Magpi is a Playwright browser agent built on Pi (`@earendil-works/pi-agent-core`). The
model never touches CSS: it sees a semantic snapshot of controls with short refs
(`e12`), picks an action by ref, and the harness executes it and checks a postcondition
in code (Magpi D5, D17). Task success criteria are predicates fixed before the run and
evaluated in code, never by the model (D20). Every action is written to an append-only
ledger on disk (D7). For unfamiliar sites, a planner classifies the goal and, when the
efficient route is unknown, runs scout → coach → execute: a cheap scout gathers
evidence, a stronger read-only coach writes a strategy, the cheap executor follows it
(D58). Other agents use Magpi as a worker through its CLI and a Pi session id; they never
drive refs themselves (D55, D59). **Magpi Test is one of those other agents.**

## Rules from Magpi that Magpi Test must respect

| Magpi decision | What it means for us |
| --- | --- |
| D5 Semantic refs, not CSS | Refs (`e12`, `data-core-ref`) are per-session handles. Never put them in generated tests. |
| D17 Harness accepts actions | An action in the ledger with `type: "action"` was verified. `type: "failure"` was not. Only build trajectories from verified actions. |
| D18 Page plans are a closed DSL | Model-written Playwright code is not Magpi's style either. Our emitter is template code (QD4). |
| D20 Criteria from outside the executor | Scenario criteria are written before the run and passed as `--criterion`. The run's own claim (`claimed`) is never used as success. |
| D23 Per-action reversibility | Irreversible actions (submit, pay, send, delete) need approval under `--policy ask`. Use `--policy auto` only against local test stacks. |
| D25 Knowledge proposes, never authorizes | Coach strategies and remembered facts guide exploration. They are never assertions. |
| D37 Tests never call a model | Our tests do not spawn real Magpi runs with a provider. Use fixtures of goal directories. |
| D55 / D59 Parents use the CLI and a session id | We call `magpie` and `browser-agent`, read the goal directory, and keep the session id. |
| D58 Coach after scout | We do not write our own coach. We ask Magpi for coached passes and read the artifact. |

## Entry points we use

### Bounded, criteria-checked run: `browser-agent run`

Source: `src/cli/main.ts` (`commandRun`). Bin: `browser-agent` → `bin/browser-agent.mjs`.

```bash
browser-agent run "<goal text>" \
  --url http://localhost:5173/create \
  --criterion '{"kind":"text_visible","text":"Invoice created"}' \
  --criterion 'url_includes:/pay' \
  --policy auto \
  --max-turns 24 \
  --model openrouter/<id> \
  --root <dir> \
  --json
```

- `--criterion` is repeatable. Accepts `"text"`, `"<kind>:<text>"`, or a JSON
  `Predicate`. Prefer JSON; it covers every kind.
- With no criteria, Magpi substitutes `url_includes: ""`, which always passes. **Always
  pass at least one real criterion.**
- `--root` overrides the core home (default `BSA_CORE_HOME` or `~/.browser-agent-core`).
  Use a per-target root, e.g. `<target>/magpi-tests/state/magpi-home`, so runs are easy
  to find and clean. Add it to the target's `.gitignore`.
- `--headed` shows the browser; default is headless.
- Exit code: `0` only if `status === "success"`, else `1`; `2` for usage errors.
- `--json` stdout:

```json
{
  "goalId": "goal_mtx...",
  "status": "success",
  "claimed": { "status": "...", "summary": "..." },
  "turns": 9,
  "tokens": 12345,
  "costUsd": 0.0123,
  "checks": [{ "passed": true, "detail": "...", "predicate": "text_visible: Invoice created" }]
}
```

stderr also prints `goal <goalId>` and `evidence <root>/goals/<goalId>`.

### Coached session: `magpie` parent path

Source: `src/hosts/local-cli/launch.ts` (`helpText`), `src/hosts/local-cli/cli.ts`,
`src/host/parent-plan.ts` (`admitParentPlan`, `writeAdmittedPlan`), spec
`docs/parent-agent.md`.

```bash
# start: prints {session_id, goal_id, state} and exits; no browser yet
magpie --json --name "<label>" --plan-file plan.md "<objective>"

# drive / continue unattended
magpie --session <session_id> -p "<instruction or 'continue'>"

# status
magpie --json --session <session_id>
```

- The plan file is Layer 1 only: objective, constraints, stop rules, what success
  looks like. It must not contain click/type steps (PARENT-05). Magpi classifies it as
  `calibration_required` (inserts scout → coach → execute), `known_flow` (no coach), or
  `criteria_unsettled` (needs the operator) (PARENT-06).
- Sessions live under `~/.browser-agent-core/pi-sessions` by default; override with
  `--session-dir`. Goal artifacts are under the core home like any other run.
- Model pins `default` / `plan` / `coach` come from Magpi profiles
  (`src/host/pi-models.ts`, `magpie profiles apply budget|balanced|grok`).
- **Unverified for unattended M1 use**: whether `-p` runs the whole scout → coach →
  execute loop to completion without a TUI, and how to pass a start URL and `--policy`.
  Story MT-0.2 settles this. Until then treat this path as experimental and keep the
  fallback in [discovery-and-exploration.md](discovery-and-exploration.md).

### Not used in M1

- `magpie` interactive TUI (`/plan`, `/coach`): human-driven.
- `browser-agent replay <goalId>`: prints ledger events only; it does not re-drive the
  browser. Useful for debugging, not for replay.
- `browser-agent suite`: Magpi's own regression suite.
- Deep imports like `@naiemk/magpi/src/runtime/runtime.ts`: outside the package's
  `exports` (only `"."` is exported). Do not use; see QD2.
- Public exports `interpretPagePlan` / `PlaywrightPlanRuntime` (`src/plan/`): a
  deterministic interpreter, but it runs inside Magpi's session. Our replay target is
  plain Playwright, so we borrow its *target vocabulary*, not the runtime.

## The goal directory (what we read)

`goalPaths(root, goalId)` in `src/core/paths.ts`:

```text
<root>/goals/<goalId>/
  goal.json        goal record and merged facts (remember notes, strategyArtifact)
  plan.json        PlanStore task graph (when a plan exists)
  events.jsonl     ledger: one LedgerEvent per line
  metrics.jsonl    per-turn metrics (tokens, timings)
  payloads.jsonl   every tool result text, per turn
  tasks/  entities/  scratch/  artifacts/  ...
```

### `events.jsonl` (ledger)

Source: `src/core/ledger.ts`, written for actions by `act()` in `src/core/act.ts`.
JSONL, redacted on write, payload capped at 4000 chars. Fields relevant to us:

```ts
{
  type: "action" | "failure" | /* notes, yields, ... */ string;
  intent?: string;                  // why: ActionRequest.intent, else "<kind> <ref|url>"
  before?: { url; title; controls: number; truncated?: true };
  action?: {
    kind: "navigate" | "click" | "type" | "select" | ...;
    ref?: string;                   // "e12" - NOT a durable locator
    url?: string;
    reversibility?; reversibilityReason?; authorization?; authorizationReason?;
  };
  after?: { url; title; changes: string[] };
  outcome?: { ok: boolean; detail: string };
}
```

### The trap: the ledger has refs, not locators

`act()` resolves `ref` to a `Control` (`src/core/types.ts`):

```ts
interface Control { ref; role; name; tag; value?; disabled?; checked?; required?;
  inputType?; submits?; href?; row?; ... }
```

but the ledger action row keeps only `ref`, and it does not keep the typed `text` or the
selected `value` either (`ActionRequest.text` / `.value`). Without role + name and the
input, a trajectory cannot become a Playwright locator plus a `fill`.

Two ways to close the gap, in order of preference:

1. **MT-2.1 (upstream, small, generic):** in `src/core/act.ts`, add
   `target: { role, name, tag, href?, inputType? }` from the resolved control and
   `input: request.text ?? request.value` to `action`. The ledger already redacts on
   write. Readable traces benefit every Magpi user, so this fits QD1.
2. **Fallback (no Magpi change):** join each action to the latest observation in
   `payloads.jsonl` before it (same turn or earlier), parse the control line for the
   ref, and read role and name from there. Brittle because it parses rendered text;
   use only until MT-2.1 lands, and mark trajectories built this way with
   `"source.locatorRecovery": "payload-join"`.

Also note `Control` has no `data-testid`. If testid targets prove necessary (wallet
flows in M3), adding `testId` to `Control` is a second candidate upstream change.

### Coach output

`StrategyArtifact` (`src/runtime/coach/strategy.ts`): `summary`, `loop[]`, `qualify[]`,
`exceptions[]`, `record[]`, `stop[]`, `doNot[]`, `confidence`, `falsify`,
`assumptions[]`. Stored as goal fact `strategyArtifact` in `goal.json`, readable with
`strategyFromFacts`. For us it is evidence that a pass was coached, and a source of
candidate scenarios (`exceptions`, `qualify`). It is never an assertion (D25).

### Predicates (Magpi criteria vocabulary)

`Predicate` in `src/core/types.ts`, evaluated by `src/core/predicates.ts`:

```ts
| { kind: "url_includes"; text } | { kind: "title_includes"; text }
| { kind: "text_visible"; text } | { kind: "text_absent"; text }
| { kind: "control_exists"; role?; name? } | { kind: "control_absent"; role?; name? }
| { kind: "value_equals"; name; text } | { kind: "value_includes"; name; text }
| { kind: "no_console_error" } | { kind: "dialog_open"; open }
| { kind: "all"; of } | { kind: "any"; of } | { kind: "not"; of }
| { kind: "ref_exists"; ref }      // never use: refs are per-session
```

Scenario criteria use exactly this vocabulary, so the same object is passed to Magpi
during exploration and translated to Playwright `expect` for replay
([test-synthesis.md](test-synthesis.md)).

## Useful Magpi capabilities to reuse rather than rebuild

| Need | Magpi piece | Path |
| --- | --- | --- |
| What does this page offer, without clicking | `surveyAffordances(page)` | `src/core/survey.ts` |
| Read a link in a side tab without losing place | `peek` | `src/core/peek.ts` |
| Control snapshot with roles and names | `perceive` | `src/core/perceive.ts` |
| Is this action irreversible | `classifyAction` | `src/core/reversibility.ts` |
| Code-only criteria | `evaluatePredicate`, `verify` | `src/core/predicates.ts` |

These are internal (not exported). In M1 reach them only through Magpi runs. If a
story needs one directly (likely `surveyAffordances` for MT-3.2), the options are a
small exported API upstream or a Magpi run whose goal is "survey and report"; MT-3.2
decides and records it in `decisions.md`.

## Environment

- Node 24+ (Magpi `engines.node >= 24`).
- Playwright Chromium: `npx playwright install chromium`.
- Provider key for live runs: `OPENROUTER_API_KEY` (or `ANTHROPIC_API_KEY`,
  `OPENAI_API_KEY`, `GOOGLE_API_KEY`). Never required by tests.
- Install for development: `"@naiemk/magpi": "file:../browser-session-agent"` until MT-2.1
  is released, then the published version.

## Corrections

None yet.
