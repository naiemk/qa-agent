# Open questions

The questions from brief section 20. Each has an owner (epic or story) and the current
answer, if any. Update the answer column when a story settles one, and link the decision.

| # | Question | Owner | Current answer |
| --- | --- | --- | --- |
| 1 | Smallest clean extension boundary between Magpi and Magpi Test? | E2, MT-0.2 | Proposed: CLI + goal directory, as a Magpi "parent" (QD2). One small upstream change (MT-2.1). |
| 2 | Which Magpi components are reused unchanged? | E2 | Proposed: the whole run loop, perception, verified actions, predicates, ledger, planner, coach, through runs. `surveyAffordances` decided in MT-3.2. |
| 3 | Minimal persistent representation of app knowledge? | E8 | M1: `app-map.json` + scenarios + trajectories + specs. M2 decides the rest. |
| 4 | Generalize Magpi goal/task state, or keep app knowledge separate? | E8 | Separate in M1. Revisit `PlanStore` in M2. |
| 5 | How to represent a successful trajectory before generating Playwright? | E6 | Proposed: Trajectory JSON (QD4, [scenario-and-trajectory.md](scenario-and-trajectory.md)). |
| 6 | Reuse Playwright codegen / locator internals directly? | MT-0.1 | Unknown. Role/label/placeholder/text/testId targets for now (QD5). |
| 7 | How to infer semantic assertions? | E4, E5 | M1: criteria from human "Expected" or from what an explore pass recorded as proof, compiled to predicates before the run. |
| 8 | How does a generated test validate itself before acceptance? | E6 | 3/3 fresh-stack replays (QD6). |
| 9 | How to expose fixtures without coupling Magpi to one app? | E9 | M3. M1 skips fixture flows. |
| 10 | How should repository info influence discovery without copying tests? | E3 | Static scan of routes and docs; answer key enforced in code (QD9). |
| 11 | Cheapest model per role? | E12 | Not in M1. Record tokens per accepted spec to inform it. |
| 12 | When is a stronger model needed? | E12 | M1: only Magpi's coach (its own pin) and the fallback coach. |
| 13 | How does a PR trigger only relevant exploration? | E10 | M4. |
| 14 | What open-source ideas/code are reusable under compatible licenses? | MT-0.1 | Hercules is AGPL: ideas only (QD10). Rest pending. |
| 15 | What stays outside the MVP? | roadmap | See roadmap "M1" and "Not on the roadmap". |
