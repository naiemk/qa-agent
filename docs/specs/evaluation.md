# Evaluation

Status: **undiscovered** for M5; a subset is used in M1. Brief sections 11, 18, 19.

## M1 measures (in the M1 report)

- Accepted, quarantined, skipped specs, by source (guided / explore) and lens.
- Pass rate of accepted specs over 3 fresh-stack repeats (should be 100% by definition;
  re-run once at the end of M1 to check stability).
- Tokens and browser actions per accepted spec (sum Magpi `tokens` and actions from the
  run records, plus Magpi Test's own model calls).
- Explore passes that were coached vs not, and why.

## Later measures (M5)

- Overlap with the hidden human suite (onchain-invoice `ui/e2e/*.spec.ts`), computed by
  evaluation code, not by the discovering agent.
- Flakiness over many runs; false failures from brittle locators or assertions.
- Unique bugs found; human corrections needed; time to update after a change;
  rediscovery avoided.

## Decided constraints

- External evaluation only; the model never grades itself.
- The answer key is read only by evaluation code, after discovery is finished, and its
  contents never reach a discovery prompt.

## Open questions

- How to define "overlap" between a generated spec and a human spec (same route and
  outcome? same assertions? human judgement?).
