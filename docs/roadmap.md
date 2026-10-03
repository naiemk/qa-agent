# Roadmap

Living document. Tick boxes as work lands. Do not rewrite a ticked step; add a dated note
under it if the outcome was partial or the plan changed. The roadmap is the **order and
the gates**. Detail lives in [epics](epics/README.md) and [specs](specs/README.md).

**As of 2026-10-04.** Current focus: **M1**. Nothing in M2+ starts until M1's exit
checks are ticked, except notes and specs.

| Milestone | What a user can do | Target | Status |
| --- | --- | --- | --- |
| M1 | Unleash Magpi Test on onchain-invoice: it discovers the UI and critical paths, turns human scenarios and coached exploration into Playwright tests that replay without AI | ~2 days | Not started |
| M2 | A second run reuses what the first learned instead of rediscovering | days | Later |
| M3 | Hard flows (passkeys, wallet, settlement) via the project's own test helpers | 1-2 weeks | Later |
| M4 | A code change triggers exploration and repair of only the affected areas | later | Later |
| M5 | Open-ended "test what matters", scored against the hidden human suite | later | Later |

Not on the roadmap at all: billing, dashboards, organizations, SSO, multi-tenant
orchestration, browser farms, hosted SaaS (brief section 17).

---

## M1 — Unleash MVP (about two days)

### The claim

Given a project and its startup scripts, `magpi-test run` drops onto the codebase,
discovers the UI and the critical paths, and produces a first batch of Playwright tests
covering happy paths and edge cases. Tests come from two sources:

- **Guided:** a human wrote what to test and the steps (`scenarios/*.md`).
- **Explored:** Magpi ran coached passes (planner → scout → coach → execute) over each
  critical path from several viewpoints (lenses), not one wander.

Every test kept in `magpi-tests/specs/` has passed 3 times in a row against a freshly
started stack with `npx playwright test`, no Magpi and no model in the process.

"Cover all the happy paths and edge cases" is what the M1 tool is *for*. Reaching full
coverage of onchain-invoice is the run you start when M1 is done, not engineering that
must fit in the two days.

### How it stays at two days

- Reuse instead of build: Magpi does browsing, verification, planning, coaching.
  Playwright does running, locators, assertions, traces, web servers. The target project
  does startup and fixtures. We write the glue and the translation.
- One pipeline, two front doors: guided and explore both end as
  `Scenario → Magpi run → Trajectory → Playwright spec → acceptance`.
- Wallet, passkey, settlement flows are allowed to be skipped in M1 and recorded as
  `needs-fixture` candidates. They are M3.

### Exit checks

- [ ] `magpi-test discover` on onchain-invoice writes an app map with areas and ranked critical paths, without reading answer-key files (MT-3.3, MT-1.2 guard test).
- [ ] At least 3 guided scenarios become accepted specs (MT-7.2).
- [ ] At least 5 explored specs accepted, from at least 2 lenses, including at least one edge case (validation error, empty state, or invalid link) (MT-7.3).
- [ ] Explore passes went through Magpi's planner/coach path, visible in the goal artifacts (`strategyArtifact` fact or recorded classification `known_flow`) (MT-2.3).
- [ ] All accepted specs pass `--repeat-each=3 --retries=0` from a fresh stack, and the no-AI guard passes (MT-6.3, MT-6.5).
- [ ] M1 report written: what was found, what was accepted, quarantined, skipped, tokens and browser actions per accepted test (MT-7.4).

### Day plan

Lanes can run in parallel (separate agents). Within a lane, order matters.

**Day 1 — morning (unblock and scaffold)**

| Lane | Stories |
| --- | --- |
| A | [ ] MT-0.2 Magpi spike: confirm the run paths and artifacts before anyone builds on them |
| B | [ ] MT-0.1 Prior-art reuse note (timebox 2 hours) |
| C | [ ] MT-1.1 Scaffold → [ ] MT-1.4 Model client port |
| D | [ ] MT-2.1 Upstream Magpi: ledger records action target and input (PR on browser-session-agent) |

**Day 1 — afternoon (one guided test end to end)**

| Lane | Stories |
| --- | --- |
| A | [ ] MT-1.2 Target manifest + answer-key guard → [ ] MT-1.3 Stack controller → [ ] MT-7.1 onchain-invoice manifest |
| B | [ ] MT-2.2 Bounded-run adapter → [ ] MT-2.4 Trajectory reader |
| C | [ ] MT-6.1 Playwright emitter → [ ] MT-6.2 Generated Playwright config → [ ] MT-6.3 Acceptance runner → [ ] MT-6.5 No-AI guard |
| D | [ ] MT-4.1 Scenario format → [ ] MT-4.2 Criteria compiler → [ ] MT-4.3 `magpi-test guided` |

Gate for day 2: one hand-written scenario on onchain-invoice becomes an accepted spec.

**Day 2 — morning (discovery and coached exploration)**

| Lane | Stories |
| --- | --- |
| A | [ ] MT-3.1 Static scan → [ ] MT-3.2 Live surface survey → [ ] MT-3.3 App map and critical paths |
| B | [ ] MT-2.3 Coached-session adapter → [ ] MT-5.2 Coached pass runner |
| C | [ ] MT-5.1 Lenses and pass planner → [ ] MT-5.3 Pass harvest |
| D | [ ] MT-6.4 Repair loop → [ ] MT-7.2 First guided batch |

**Day 2 — afternoon (unleash)**

| Lane | Stories |
| --- | --- |
| A | [ ] MT-7.3 `magpi-test run` on onchain-invoice |
| B | [ ] MT-7.4 M1 report and roadmap update |

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
   Playwright `webServer` entries with `reuseExistingServer` outside CI; reuse that
   rather than writing new scripts (see [specs/onchain-invoice.md](specs/onchain-invoice.md)).
4. **Commerce pages have few `data-testid`s.** Locators will mostly be role + name and
   label. i18n means names can change with locale; pin the locale in the generated config.

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
