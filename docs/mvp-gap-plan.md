# MVP gap plan

**As of 2026-10-16.** Status: **accepted and folded in.** The new stories are in the
epics, decisions QD11-QD17 are in [decisions.md](decisions.md), and the order is in
[roadmap.md](roadmap.md), which remains the source of truth. This file stays as the
record of why M1 changed.

This compares the MVP as now described with the M1 plan already in this repo, and lists
only what is missing or has to change.

## The MVP, restated

A QA agent you point at a UI-heavy, browser-heavy application. It:

1. **Runs inside the project's own QA CI job.** That CI job brings up the app in a
   simulated environment (seeded data, fake chain, dev OTP and so on) and hands us the
   URL and port. We never start or provision the app ourselves.
2. **Understands the codebase.** If the repo already has agent or QA docs (`AGENTS.md`,
   `CLAUDE.md`, `QA.md`, `.cursor/rules`, `docs/`), we use them. If it does not, we ask
   the user to run their coding agent with a prompt we provide. That agent writes a QA
   brief, and we read the brief.
3. **Builds a site map.** The map holds areas, routes, critical paths, and the source
   files behind each of them.
4. **Explores** the critical paths like a QA engineer would.
5. **Leaves behind two artifacts:**
   - **manual test cases** that a person can read, review and edit; and
   - **deterministic scripts** that replay with no AI and no tokens.

The pitch that sets us apart: *spend tokens to discover, never to replay*. Because the
site map knows which code backs which flows, a later code change tells us exactly what
to re-test and what to re-explore. The diff-driven loop comes after the MVP, but the MVP
has to record the data it needs (see G6).

## What the existing M1 plan already covers

| MVP need | Already planned | Where |
| --- | --- | --- |
| Deterministic, replayable tests | Trajectory JSON → emitted Playwright → 3 green runs, no AI | QD4, QD6, E6 |
| "DSL" the AI writes and code compiles | Scenario + Trajectory JSON. The model edits data, never code | QD4, [scenario-and-trajectory.md](specs/scenario-and-trajectory.md) |
| Site map with critical paths | `state/app-map.json` built from a static scan plus a live survey | E3 |
| Exploring like QA | Coached Magpi passes per path × lens | E5 |
| Human-written tests as input | Guided `scenarios/*.md` | E4 |
| Magpi upgrades kept generic | One upstream change (MT-2.1). Invariant 3 | E2 |
| Not leaking the human suite into the benchmark | Answer-key guard | QD9, MT-1.2 |

The pipeline and invariants hold. The gaps sit at the edges: how we get the
environment, how we get understanding, what we hand back, and the groundwork for
change awareness.

## Gaps

### G1. The environment is given to us. We do not start it.

**Today:** QD8 and MT-1.3 assume Magpi Test starts the target through its Playwright
`webServer` entries. QD6 gets a "fresh stack" for acceptance by restarting those
servers with `CI=1`.

**Needed:** an **attach mode** as the main path. The CI job sets an environment
contract and we only check that the app is ready:

| Variable | Required | Meaning |
| --- | --- | --- |
| `MAGPI_TEST_BASE_URL` | yes | Where the UI is reachable (host and port) |
| `MAGPI_TEST_READY_URL` | no | Health URL to poll before starting (defaults to the base URL) |
| `MAGPI_TEST_RESET_CMD` | no | Shell command that returns the environment to its seeded state |
| `MAGPI_TEST_ENV_KIND` | no | `simulated` (default) or `shared`. `shared` turns off destructive exploration |

**Consequences:**
- **Acceptance without a fresh stack.** Once the stack is handed to us we cannot
  restart it, so QD6 changes. Proposed **QD11**:
  - If `RESET_CMD` exists, run it before each of the 3 replays.
  - If it does not, the 3 replays run against the same live environment, and a test
    is only accepted if it creates its own data. Values the emitter generates (emails,
    names, amounts) get a run-unique suffix.
  - Either way we keep 3/3 green with `--retries=0`.
- **Non-localhost URLs.** The manifest currently allows `policy: auto` only on
  localhost. A CI preview URL (for example `qa-123.internal`) has to be allowed when
  `ENV_KIND=simulated`. Proposed **QD12**: the manifest lists `allowedHosts`, and
  `auto` is allowed only for those hosts.
