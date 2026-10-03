# Incremental maintenance

Status: **undiscovered** (M4). Brief section 6.

## Intent

Do not rediscover the whole app every time. After a change or a PR, explore only what is
new, changed, broken, or uncertain, and add or repair specs there.

## Decided constraints

- Repair edits Trajectory JSON, never spec source (QD4), same as M1.
- A failing accepted spec is triaged as product bug vs stale test before repair.

## Open questions

- Which change signals are cheapest and good enough: changed files mapped to routes,
  live survey diff, failing specs, docs changes?
- How does a diff map to app-map areas?
- When is a broken spec repaired vs reported as a bug?
