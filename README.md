# qa-agent (Magpi Test)

An autonomous QA engineer built on [Magpi](https://github.com/naiemk/browser-session-agent).
Point it at a project. It reads the codebase, starts the app with the project's own
scripts, finds the UI and the critical paths, explores them like a QA engineer, and
leaves behind ordinary Playwright tests.

AI is used to discover and author tests. AI is not needed to run them: accepted tests
replay with `npx playwright test`, no Magpi process, no model, no tokens.

Magpi stays a general browser agent. This repo is the testing layer on top of it.

## Status

Pre-code. The first milestone (M1) is a two-day MVP, dogfooded on
[onchain-invoice](https://github.com/naiemk/onchain-invoice).

## Where to start

| You want | Read |
| --- | --- |
| What we are building and why | [docs/product-brief.md](docs/product-brief.md) |
| What happens next, in order | [docs/roadmap.md](docs/roadmap.md) |
| The work items | [docs/epics/](docs/epics/README.md) |
| How it works (as far as we know) | [docs/specs/](docs/specs/README.md) |
| You are a coding agent implementing a story | [AGENTS.md](AGENTS.md), then [docs/guides/implementer-guide.md](docs/guides/implementer-guide.md) |
