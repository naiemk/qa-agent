# Roadmap

Living document. Tick boxes as work lands. Do not rewrite a ticked step; add a dated note
under it if the outcome was partial or the plan changed. The roadmap is the **order and
the gates**. Detail lives in [epics](epics/README.md) and [specs](specs/README.md).

**As of 2026-10-16.** Current focus: **M1**. Nothing in M2+ starts until M1's exit
checks are ticked, except notes and specs.

| Milestone | What a user can do | Target | Status |
| --- | --- | --- | --- |
| M1 | From the project's own QA CI job, unleash Magpi Test on onchain-invoice: it reads a QA brief, maps the UI and critical paths to source, turns human scenarios and coached exploration into manual test cases and Playwright tests that replay without AI | ~2.5 days | Not started |
| M2 | A second run reuses what the first learned instead of rediscovering | days | Later |
| M3 | Hard flows (passkeys, wallet, settlement) via the project's own test helpers | 1-2 weeks | Later |
| M4 | A code change triggers exploration and repair of only the affected areas (M1 ships a report-only `impact`) | later | Later |
| M5 | Open-ended "test what matters", scored against the hidden human suite | later | Later |

Not on the roadmap at all: billing, dashboards, organizations, SSO, multi-tenant
orchestration, browser farms, hosted SaaS (brief section 17).

---

## M1 — Unleash MVP (about two and a half days)

> 2026-10-16: scope changed per [mvp-gap-plan.md](mvp-gap-plan.md). The QA CI job owns
> the environment and hands us a URL (QD11). Understanding starts from a QA brief built
> from the repo's docs or written by the user's agent (QD14). The site map links to
> source (QD17). Manual test cases are an output (QD16). New stories: MT-1.5, MT-3.0,
> MT-6.6, MT-6.7, MT-7.5, MT-10.1 (stretch). MT-1.3 is off the critical path.

### The claim

Given a project whose QA CI job brings up a simulated environment and passes the URL,
`magpi-test run` drops onto the codebase, builds a QA brief from the repo's docs (or asks
the user's coding agent for one), maps the UI and critical paths to source files, and
produces a first batch of manual test cases and Playwright tests covering happy paths
and edge cases. Tests come from two sources:

- **Guided:** a human wrote what to test and the steps (`scenarios/*.md`).
- **Explored:** Magpi ran coached passes (planner → scout → coach → execute) over each
  critical path from several viewpoints (lenses), not one wander.

Every test kept in `magpi-tests/specs/` has passed 3 times in a row with
`npx playwright test`, no Magpi and no model in the process: against a freshly started
or reset stack, or, without a reset, using only self-isolating data (QD6, QD15).

"Cover all the happy paths and edge cases" is what the M1 tool is *for*. Reaching full
coverage of onchain-invoice is the run you start when M1 is done, not engineering that
must fit in the two days.

### How it stays at two days

- Reuse instead of build: Magpi does browsing, verification, planning, coaching.
  Playwright does running, locators, assertions, traces. The target's QA CI does the
  environment; the target's docs or the user's coding agent do the first understanding. We write the glue and the translation.
- One pipeline, two front doors: guided and explore both end as
  `Scenario → Magpi run → Trajectory → Playwright spec → acceptance`.
- Wallet, passkey, settlement flows are allowed to be skipped in M1 and recorded as
  `needs-fixture` candidates. They are M3.

### Exit checks

> 2026-10-17: the pipeline is implemented and passes offline end to end (fake model,
> stubbed Magpi, real Playwright acceptance against a fixture app). The onchain-invoice
> stack starts locally with `examples/onchain-invoice/start-stack.sh` under Node 24.1.
> The live exit checks below wait on a run with an OpenRouter key. Not built yet: MT-0.1,
> MT-1.3 (optional), MT-2.3 and MT-5.2 (coached passes; see QD18), MT-5.3 (harvest).

> 2026-10-20: the first live run (2026-10-19) accepted 0 specs. Fixed before funding the
> next one: the live survey failed on every page (tsx `__name`), a failed Magpi run had
> no retry (QD20), `restore` actions broke trajectory building, and `run` re-planned
> passes on every invocation (QD21).

> 2026-10-21: first live accepted spec. `create-pay-link` (a guided scenario, kept in
> `examples/onchain-invoice/scenarios/`) passed 3/3 acceptance and 3/3 plain
> `npx playwright test` with no key. Cost: $0.020 in Magpi for 2 bounded runs, $0 for
> magpi-test (human criteria, no repair). It needed three Magpi fixes (see
> magpi-integration.md corrections, 2026-10-21) and QD22 (`--max-usd`).

- [ ] `magpi-test discover` on onchain-invoice writes an app map with areas and ranked critical paths, without reading answer-key files (MT-3.3, MT-1.2 guard test).
- [ ] At least 3 guided scenarios become accepted specs (MT-7.2).
- [ ] At least 5 explored specs accepted, from at least 2 lenses, including at least one edge case (validation error, empty state, or invalid link) (MT-7.3).
- [ ] Explore passes went through Magpi's planner/coach path, visible in the goal artifacts (`strategyArtifact` fact or recorded classification `known_flow`) (MT-2.3).
- [ ] All accepted specs pass `--repeat-each=3 --retries=0` from a fresh stack, and the no-AI guard passes (MT-6.3, MT-6.5).
- [ ] `magpi-test run` succeeds inside the onchain-invoice QA CI job against the URL the job provides, without starting any server (MT-7.5).
- [ ] `magpi-test init` builds the QA brief from onchain-invoice's docs; on a docs-less fixture it prints the agent prompt and exits 3 (MT-3.0).
- [ ] Every area and critical path in `app-map.json` has `sourceFiles` (MT-3.3).
- [ ] `magpi-tests/manual/` has a case for every scenario, and each round-trips as a guided scenario (MT-6.7).
- [ ] Stretch: `magpi-test impact --base <ref>` reports impacted areas and specs (MT-10.1).
- [ ] M1 report written: what was found, what was accepted, quarantined, skipped, tokens and browser actions per accepted test (MT-7.4).

