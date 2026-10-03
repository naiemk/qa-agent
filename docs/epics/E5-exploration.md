# E5 Coached exploration

**Outcome.** For each critical path, Magpi Test runs coached Magpi passes through several
lenses (depths and points of view), harvests the flows they found into scenarios with
fixed criteria, and sends those through the shared pipeline.

**Milestone.** M1, day 2. Spec:
[specs/discovery-and-exploration.md](../specs/discovery-and-exploration.md).

Why this matters: one agent wandering once finds the obvious happy path and stops.
Magpi's planner and coach exist to stop wandering: scout, write a strategy from evidence,
then execute it. Crossing that with lenses (happy, invalid input, empty or error,
alternate entry, deep) is how we get edge cases and multiple viewpoints without writing
a new planner.

---

### MT-5.1 Lenses and pass planner
- [ ] done

**Outcome.** `planPasses(appMap, options)` returns an ordered, budgeted list of passes,
each with a Magpi plan file.

**Depends on.** MT-3.3.
**Touches.** `src/explore/lenses.ts`, `src/explore/planner.ts`,
`tests/unit/explore-planner.test.ts`.

**Done when.**
- Lenses are exactly the five in
  [specs/scenario-and-trajectory.md](../specs/scenario-and-trajectory.md), each with
  its instruction text.
- Passes: critical paths in priority order × their lenses, skipping `needsFixture`,
  capped by `--max-passes`; `--paths` and `--lenses` filter.
- Plan file content matches the template in the spec; contains no click/type steps
  (test).
- Deterministic for the same app map (snapshot test).

**Questions.**

---

### MT-5.2 Coached pass runner
- [ ] done

**Outcome.** `magpi-test explore` runs each planned pass through `runCoachedPass` and
records the result.

**Depends on.** MT-5.1, MT-2.3, MT-1.3.
**Touches.** `src/explore/runner.ts`, `src/cli/explore.ts`, `tests/unit/explore-runner.test.ts`.

**Done when.**
- Starts the stack once, runs passes sequentially (one browser at a time in M1),
  records `state/runs/<passId>.json`, stops the stack.
- Resumable: passes with a finished run record are skipped unless `--force`.
- A failing pass (Magpi error, budget hit) is recorded and does not stop the batch.
- Prints a per-pass line: lens, path, coachedBy, flows found.

**Questions.**

---

### MT-5.3 Pass harvest
- [ ] done

**Outcome.** `harvestPass(goalDir, pass, model)` turns what a pass found into candidate
scenarios with fixed criteria, which then go through `runScenario`.

**Depends on.** MT-5.2, MT-4.2, MT-4.3 (`runScenario`).
**Touches.** `src/explore/harvest.ts`, `src/explore/prompts.ts`,
`tests/unit/harvest.test.ts`.

**Done when.**
- Reads remember notes and `strategyArtifact` from `goal.json`, ledger `intent`s, and
  final page text from the last observation payload; asks the model for candidate
  scenarios (title, steps, expected, lens) as JSON.
- Criteria compiled through MT-4.2 (same trivial-truth check).
- Deduplicates by `(area, lens, normalized steps)` against existing scenarios.
- Caps at 5 candidates per pass.
- Candidates are run through `runScenario` (bounded run with fixed criteria). The
  pass's own trajectory is never emitted as a spec directly (test).
- Fixture test with a captured coached goal directory and the fake model.

**Questions.**
