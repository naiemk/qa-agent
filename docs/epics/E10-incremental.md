# E10 Incremental maintenance (M4, sketch)

**Outcome.** From a code change or PR, Magpi Test finds likely impacted areas, explores
only those, and repairs or adds specs.

Spec: [specs/incremental.md](../specs/incremental.md) (undiscovered).

Candidate stories:

- Map changed files to app-map areas (routes, components, docs).
- Triage failing accepted specs: product bug vs stale test.
- Targeted exploration for impacted areas only.
- CI entry point (`magpi-test pr --base <ref>`).