- **Keep `webServer` start mode** as a local-dev convenience. It stops being the
  default.

**Stories:**
- **MT-1.5 Attach mode.** Read the env contract, run the readiness probe, call reset.
  MT-1.3 becomes optional and moves off the critical path.
- **MT-6.6 Acceptance under attach.** Reset between replays, plus the run-unique value
  rule in the emitter.

### G2. Codebase understanding comes from the repo's own docs, or from the user's agent

**Today:** MT-3.1 does a regex static scan of routes, docs headings, helpers and test
IDs. Nothing reads `AGENTS.md`-style context on purpose, and nothing covers the
"no docs" case.

**Needed:** a **QA brief**, `magpi-tests/qa-brief.md`. It is one short file with fixed
headings:
- **Product:** what the app is for, in a sentence or two.
- **Users and roles.**
- **Areas:** each with its main routes and source folders.
- **Critical flows:** listed in order of priority.
- **Test data:** accounts and seeded data that are available.
- **Off-limits:** things never to do, such as real payments or emailing real users.
- **Known fixtures:** OTP, passkeys, funding.

How we get the brief:
1. `magpi-test init` looks for `qa-brief.md`. If it is missing, it collects
   `AGENTS.md`, `CLAUDE.md`, `QA.md`, `README*`, `.cursor/rules/**` and `docs/**`, all
   through the answer-key guard, and has a cheap model condense them into the brief.
2. If those sources are too thin (no routes or flows can be pulled out), `init` stops.
   It prints a ready-to-paste prompt for the user's coding agent (Claude Code, Cursor
   and so on), and that agent writes `qa-brief.md`. The prompt carries the answer-key
   exclusion, because the user's agent can read anything.
3. The user commits the brief. From then on, discovery reads the brief and the static
   scan, and treats the brief as a hint that the live survey has to confirm.

**Stories:**
- **MT-3.0 QA brief: format, ingest and agent prompt.** Done when: onchain-invoice gets
  a brief from its existing `AGENTS.md` and `docs/`, a fixture repo with no docs gets
  the prompt, and the canary test still passes.
- **MT-3.3 (change):** the app-map prompt takes the brief's critical flows as candidate
  paths. Each path still has to be seen in the scan or the survey.

### G3. The site map has to point at source code

**Today:** the app map has areas, routes and critical paths. The static scan finds
route file and line, but they are not carried into the map.

**Needed:** each area and critical path carries `sourceFiles` (route file, page
component, and directly imported components from the same folder). Each accepted spec
records the area and path it covers. This is the data the change-awareness pitch runs
on. It costs little now and is hard to add later.

**Stories:**
- **MT-3.1 (change):** emit the route → component file mapping.
- **MT-3.3 (change):** `sourceFiles` on areas and paths.

### G4. Manual test cases as a first-class output

**Today:** scenarios are JSON in `state/`. Only humans write the markdown form, as
guided input.

**Needed:** after a run, a deterministic renderer (no model) writes
`magpi-tests/manual/<area>.md`. It holds one test case per scenario, with title,
preconditions, steps, expected result, and status: `automated` (with a link to the
spec), `quarantined` (with the reason), or `needs-fixture`.

The format **is** the guided scenario format, so the loop closes:
1. The agent discovers a scenario and writes it as a manual case.
2. A human corrects it.
3. The corrected file goes back in as a guided scenario and becomes an automated spec.

**Story:** **MT-6.7 Manual test renderer**, round-trip tested (render → parse → same
Scenario).

### G5. The "DSL": name it, and do not invent a new one

The concept is already there. Trajectory JSON is the hard-coded script, and Playwright
is what it compiles to. For the MVP we **do not** design a new language. Proposed
**QD13**:
- Trajectory JSON is the source of truth for a test.
- `.spec.ts` is a generated build artifact. It is committed so plain
  `npx playwright test` works, but nobody edits it by hand.
- Repairs edit the Trajectory and regenerate the spec.

A friendlier text DSL can come later if users want to edit tests directly. The
round-trippable manual format (G4) covers most of that need.