### Day plan

Lanes can run in parallel (separate agents). Within a lane, order matters.

**Day 1 — morning (unblock and scaffold)**

| Lane | Stories |
| --- | --- |
| A | [x] MT-0.2 Magpi spike: confirm the run paths and artifacts before anyone builds on them |
| B | [ ] MT-0.1 Prior-art reuse note (timebox 2 hours) |
| C | [x] MT-1.1 Scaffold → [x] MT-1.4 Model client port |
| E | [x] MT-3.0 QA brief format and parser (ingest and prompt land after MT-1.2 / MT-1.4) |
| D | [x] MT-2.1 Upstream Magpi: ledger records action target and input (PR on browser-session-agent) |

**Day 1 — afternoon (one guided test end to end)**

| Lane | Stories |
| --- | --- |
| A | [x] MT-1.2 Target manifest + answer-key guard → [x] MT-1.5 Attach mode → [x] MT-7.1 onchain-invoice manifest → [ ] MT-7.5 QA CI job |
| B | [x] MT-2.2 Bounded-run adapter → [x] MT-2.4 Trajectory reader |
| C | [x] MT-6.1 Playwright emitter → [x] MT-6.2 Generated Playwright config → [x] MT-6.3 Acceptance runner → [x] MT-6.5 No-AI guard |
| D | [x] MT-4.1 Scenario format → [x] MT-4.2 Criteria compiler → [x] MT-4.3 `magpi-test guided` |
| E | [x] MT-3.0 QA brief ingest and agent prompt |

Gate for day 2: one hand-written scenario on onchain-invoice becomes an accepted spec.
MT-1.3 (local stack controller) is optional; build it only if a lane is idle.

**Day 2 — morning (discovery and coached exploration)**

| Lane | Stories |
| --- | --- |
| A | [x] MT-3.1 Static scan (with source links) → [x] MT-3.2 Live surface survey → [x] MT-3.3 App map and critical paths (with brief and `sourceFiles`) |
| B | [ ] MT-2.3 Coached-session adapter → [ ] MT-5.2 Coached pass runner |
| C | [x] MT-5.1 Lenses and pass planner → [ ] MT-5.3 Pass harvest |
| D | [x] MT-6.4 Repair loop → [ ] MT-7.2 First guided batch |
| E | [x] MT-6.6 Acceptance in attach mode → [x] MT-6.7 Manual test renderer |

**Day 2 — afternoon (unleash)**

| Lane | Stories |
| --- | --- |
| A | [ ] MT-7.3 `magpi-test run` on onchain-invoice |
| B | [ ] MT-7.4 M1 report and roadmap update |
| C | [x] MT-10.1 `magpi-test impact` (stretch) |

If time runs short, cut in this order: MT-10.1; the agent-prompt half of MT-3.0
(hand-write the onchain-invoice brief); reset support in MT-6.6 (self-isolating data
only).

### Known risks (check early, do not discover late)

1. **Coached runs may not work unattended yet.** Magpi's parent path
   (`magpie --json` then `magpie --session <id> -p`) is documented and partly
   in tree. MT-0.2 confirms it on day 1. Fallback: run several bounded
   `browser-agent run` passes per lens with a coach-written strategy fed in as the
   goal text, and record that the planner path was bypassed. Do not block M1 on it.
2. **Ledger has refs, not locators.** Magpi writes `ref: "e12"` per action. Without
   role and name, a trajectory cannot become a durable Playwright locator. MT-2.1 fixes
   this upstream; MT-2.4 has a payload-join fallback.
3. **Onchain-invoice startup is three processes.** It is already expressed as
   Playwright `webServer` entries with `reuseExistingServer` outside CI. The QA CI job
   (MT-7.5) starts those same three commands rather than new scripts (see
   [specs/onchain-invoice.md](specs/onchain-invoice.md)).
4. **Commerce pages have few `data-testid`s.** Locators will mostly be role + name and
   label. i18n means names can change with locale; pin the locale in the generated config.
5. **Self-isolation may reject useful specs.** Without a reset command, any assertion on
   an empty state or a list count is rejected (QD15). If too many good candidates die
   there, add a reset to the onchain-invoice QA job (stop and restart the e2e stack)
   rather than loosening the rule.

---

## M2 — Keep what was learned (later)

Sketch only. Persist the app map, explored areas, accepted specs as executable knowledge,
and uncertainty, so a second `magpi-test run` explores only what is new, failed, or
uncertain. See [epics/E8-knowledge.md](epics/E8-knowledge.md).

## M3 — Hard flows (later)

Wallet creation, passkeys, email OTP, payment settlement on onchain-invoice, through a
small fixture seam that loads the project's own helpers (`ui/e2e/helpers/*`). Nothing
onchain-specific inside Magpi. See [epics/E9-fixtures-and-hard-flows.md](epics/E9-fixtures-and-hard-flows.md).

## M4 — Incremental maintenance (later)

From a diff or PR, find likely impacted areas, explore only those, repair or add specs.
See [epics/E10-incremental.md](epics/E10-incremental.md).

## M5 — Open-ended QA (later)

"Understand this application and test its important functionality." Score against the
hidden human suite and the metrics in brief section 19. See
[epics/E11-evaluation.md](epics/E11-evaluation.md).
