# AGENTS.md

You are probably a coding model implementing one story from `docs/epics/`. This file is
the short version of the rules. The long version, with the reasoning, is
[docs/guides/implementer-guide.md](docs/guides/implementer-guide.md). Read both before
writing code.

## Read in this order

1. The story you were given (in `docs/epics/E*.md`). Its "Done when" list is the contract.
2. [docs/roadmap.md](docs/roadmap.md) to see what is in scope right now.
3. [docs/specs/architecture.md](docs/specs/architecture.md) for the M1 pipeline.
4. [docs/specs/magpi-integration.md](docs/specs/magpi-integration.md) before touching anything that
   calls Magpi. It lists verified file paths and the traps.
5. Any spec the story links.
6. [docs/decisions.md](docs/decisions.md) for decisions already made.

## Invariants (never break these)

1. **Accepted tests run without AI.** A generated spec imports only `@playwright/test`,
   Node builtins, and fixture modules the target manifest allows. Never Magpi, never a
   model SDK, never this repo.
2. **A test is accepted only after it passes from a fresh stack, repeatedly**
   (`--repeat-each=3 --retries=0`). An LLM saying it is fine counts for nothing.
3. **Magpi stays generic.** No Magpi Test or onchain-invoice logic in Magpi. An upstream
   Magpi change is allowed only if it is small, useful to any Magpi user, and has its
   own Magpi tests. Today exactly one is planned (story MT-2.1).
4. **The hidden answer key stays hidden.** Never read, grep, embed, or prompt with files
   matched by the target manifest's `answerKey` globs (for onchain-invoice:
   `ui/e2e/*.spec.ts`, `system-tests/tests/**`). Helpers under `ui/e2e/helpers/` and
   `ui/e2e/stack/` are allowed.
5. **The model never grades itself.** Success criteria come from the scenario or the
   human, are fixed before the run, and are checked in code (Magpi predicates during
   exploration, Playwright `expect` on replay).
6. **The LLM edits data, not code.** Models produce or repair Scenario and Trajectory JSON.
   Playwright source is emitted by deterministic template code from that JSON.
7. **Tests never call a real model or require a provider key.** Use the fake model
   client. Live runs are separate scripts.

## Stop and ask instead of guessing when

- the story needs a Magpi API that `magpi-integration.md` does not list;
- a spec says `undiscovered` for something your story needs;
- a "Done when" check cannot be made to pass without breaking an invariant;
- you would need to read an answer-key file to proceed.

Write the question at the bottom of the story under `Questions` and stop. Do not invent
architecture to get unblocked.

## Conventions

Match Magpi so code can move between the repos: Node 24+, TypeScript, ESM
(`"type": "module"`), run with `tsx`, tests with `node:test` via `tsx --test`, files in
`src/<module>/` and `tests/{unit,integration,e2e}/`. Small modules, named exports, no
classes unless there is state to hold. Comment only constraints the code cannot show.

## Definition of done for any story

- Every "Done when" item is true and checked by a named test or a command you ran.
- `npm run precommit` passes (once MT-1.1 lands).
- The story's checkbox in its epic and the roadmap are ticked; partial outcomes get a
  dated note instead.
- New facts learned about Magpi, Playwright, or the target go into the relevant spec.
  New decisions go into `docs/decisions.md`.
