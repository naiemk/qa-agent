# E6 Synthesis and acceptance

**Outcome.** A Trajectory becomes a plain Playwright spec through deterministic code, and
the spec is kept only if it passes 3 times from a fresh stack with no AI.

**Milestone.** M1, day 1 afternoon (MT-6.1 to 6.3, 6.5) and day 2 (MT-6.4). Spec:
[specs/test-synthesis.md](../specs/test-synthesis.md).

---

### MT-6.1 Playwright emitter
- [ ] done

**Outcome.** `emitSpec(trajectory)` returns spec source exactly as described in the spec.

**Depends on.** MT-1.1.
**Touches.** `src/synth/types.ts`, `src/synth/emit.ts`, `src/synth/assertions.ts`,
`tests/unit/emit.test.ts`, `tests/fixtures/trajectories/`.

**Done when.**
- Pure, deterministic; snapshot tests for: every Target kind, every supported Predicate
  kind, `env` and `unique` values, `waitFor`, special characters in names (quotes,
  backslashes, unicode).
- `any` / `not` predicates throw `UnsupportedAssertion`.
- `src/synth/assertions.ts` exports the predicate → Playwright mapping as a function
  that can both emit code and evaluate against a live `page` (used by MT-4.2), with a
  test that both paths agree on a fixture page.
- Emitted code compiles: a test writes the snapshots to a temp dir and runs `tsc` or
  `playwright test --list` on them.

**Questions.**

---

### MT-6.2 Generated Playwright config
- [ ] done

**Outcome.** `magpi-tests/playwright.config.ts` extends the target's config, points at
`specs/`, pins locale, and fixes `webServer.cwd`.

**Depends on.** MT-6.1, MT-1.2.
**Touches.** `src/synth/config.ts`, `tests/integration/config.test.ts`.

**Done when.**
- Output matches the template in the spec; handles `webServer` as object, array, or
  absent; standalone config when the target has no Playwright config.
- Checks whether the target config is loaded as CJS or ESM and emits `__dirname` or
  `import.meta.url` accordingly (test both with fixtures).
- `npx playwright test --config magpi-tests/playwright.config.ts --list` succeeds on
  the fixture target.

**Questions.**

---

### MT-6.3 Acceptance runner
- [ ] done

**Outcome.** `accept(pendingSpecs)` runs the acceptance command, parses results, and
moves specs to `specs/` or to quarantine.

**Depends on.** MT-6.2.
**Touches.** `src/accept/run.ts`, `src/accept/classify.ts`, `src/cli/accept.ts`,
`tests/integration/accept.test.ts`.

**Done when.**
- Runs the exact command in the spec (`CI=1`, `--repeat-each=3`, `--retries=0`,
  `--workers=1`, JSON reporter) from the target root.
- Refuses to start if the target's ports are busy, with a message naming the process
  to stop.
- Accepts only 3/3; classifies failures as `locator | assertion | timeout | environment
  | other` from reporter JSON (unit tests over captured reporter outputs).
- `environment` stops the batch.
- Integration test with a fixture app: one passing spec accepted, one with a wrong
  locator classified `locator`, one with a wrong assertion classified `assertion`.

**Questions.**

---

### MT-6.4 Repair loop
- [ ] done

**Outcome.** Locator and assertion failures get up to 2 model-proposed edits to the
Trajectory, then re-emit and re-accept; otherwise quarantine with a suspected cause.

**Depends on.** MT-6.3, MT-1.4, MT-0.1 (selector generator answer).
**Touches.** `src/accept/repair.ts`, `src/accept/aria.ts`, `src/accept/prompts.ts`,
`tests/unit/repair.test.ts`.

**Done when.**
- Model input is only what the spec lists (trajectory, failing step, error, trimmed
  ARIA snapshot). Output is a validated list of changes to `target`, `waitFor`, or
  `value` of specific steps.
- Any change to `assertions` is rejected in code (test).
- Each repair appends a `RepairNote`.
- After 2 failed repairs: quarantine with `suspected: "locator" | "criteria" |
  "product-bug"` and the last error.
- If MT-0.1 found a callable Playwright selector generator, the repair loop offers its
  suggestion to the model as a candidate target.

**Questions.**

---

### MT-6.5 No-AI guard
- [ ] done

**Outcome.** A check that fails if a generated spec could need Magpi, a model, or
network calls beyond the app under test.

**Depends on.** MT-6.1.
**Touches.** `src/synth/guard.ts`, `tests/unit/guard.test.ts`.

**Done when.**
- Implements the checks in the spec; runs before acceptance and over every emitted
  snapshot in `npm test`.
- Tests with violating fixtures (imports `@naiemk/magpi`, uses `fetch(`, reads
  `OPENROUTER_API_KEY`) all fail the guard.

**Questions.**
