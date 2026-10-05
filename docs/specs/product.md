# Product

Status: **decided**. Source: [../product-brief.md](../product-brief.md) sections 1-3, 17, 21.

## Thesis

Not "an AI that clicks around a browser". An **autonomous QA engineer that learns your
product and leaves behind deterministic tests.**

Explore intelligently once → understand what matters → emit deterministic tests →
replay cheaply forever.

## Who uses it in M1

A developer on the project (today: us, on onchain-invoice) who wants E2E coverage
without writing it by hand, and who may write a few plain-language scenarios for the
flows they care about most.

## What it does

1. Drops onto a codebase and reads it (routes, docs, existing test helpers; never the
   hidden answer key).
2. Starts the app with the project's own scripts.
3. Discovers the UI and the critical paths.
4. Writes tests two ways: from human scenarios, and from coached exploration across
   several viewpoints.
5. Keeps only tests that replay green, repeatedly, with no AI.

## What it is not

- Not a new browser agent. Magpi is the browser agent.
- Not a test runner, browser grid, or locator engine. Playwright is.
- Not an environment builder. The project supplies startup and fixtures.
- Not a SaaS in M1. No dashboards, billing, orgs, SSO.
- Not a recorder. Raw clicks are not the product; intent, required state, and the
  outcome that proves success are.

## Principles (brief section 21)

- Magpi remains a general browser agent; Magpi Test is layered on top.
- Exploration can be AI-driven. Accepted tests run without AI.
- Application knowledge persists outside model context.
- Repeated exploration is minimized.
- Cheap models are viable by design.
- Reuse deterministic infrastructure instead of reimplementing it.
- Prefer existing Magpi abstractions over parallel systems.
- Measured against external criteria, never self-graded.
- Application-specific fixtures do not pollute Magpi.
