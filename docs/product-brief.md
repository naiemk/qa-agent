# Magpi Test — Product / Research Brief for Coding Agent

## Purpose

This document is intentionally **goal-oriented rather than implementation-prescriptive**.

The task is to investigate, design, and prototype a new product **on top of Magpi** that turns Magpi's browser-agent capabilities into an autonomous QA / UI-testing system.

The coding agent should treat the ideas here as product requirements, research leads, and architectural constraints — **not as a fixed implementation plan**. It should inspect the existing Magpi codebase, inspect relevant open-source systems, research current testing approaches, and propose the simplest architecture that satisfies the goals.

---

# 1. Core Product Idea

Magpi is already a general-purpose browser agent.

The new product should use Magpi as the intelligent browser exploration engine and add a testing-oriented layer around it.

The intended user experience is approximately:

> Give the system a software project, enough information to run it, and optionally documentation or a high-level product description.  
> The system understands the application, explores it like a QA engineer, identifies important user workflows, executes those workflows, and turns successful exploration into normal deterministic automated tests.

The key property is:

> **AI is used to discover and author tests. AI should not be required to run those tests afterward.**

Once a workflow has been understood and successfully tested, the result should ideally become an ordinary Playwright test (or similarly deterministic artifact) that can run in CI repeatedly with:

- no Magpi runtime,
- no LLM calls,
- no token cost,
- no agentic decision-making.

Magpi is therefore primarily the **test discovery and test maintenance intelligence**, not the permanent test executor.

---

# 2. Product Thesis

Browser agents by themselves are becoming common.

The differentiated product is not:

> "An AI that can click around a browser."

It is:

> **"An autonomous QA engineer that learns your product and leaves behind deterministic tests."**

The long-term vision is that a development team can connect a repository and application and the system progressively builds and maintains a reliable executable model of the important product behaviors.

Example high-level interaction:

```text
magpi-test discover
```

Possible conceptual result:

```text
Understanding product...
Exploring application...
Identified major capabilities...
Testing important flows...
Generated deterministic tests...

✓ account creation
✓ login
✓ create invoice
✓ payment flow
✓ wallet send
✓ recovery
...
```

After generation, normal CI should be able to do something equivalent to:

```text
playwright test
```

without Magpi or AI.

---

# 3. Magpi Must Remain Magpi

This project should **not turn Magpi itself into a test-only product**.

Magpi should remain a general browser agent.

The testing product should preferably be:

- an extension,
- a separate package,
- a separate application,
- or a product layer using Magpi as an engine.

Avoid invasive changes to Magpi core unless a clearly reusable browser-agent capability is genuinely missing.

A useful mental model is:

```text
                Magpi
      general browser-agent engine
                  │
                  │
        ┌─────────┴─────────┐
        │                   │
     other uses         Magpi Test
                         QA product
```

This separation matters because improvements to Magpi exploration, perception, navigation, reliability, and cost should benefit all Magpi use cases.

---

# 4. Existing Magpi Architecture Should Be Reused

Before designing new abstractions, study the current code carefully.

Repository:

- `naiemk/browser-session-agent`

Relevant existing architecture includes:

### `src/core`

The browser-facing deterministic layer already contains concepts useful to QA:

- perception,
- verified actions,
- predicates,
- evidence,
- state,
- plans,
- checkpoints,
- survey,
- verification,
- reversibility,
- task graph,
- browser primitives.

### `src/runtime`

The runtime already separates a bounded task from the model provider and includes:

- task execution,
- model abstraction,
- context pruning,
- turn budgets,
- metrics,
- evidence.

### ModelPort

Magpi already deliberately isolates the model behind a model port.

That is important because this product should be designed to work well with **cheap models**, not depend on expensive frontier models for every browser action.

### Living task graph

The existing `PlanStore` has concepts such as:

- persistent tasks,
- dependencies,
- prerequisites,
- discovered child tasks,
- replanning,
- blocked work,
- resuming.

These may already provide much of the scaffolding required for application exploration.

### Persistent semantic state

Magpi already persists semantic facts rather than relying on one giant model context.

This is closely aligned with the testing product's needs.

### `surveyAffordances`

