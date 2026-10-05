# E2 Magpi bridge

**Outcome.** Magpi Test can start a bounded Magpi run and a coached Magpi session, and
read any finished goal back as a Trajectory with durable Playwright targets.

**Milestone.** M1. Read [specs/magpi-integration.md](../specs/magpi-integration.md)
before any story here.

---

### MT-2.1 Upstream Magpi: the ledger records what was acted on
- [ ] done

**Outcome.** In `browser-session-agent`, each `action` / `failure` ledger event carries
the target control's role, name, tag (and href / inputType when present) and the typed
or selected input, so any Magpi trace says what was clicked, not just `e12`.

**Depends on.** Nothing. This is a PR on `naiemk/browser-session-agent`, not this repo.
**Touches (Magpi repo).** `src/core/act.ts` (the `ledger.append` call),
`src/core/ledger.ts` (`LedgerEvent.action` type), a unit or integration test there.

**Done when.**
- `LedgerEvent.action` gains optional
  `target?: { role: string; name: string; tag: string; href?: string; inputType?: string }`
  and `input?: string`.
- `act()` fills `target` from the control it resolved for `request.ref`, and `input`
  from `request.text ?? request.value`. Password-type inputs store `input: "[redacted]"`.
- The existing ledger redaction still applies (check `redact.ts` covers the new fields).
- A Magpi test asserts a click and a type produce the new fields; Magpi's
  `npm run precommit` passes.
- PR description says why this is generic: readable traces and `replay` output for
  every Magpi user.
- After merge, this repo's `@naiemk/magpi` dependency points at a version (or commit)
  that includes it.

**Notes for the implementer.**
- In `act()` the resolved control is available before the action runs; find where
  `request.ref` is looked up in the observation's `controls`.
- Keep the change small. No other refactors in this PR.

**Questions.**

---

### MT-2.2 Bounded-run adapter
- [ ] done

**Outcome.** `runBounded(scenario, manifest)` runs one Magpi `browser-agent run` with
the scenario's fixed criteria and returns a run record.

**Depends on.** MT-0.2, MT-1.2.
**Touches.** `src/magpi/bounded.ts`, `src/magpi/process.ts`, `src/state/runs.ts`,
`tests/unit/magpi-bounded.test.ts`.

**Done when.**
- Builds argv exactly as in magpi-integration.md: goal text from
  `title + steps + expected`, `--url baseURL+startPath`, one `--criterion` per
  predicate as JSON, `--policy` from manifest, `--max-turns`, `--model`,
  `--root <target>/magpi-tests/state/magpi-home`, `--json`.
- Refuses to run a scenario with empty criteria or with `ref_exists` (test).
- Parses `--json` stdout into `{ goalId, status, turns, tokens, costUsd, checks }`;
  on non-JSON output stores stdout/stderr tails and marks the run `error`.
- Writes `state/runs/<runId>.json` with argv (no keys), timings, result.
- Unit tests stub the process spawner; no real Magpi run in tests.

**Notes for the implementer.**
- Invoke Magpi's bin through the installed package (`node_modules/.bin/browser-agent`),
  not a global install.
- Goal text template: keep it short and literal. Magpi's planner does better with a
  clear objective than with long prose.

**Questions.**

---

### MT-2.3 Coached-session adapter
- [ ] done

**Outcome.** `runCoachedPass(pass, manifest)` runs one Magpi coached session for an
exploration pass and reports whether it was coached.

**Depends on.** MT-0.2 (decides parent path vs fallback), MT-1.4 (fallback coach).
**Touches.** `src/magpi/coached.ts`, `src/magpi/fallback-coach.ts`,
`tests/unit/magpi-coached.test.ts`.

**Done when.**
- If MT-0.2 accepted the parent path: start with `magpie --json --name <passId>
  --plan-file <file> "<objective>"`, drive with `--session <id> -p`, poll status, stop
  on done, blocked, or budget. Record session id and goal id.
- Otherwise: implement the fallback (scout run → one coach model call producing
  `StrategyArtifact`-shaped JSON → execute runs) exactly as in
  [specs/discovery-and-exploration.md](../specs/discovery-and-exploration.md).
- The run record has `coachedBy: "magpi" | "magpi-test-fallback" | "none"` and, for
  `magpi`, whether `strategyArtifact` exists in `goal.json` or the classification was
  `known_flow`.
- Unit tests stub processes and the model.

**Notes for the implementer.**
- Plan files must not contain click/type steps (Magpi PARENT-05). A test asserts the
  generated plan file contains none of "click", "type into", "selector".

**Questions.**

---

### MT-2.4 Trajectory reader
- [ ] done

**Outcome.** `readTrajectory(goalDir, scenario, manifest)` turns a finished Magpi goal
into a Trajectory with durable targets.

**Depends on.** MT-2.1 (or uses the fallback), MT-0.2 fixture.
**Touches.** `src/magpi/goal-dir.ts`, `src/magpi/trajectory.ts`, `src/synth/types.ts`,
`tests/unit/trajectory.test.ts`, `tests/fixtures/goals/`.

**Done when.**
- Implements the 7 steps in
  [specs/scenario-and-trajectory.md](../specs/scenario-and-trajectory.md)
  "Building a Trajectory from a Magpi goal".
- Uses `action.target` when present (`locatorRecovery: "ledger-target"`), else the
  payload join (`"payload-join"`).
- Fixture tests: one goal directory with new-style ledger events, one from MT-0.2
  (old style, payload join), one with a `failure` event that must be dropped, one with
  an unsupported action kind that must fail with a clear error.
- The resulting Trajectory passes `validateTrajectory` and never contains a ref.

**Notes for the implementer.**
- `payloads.jsonl` records have `{ at, turn, tool, bytes, hash, text }`; the
  observation text lists controls with their refs, roles, and names. Look at the MT-0.2
  fixture to write the parser; do not guess the format.
- Paths: `navigate` URLs are absolute; strip the `baseURL` origin.

**Questions.**