**Story:** documentation only. Update [test-synthesis.md](specs/test-synthesis.md) and
the README.

### G6. Change-awareness groundwork (pitch, not MVP)

The diff-driven loop is still M4. The MVP needs only G3, plus one cheap command that
proves the idea:

- **MT-10.1 `magpi-test impact --base <ref>` (stretch).** Deterministic, no model:
  1. Take the changed files from `git diff`.
  2. Map them to areas and paths through `sourceFiles`.
  3. Print which accepted specs to run and which areas to re-explore.

  It only reports. It does not explore. This turns the pitch into a demo.

### G7. Running inside CI

**Today:** the CLI is designed for local runs. Nothing covers how it behaves as a CI
step.

**Needed:**
- **Non-interactive by default.** Clear exit codes: `0` ran, `2` environment not
  ready, `3` brief missing (prompt printed).
- **A model key from CI secrets**, plus a token and time budget
  (`--max-tokens`, `--max-minutes`) so a run cannot overspend.
- **Outputs as CI artifacts:** `magpi-tests/` and `report.md`. In the MVP a human
  commits accepted specs and manual cases. The agent opening a PR comes later.

**Stories:**
- **MT-7.5 Dogfood QA CI on onchain-invoice.** A new `qa-agent.yml` workflow reuses the
  docker stack from the existing `system-tests` workflow, exports
  `MAGPI_TEST_BASE_URL`, runs `magpi-test run`, and uploads artifacts. The stack
  scripts under `system-tests/scripts/` are fine to use. `system-tests/tests/**` stays
  answer key.
- **MT-7.3 (change):** `run` respects budgets and exit codes.

### G8. Magpi upgrades

MT-2.1, recording the action target and input in the ledger, is still the only
committed upstream change. Candidates, to be decided by the MT-0.2 spike and not
assumed:

- **An exported `surveyAffordances` API**, if the live survey (MT-3.2) is better
  served by Magpi than by plain Playwright.
- **Host allowlisting in Magpi's `--policy`**, if Magpi itself refuses non-localhost
  hosts under `auto` (needed for G1).
- **A documented, unattended coached-session path**, if MT-0.2 confirms risk 1 in the
  roadmap.

Each one still has to pass invariant 3: small, generic, and tested in Magpi.

## Proposed order

The existing day plan stands. The insertions are:

| When | Add |
| --- | --- |
| Day 1 morning | MT-1.5 attach mode (lane A, before MT-1.2 finishes the manifest). MT-3.0 brief format |
| Day 1 afternoon | MT-7.5 QA CI workflow, in place of MT-1.3 on the critical path |
| Day 2 morning | MT-3.0 ingest and prompt, the MT-3.1 and MT-3.3 source-link changes, MT-6.6 |
| Day 2 afternoon | MT-6.7 manual renderer. MT-10.1 `impact` if time allows |

Realistically this adds about half a day to M1. If that is too much, cut in this order:
MT-10.1, then the "agent prompt" half of MT-3.0 (hand-write the onchain-invoice brief),
then reset-hook support in MT-6.6 (accept on unique data only).

## New exit checks for M1

- [ ] `magpi-test run` succeeds inside the onchain-invoice QA CI job, against a URL the
      job provided, and never starts a server itself (MT-7.5).
- [ ] The QA brief is produced from the repo's docs. A docs-less fixture gets the
      agent prompt and exit code 3 (MT-3.0).
- [ ] Every area and critical path in `app-map.json` has `sourceFiles` (MT-3.3).
- [ ] `magpi-tests/manual/` has a case for every scenario, and each case round-trips
      as a guided scenario (MT-6.7).

## Decisions taken (2026-10-16)

1. **Fresh state:** reset command if the CI provides one, otherwise self-isolating
   data (QD15).
2. **Missing docs:** print a prompt for the user's coding agent and exit 3 (QD14).
3. **`impact`:** in M1 as a report-only stretch story, MT-10.1 (QD17).

Decision numbers differ from the draft above: attach mode is QD11, hosts QD12, the
"DSL" QD13, the brief QD14, attach acceptance QD15, manual cases QD16, source links
QD17.