Magpi already contains a mechanism for inspecting what a page advertises — navigation, tabs, search, links, actions — without blindly following everything.

This may be useful for efficient exploration of unfamiliar applications.

The coding agent should first understand whether these primitives can be composed into the testing product **before inventing parallel versions of them**.

---

# 5. The Important Difference: Task-Level vs Application-Level Understanding

Magpi currently tends to operate around goals and tasks.

Testing requires an additional concept:

> **persistent understanding of an application across many tasks and many runs.**

The system should gradually build a big-picture understanding such as:

```text
Application
 ├─ Authentication
 │   ├─ sign up
 │   ├─ login
 │   └─ recovery
 │
 ├─ Wallet
 │   ├─ create
 │   ├─ receive
 │   ├─ send
 │   └─ add device
 │
 └─ Payments
     ├─ create invoice
     ├─ pay invoice
     └─ settlement
```

This representation does **not** need to look exactly like this.

The important requirement is that the system should know:

- what it has already explored,
- what product areas it believes exist,
- which important flows have tests,
- which areas remain unexplored,
- which assumptions are uncertain,
- what changed since the previous run.

The coding agent should determine the right representation.

Avoid solving this with a huge LLM context.

The goal is structured durable knowledge so inexpensive models can work on **small local problems while the system retains the big picture**.

---

# 6. Exploration Must Become Incremental

A critical economic requirement is:

> **Do not rediscover the entire application every time.**

Exploration is expensive because it consumes browser actions, time, and model tokens.

The system should ideally perform a broad discovery phase once, persist what it learned, and then focus future exploration on:

- newly added product areas,
- changed flows,
- broken tests,
- uncertain parts of the application,
- previously unexplored states,
- behavior affected by a code change or PR.

The desired progression is:

```text
first run
   ↓
broad exploration
   ↓
persistent application understanding
   ↓
tests generated
   ↓
future PR
   ↓
identify likely impacted areas
   ↓
targeted exploration only
   ↓
new / repaired tests
```

The exact method for change detection is intentionally unspecified.

Possible signals could come from repository changes, runtime behavior, existing tests, route changes, component changes, product documentation, or other sources.

The coding agent should research and choose the simplest useful approach.

---

# 7. Discovery vs Replay

There are two fundamentally different operating modes.

## Discovery mode

AI is allowed.

Magpi may:

- inspect product source,
- inspect documentation,
- inspect routes and UI,
- reason about product intent,
- navigate,
- try alternatives,
- recover from mistakes,
- determine useful assertions,
- decide what deserves testing.

## Replay mode

AI should ideally be absent.

Generated tests should execute through normal deterministic tooling.

For the first version, Playwright is the preferred target because:

- Magpi already uses Playwright,
- the ecosystem is mature,
- CI support is excellent,
- tracing/debugging is excellent,
- the generated artifacts remain understandable to developers.

The product must therefore cross this boundary:

```text
agentic exploration
       │
       ▼
successful understood workflow
       │
       ▼
deterministic test artifact
       │
       ▼
ordinary CI replay
```

How that translation happens is one of the main research and engineering questions.

---

# 8. The Hard Part Is Not Merely Recording Clicks

Playwright already has code generation.

Simply recording:

```text
click
fill
click
navigate
```

is not enough.

The testing intelligence is in understanding:

- why the agent performed an action,
- what outcome matters,
- which observations should become assertions,
- which parts are incidental,
- what state is required before the test,
- what constitutes success,
- what is a product bug vs stale test automation.

For example, after creating a wallet, useful success evidence might include some combination of:

- navigation to the wallet screen,
- a wallet address appearing,
- expected UI status,
- a successful backend response,
- expected chain state.

The product should seek to capture **semantic intent**, not just a raw input-event recording.

---

# 9. Generated Tests Must Prove Themselves

A generated test should not be considered complete merely because an LLM produced code.

A core product principle should be:

> **Generated tests must successfully execute from a sufficiently clean state before being accepted.**

The coding agent should investigate an iterative generation / execution / repair model.

The exact implementation is open.

The important separation is:

- AI may be used while authoring or repairing a test.
- The accepted final test should run without AI.

---

# 10. External Test Environment Capabilities

Real end-to-end applications frequently contain things that are not purely browser interactions:

- email OTP,
- passkeys,
- WebAuthn,
- wallet funding,
- blockchain state,
- database fixtures,
- background workers,
- API setup,
- test accounts,
- payment simulators,
- queues,
- third-party sandboxes.

The testing system should have a clean concept for using environment-specific capabilities without teaching Magpi to manually reinvent them through the UI every time.

Do not over-design this initially.

The coding agent should research how successful testing systems expose setup/fixture capabilities to generated tests.

The core principle is:

> **Application-specific environment setup is allowed; application-specific test logic should still be discovered by the testing agent where practical.**

---

# 11. Dogfood Project: Onchain Invoice / Trustless Commerce

Use the existing project as the first serious benchmark:

- repository: `naiemk/onchain-invoice`

This is an unusually useful dogfood target because it is not a trivial CRUD demo.

It includes:

- React/Vite UI,
- payments,
- wallet workflows,
- blockchain state,
- passkeys/WebAuthn,
- multiple devices,
- account recovery,
- asynchronous backend workers,
- local infrastructure,
- existing Playwright E2E tests.

The repository already includes a deterministic local test environment and extensive hand-written Playwright tests.

That gives us a valuable evaluation strategy.

## Hidden-answer benchmark

Do not use the existing E2E scenario files as instructions to Magpi during discovery.

Instead:

1. allow Magpi to inspect the application source and appropriate product documentation,
2. run the application,
3. let Magpi independently discover meaningful user flows,
4. generate deterministic tests,
5. run those generated tests,
6. compare the resulting coverage and behavior against the existing hand-written suite.

The existing suite becomes an **answer key**, not a source of copied test behavior.

However, infrastructure helpers are different.

It is reasonable to reuse things such as:

- local stack startup,
- WebAuthn test support,
- dev OTP mechanisms,
- test funding,
- deterministic worker triggers.

The benchmark should measure:

> "Can Magpi discover and express the application's behavior?"

not:

> "Can Magpi reverse-engineer every piece of test infrastructure from scratch?"

---

# 12. Passkeys / WebAuthn Are an Important Stress Case

Onchain Invoice makes heavy use of passkeys and wallet operations.

The repository already contains WebAuthn test infrastructure.

Investigate whether the testing product can consume application-provided fixtures or newer native Playwright capabilities rather than creating a one-off hack.

The long-term product should be able to accommodate applications with unusual authentication without baking application-specific behavior into Magpi itself.

Passkeys are therefore a useful design test for the extension boundary.

---

# 13. Models and Cost

Magpi Test should be designed around **cheap models wherever possible**.

Do not assume a frontier model is continuously available.

The system should reduce model dependence structurally by:

- persisting application knowledge,
- avoiding repeated exploration,
- reducing page/context size,
- using deterministic replay,
- using existing successful tests as executable knowledge,
- working on local subproblems rather than resending the entire application model.

A stronger model may eventually be useful as an optional escalation path when cheaper models repeatedly fail, but this should not be a foundational requirement.

The coding agent should evaluate model routing only after understanding the problem.

---

# 14. Competitive / Prior-Art Research

Before implementing large subsystems, inspect how current products solve adjacent pieces.

Do not blindly clone another architecture.

The goal is to avoid re-solving proven infrastructure while preserving Magpi's differentiation.

## Playwright

https://playwright.dev/

Particularly investigate:

- test generator / codegen,
- locator generation,
- traces,
- assertions,
- fixtures,
- browser state,
- WebAuthn support,
- test retries,
- CI integration.

Playwright already knows how to generate resilient locators from user interaction. Reuse its primitives wherever possible rather than building locator machinery unnecessarily.

Reference:

https://playwright.dev/docs/codegen

---

## Stagehand / Browserbase

Repository:

https://github.com/browserbase/stagehand

Relevant ideas:

- combining AI actions with deterministic browser operations,
- `act`,
- `observe`,
- `extract`,
- using AI for uncertain browser understanding while retaining deterministic locators/actions.

The useful lesson is the **AI → deterministic action boundary**.

Do not replace Magpi's browser intelligence with Stagehand unless research establishes a compelling reason. Magpi is the core exploration engine.

---

## TestZeus Hercules

Repository:

https://github.com/test-zeus-ai/testzeus-hercules

Hercules is an open-source testing agent built around Playwright.

Areas worth studying:

- planner vs navigation roles,
- test scenario representation,
- reports and evidence,
- screenshots/video/traces,
- custom test tools,
- environment integration,
- model routing by role,
- atomic test design.

Important licensing note:

Hercules is AGPL-3.0.

Study and learn from its architecture, but do **not** directly incorporate AGPL code into a differently licensed commercial product without an explicit licensing decision.

---

## BrowserStack Test Companion

Product documentation:

https://www.browserstack.com/docs/test-companion

Relevant capabilities to study:

- deriving test cases from requirements,
- exploring live applications,
- writing tests into existing frameworks,
- debugging failed tests,
- reacting to code diffs,
- IDE integration.

BrowserStack demonstrates that repo-aware AI-assisted QA is moving into mainstream testing platforms.

Do not attempt to compete with BrowserStack on browser/device infrastructure.

---

## QA Wolf

https://www.qawolf.com/

Relevant ideas:

- managed QA outcome rather than merely a testing tool,
- Playwright-based automation,
- automated generation/maintenance plus human QA operations,
- failure triage.

Their service-heavy model is different from the desired Magpi wedge but validates the value of automatically maintained E2E coverage.

---

## Momentic

https://momentic.ai/

Investigate:

- AI-native test authoring,
- local and staging application testing,
- test maintenance,
- CI workflow,
- developer experience.

Momentic is a useful reference for the product UX of modern AI testing.

---

## Meticulous

https://www.meticulous.ai/

Investigate the philosophy of:

- learning application behavior from real interaction,
- automatically deriving regression coverage,
- minimizing manual test creation.

The architecture and product philosophy may be useful even if Magpi's approach differs technically.

---

## TestSprite

https://www.testsprite.com/

Relevant ideas:

- repo / code understanding,
- requirement understanding,
- autonomous test planning,
- E2E generation,
- MCP / coding-agent integration,
- feeding failures back into coding agents.

Its positioning around AI-generated software is particularly relevant.

---

# 15. What We Want to Reuse

The project should aggressively reuse proven components where they fit.

Good candidates to investigate include:

- Playwright runner and assertions,
- Playwright locators and code-generation internals,
- Playwright trace/debug infrastructure,
- existing Magpi perception/action/state machinery,
- existing Magpi task graph,
- existing Magpi evidence and verification layers,
- existing application test fixtures,
- standard CI integrations.

Avoid building:

- another browser automation framework,
- another full browser agent,
- another generic test runner,
- another browser grid,
- unnecessary custom locator logic,
- large infrastructure before the core experiment works.

---

# 16. What Is Likely New Product Work

Research should determine the exact architecture, but the genuinely new intellectual/product layer is likely around these problems:

### Application understanding

A persistent view of what the application can do.

### Coverage awareness

Knowing what important behavior has and has not been tested.

### Exploration scheduling

Choosing what part of the product deserves agentic exploration next.

### Semantic trajectory capture

Preserving enough meaning from a successful Magpi run to create a robust test.

### Deterministic test synthesis

Turning successful agentic behavior into a standalone executable test.

### Assertion discovery

Deciding which outcomes actually prove that the user workflow succeeded.

### Incremental maintenance

Using existing application knowledge, code changes, failures, and prior tests to avoid full rediscovery.

These are the areas where original work is most likely valuable.

---

# 17. Initial Product Boundary

Do not begin by building a SaaS platform.

Do not begin with:

- billing,
- dashboards,
- organizations,
- enterprise SSO,
- multi-tenant orchestration,
- elaborate analytics,
- browser farms,
- massive cloud infrastructure.

The first product question is much simpler:

> Can Magpi inspect a real software project, explore it intelligently, discover a meaningful workflow, produce a deterministic Playwright test for that workflow, and replay that test successfully without AI?

Then:

> Can it progressively discover enough of the application to become useful as an autonomous QA engineer without repeatedly exploring everything from scratch?

Everything else follows from proving these two loops.

---

# 18. Suggested Evaluation Progression

The exact tests may change after repo inspection, but a useful difficulty progression on Onchain Invoice is:

### Level 1 — Simple UI flow

