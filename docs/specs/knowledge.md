# Application knowledge

Status: **undiscovered** (M2). Brief sections 5 and 6.

## Intent

The system should know, across runs: what it has explored, what product areas exist,
which important flows have accepted tests, what is unexplored, which assumptions are
uncertain, and what changed since last time. Structured, durable, small enough that a
cheap model only ever sees the local slice it needs.

## What M1 already leaves behind

`magpi-tests/state/`: `app-map.json`, scenarios, trajectories, run records, accepted
specs, quarantine. M2 starts by asking what is missing from these to skip rediscovery.

## Decided constraints

- Not a giant model context.
- Accepted specs count as executable knowledge: if a spec for a flow passes, that flow
  does not need re-exploration.

## Open questions

- Is Magpi's `PlanStore` task graph (persistent tasks, dependencies, discovered
  children, blocked work) the right home for this, or should it stay in our own files?
- How is "uncertain" represented and resolved?
- How is "what changed" detected cheaply (route list diff, live survey diff, code diff)?
