# E4 Guided authoring

**Outcome.** A human writes what to test and the steps in a short markdown file; Magpi
Test turns it into an accepted Playwright spec.

**Milestone.** M1, day 1 afternoon (this is the day-1 gate). Spec:
[specs/scenario-and-trajectory.md](../specs/scenario-and-trajectory.md).

---

### MT-4.1 Scenario format and parser
- [ ] done

**Outcome.** `parseScenarioMarkdown(text, id)` and `validateScenario(s)` turn a human
scenario file into a `Scenario`.

**Depends on.** MT-1.1.
**Touches.** `src/scenario/types.ts`, `src/scenario/markdown.ts`,
`src/scenario/validate.ts`, `src/state/scenarios.ts`, `tests/unit/scenario.test.ts`.

**Done when.**
- Parses the example file in the spec into the expected JSON (fixture test).
- Unknown headings and unknown front-matter keys are errors.
- `## Criteria` lines accept `kind: text` and JSON, validated against the Predicate
  vocabulary; `ref_exists` rejected.
- Scenarios round-trip through `state/scenarios/<id>.json`.

**Notes for the implementer.**
- Hand-written parser over lines; no markdown library.
- Copy the Predicate type from Magpi's `src/core/types.ts` into `src/scenario/types.ts`
  (it is not exported) and add a test that fails if the kinds diverge from
  the list in [specs/magpi-integration.md](../specs/magpi-integration.md).

**Questions.**

---

### MT-4.2 Criteria compiler
- [ ] done

**Outcome.** `compileCriteria(scenario, stack, model)` fills `criteria` from
`expected` when a human did not write them, and proves they are not trivially true.

**Depends on.** MT-4.1, MT-1.4, MT-1.3.
**Touches.** `src/scenario/criteria.ts`, `src/scenario/prompts.ts`,
`tests/unit/criteria.test.ts`.

**Done when.**
- Model input: title, steps, expected, start path, and the start page's visible
  headings and control names (not the full DOM). Output: `Predicate[]`, validated.
- Dynamic values rule from [specs/test-synthesis.md](../specs/test-synthesis.md) is in
  the prompt and enforced by a check (reject hex addresses, UUIDs, long digit runs in
  `text`).
- Trivial-truth check: open `baseURL + startPath` in a fresh context, evaluate the
  criteria with plain Playwright (same mapping as the emitter); if every predicate
  passes on the start page, reject and ask the model once more; then mark the scenario
  `skipped` with the reason.
- Sets `criteriaStatus: "compiled"`. Human-written criteria are never changed.
- Tests with the fake model and a fixture page.

**Notes for the implementer.**
- Reuse the emitter's predicate → Playwright mapping (MT-6.1) through a shared function
  so exploration-time checks and replay-time assertions cannot drift.

**Questions.**

---

### MT-4.3 `magpi-test guided`
- [ ] done

**Outcome.** `magpi-test guided --target <dir> [files...]` runs the whole guided path:
parse → compile criteria → bounded Magpi run → trajectory → emit → accept (→ repair).

**Depends on.** MT-4.2, MT-2.2, MT-2.4, MT-6.3, MT-7.1 (for the real target).
**Touches.** `src/cli/guided.ts`, `src/pipeline.ts`, `tests/e2e/guided.test.ts`.

**Done when.**
- With no files given, processes every `magpi-tests/scenarios/*.md`.
- Skips scenarios already `accepted` or `quarantined` unless `--force`.
- `--require-approval` stops after compiling criteria and prints them.
- Prints one line per scenario: id, status, spec path or quarantine reason.
- `src/pipeline.ts` exposes `runScenario(scenario, ctx)` used by both guided and
  explore (QD3).
- E2E test against a fixture target with a stubbed Magpi process that writes a fixture
  goal directory, and real Playwright acceptance against the fixture app: one scenario
  ends `accepted`, its spec exists in `specs/`.
- Day-1 gate: one real scenario on onchain-invoice becomes an accepted spec (record the
  command and result in the PR description).

**Notes for the implementer.**
- Exploration stack must be stopped before acceptance (QD6). The pipeline owns that
  ordering: run all Magpi runs for a batch, stop the stack, then accept the batch.

**Questions.**