Discover and test a straightforward deterministic user flow.

Goal: validate exploration → test generation → zero-AI replay.

### Level 2 — Invoice creation

Discover the create-payment/invoice flow.

Goal: forms, navigation, API side effects, useful assertions.

### Level 3 — Wallet creation

Include email verification and WebAuthn/passkey test infrastructure.

Goal: prove the environment-extension model works.

### Level 4 — Payment settlement

Include browser activity plus blockchain/background state.

Goal: prove tests can combine UI behavior with deterministic external fixtures.

### Level 5 — Open-ended application QA

Instruction becomes closer to:

> "Understand this application and test its important functionality."

Goal: evaluate application mapping, prioritization, coverage reasoning, and incremental discovery.

---

# 19. Evaluation Metrics

Do not measure success only as "the agent finished."

Useful metrics include:

- percentage of generated tests that pass from clean state,
- percentage that pass repeatedly,
- flakiness,
- useful flows discovered,
- overlap with human-written benchmark coverage,
- unique bugs found,
- amount of human correction required,
- model tokens spent per accepted test,
- browser actions spent per accepted test,
- repeated exploration avoided,
- time to update tests after a product change,
- false failures caused by brittle generated selectors/assertions.

The existing Magpi philosophy of external evaluation rather than letting the model grade itself should be retained.

---

# 20. Questions the Coding Agent Should Answer

The coding agent should investigate and make evidence-based decisions around questions such as:

1. What is the smallest clean extension boundary between Magpi and Magpi Test?
2. Which existing Magpi components can be reused unchanged?
3. What minimal persistent representation of application knowledge is actually required?
4. Can existing Magpi goal/task state be generalized, or should application knowledge live separately?
5. How should a successful browser trajectory be represented before generating Playwright?
6. Can Playwright's own codegen/locator internals be reused directly?
7. How should semantic assertions be inferred?
8. How should a generated test validate itself before acceptance?
9. How should test environment fixtures be exposed without coupling Magpi to one application?
10. How should repository information influence discovery without simply copying existing tests?
11. What is the cheapest model capable of each role?
12. When, if ever, is a stronger model needed?
13. How should a later PR trigger only relevant exploration?
14. What ideas/code from open-source projects are reusable under compatible licenses?
15. What should remain outside the MVP?

Do not assume the answers from this document.

Research them.

---

# 21. Architectural Constraints

The eventual design should preserve these principles:

- **Magpi remains a general browser agent.**
- **Magpi Test is layered on top.**
- **Exploration can be AI-driven.**
- **Accepted tests run without AI.**
- **Application knowledge persists outside transient model context.**
- **Repeated exploration should be minimized.**
- **Cheap models should be viable.**
- **Deterministic infrastructure should be reused rather than reimplemented.**
- **Existing Magpi abstractions should be preferred over parallel systems.**
- **The system should be measurable against external criteria.**
- **Application-specific test fixtures should not pollute the generic Magpi browser engine.**

---

# 22. Definition of an Initial Success

A convincing first milestone is not a polished product.

It is a demonstration where:

1. Magpi Test receives the Onchain Invoice project.
2. It understands enough of the project to choose a meaningful workflow.
3. Magpi explores that workflow.
4. It records the necessary semantic evidence.
5. It produces an ordinary Playwright test.
6. That test runs from a clean enough environment.
7. The test passes repeatedly with no LLM and no Magpi execution.
8. The discovered workflow was not copied from the hidden human E2E implementation.
9. The system persists what it learned.
10. A second run avoids unnecessary rediscovery.

If that works, proceed to increasingly difficult workflows and open-ended autonomous coverage.

---

# 23. Final Instruction to the Coding Agent

Treat this as a **research-and-prototype problem**, not a feature checklist.

Start by reading:

- the current Magpi architecture and relevant implementation,
- the Onchain Invoice E2E infrastructure,
- Playwright internals/docs,
- Stagehand,
- Hercules,
- and representative commercial AI-testing products.

Then produce your own technical design.

Prefer the smallest architecture that proves the product thesis.

Do not implement large speculative infrastructure before testing the central loop:

> **Explore intelligently once → understand what matters → emit deterministic tests → replay cheaply forever.**
