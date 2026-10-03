# Implementer guide

For coding models (and people) implementing stories in this repo. [AGENTS.md](../../AGENTS.md)
has the rules; this file has the reasoning behind them and the traps we already know
about. If you only have time for one section, read "Traps".

## How to work a story

1. Read the story. Its "Done when" list is the contract. Do not do more than it asks;
   extra scope makes review harder and breaks other lanes.
2. Read the specs it links, and [magpi-integration.md](../specs/magpi-integration.md)
   if anything touches Magpi.
3. Check the story's dependencies are ticked. If not, stop: you would be building on
   guesses.
4. Write the tests from "Done when" first, with the fake model and fixture goal
   directories. Then make them pass.
5. Run `npm run precommit`.
6. Tick the story box in the epic file and in [roadmap.md](../roadmap.md). If something
   was only partly done, add a dated note instead of ticking.
7. If you learned a fact (Magpi behaves differently, Playwright has an API, the target
   has a quirk), put it in the relevant spec in the same PR.
8. One story per PR. PR title: `MT-x.y: <story title>`.

## The architecture in five sentences

1. Magpi is the browser intelligence: it perceives, acts by semantic ref, verifies each
   action, plans, scouts, and coaches. We call it; we do not rebuild any of that.
2. Playwright is the deterministic runtime: runner, locators, assertions, traces, web
   servers. Generated tests are plain Playwright.
3. Between them sits one data boundary: Scenario (what to test, with fixed criteria)
   and Trajectory (what a verified run did, with durable targets). Models only write
   these two JSON shapes.
4. Everything that produces code is deterministic template code, and every test must
   prove itself by passing 3 fresh replays with no AI.
5. Guided and explore are two front doors into the same pipeline:
   `Scenario → Magpi run → Trajectory → spec → acceptance`.

## Why the rules are the rules

| Rule | Why |
| --- | --- |
| Models edit JSON, not code | Cheap models fill typed structures reliably and write subtly broken test code unreliably. JSON can be validated in code; generated code can only be run. |
| Criteria fixed before the run | If the agent decides what success is after acting, it grades itself, and every run "passes". Magpi's D20 exists because this happened. |
| Explore candidates go through a bounded run | A coached pass's success was not checked against fixed criteria, so its trajectory is not trustworthy as a test. One extra run per test buys honesty. |
| 3 fresh replays | One green run can be luck (leftover state, timing). Three from a fresh stack catches most flakiness cheaply. |
| No refs, CSS, or XPath in specs | Magpi refs are per-session. CSS breaks on styling changes. Role + name is what users see and what Playwright recommends. |
| Answer key enforced in code | A model that has seen the human tests will reproduce them, and the benchmark becomes meaningless. Conventions leak; code does not. |
| Magpi stays generic | Improvements to Magpi (perception, cost, reliability) should help every Magpi use. QA logic inside Magpi would fork it. |
| Small prompts | Cheap models fail on long contexts. Give one local problem plus the JSON shape. The big picture lives in `state/` files. |

## Traps (things that will bite you)

1. **Magpi's ledger stores `ref: "e12"`, not a locator.** Until MT-2.1 lands, role and
   name come from `payloads.jsonl`. Never emit a ref.
2. **`browser-agent run` with no `--criterion` always succeeds** (Magpi substitutes
   `url_includes: ""`). Always pass real criteria.
3. **Criteria that are already true on the start page** make do-nothing runs pass.
   The criteria compiler must check them against a fresh start page.
4. **Playwright runs `webServer.command` from the config file's directory.** The
   generated config lives in `magpi-tests/`, so set `cwd` to the target root.
5. **`reuseExistingServer` is on outside CI** in onchain-invoice. Acceptance uses
   `CI=1` so the stack starts fresh, which means the exploration stack must be stopped
   first, or ports collide.
6. **i18n names.** Many onchain-invoice accessible names come from translations. Pin
   `locale: "en-US"` in the browser context for both exploration and replay.
7. **Dynamic values.** Invoice ids, addresses, hashes, timestamps differ per run. Never
   assert them; assert the stable label or the URL prefix.
8. **`--policy auto` lets Magpi submit, pay, and delete without asking.** Only for local
   stacks; the manifest loader enforces it.
9. **Magpi's internals are not exported** (`runTask`, `Ledger`, coach). Do not deep-import
   `@naiemk/magpi/src/...`. Use the CLI, or propose a small exported API upstream.
10. **The coached parent path may not run unattended yet.** MT-0.2 decides. If it does
    not, use the documented fallback and label runs `coachedBy: "magpi-test-fallback"`.
    Never present fallback runs as Magpi-coached.
11. **Do not read `ui/e2e/*.spec.ts` in onchain-invoice**, not even to check a selector
    when a test fails. Use the trace and the ARIA snapshot instead.
12. **Node test runner, not Jest or Vitest.** `tsx --test`, `node:test`, `node:assert/strict`.

## Writing prompts for Magpi Test's own model calls

- One task per call. Put the output JSON shape in the system prompt and validate the
  result in code; on failure, retry once with the validation errors.
- Send summaries (routes, headings, control names), never raw source or full DOM.
- Say what not to invent: "use only routes from the list", "do not include ids or
  addresses in text criteria".
- Every prompt is logged to `state/prompts.jsonl`. Assume someone will read it.

## Writing goal text and plan files for Magpi

- Goal text for a bounded run: the scenario title, then numbered steps, then
  "Success means: <expected>". Short and literal.
- Plan files for coached passes: objective, constraints, stop rules, and what to
  record. No click/type steps; Magpi rejects procedural plans by design (PARENT-05)
  and decides the route itself after scouting.

## Tests

- Unit tests: pure functions, fixture files, fake model, stubbed process spawner.
- Integration tests: real Playwright against tiny fixture apps in `tests/fixtures/`.
- E2E tests: the full pipeline with a stubbed Magpi process that writes a fixture goal
  directory. Real Magpi runs and real model calls are never part of `npm test`.
- Live checks against onchain-invoice are manual commands recorded in the PR
  description.

## When the spec is wrong

It will be, sometimes. If reality differs from a `proposed (M1)` spec: implement what
reality requires if it stays within the story, fix the spec in the same PR, and add a
line to [decisions.md](../decisions.md) if it changes a decision. If it would change
another story's contract, stop and write a question in your story instead.
