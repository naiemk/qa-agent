# Incremental maintenance

Status: **undiscovered** (M4). Brief section 6.

## Intent

Do not rediscover the whole app every time. After a change or a PR, explore only what is
new, changed, broken, or uncertain, and add or repair specs there.

## Decided constraints

- Repair edits Trajectory JSON, never spec source (QD4), same as M1.
- A failing accepted spec is triaged as product bug vs stale test before repair.

## M1 groundwork (QD17, MT-10.1)

- App-map areas and critical paths carry `sourceFiles`; accepted specs record the
  critical path they cover.
- `magpi-test impact --base <ref>` (report only, no model): `git diff --name-only
  <ref>...HEAD` → areas and paths whose `sourceFiles` match → accepted specs to re-run
  and areas to re-explore. Changed files that match nothing are listed as `unmapped`.

## Open questions

- Which change signals are cheapest and good enough: changed files mapped to routes,
  live survey diff, failing specs, docs changes?
- How does a diff map to app-map areas?
- When is a broken spec repaired vs reported as a bug?
