# E10 Incremental maintenance (M4, sketch)

**Outcome.** From a code change or PR, Magpi Test finds likely impacted areas, explores
only those, and repairs or adds specs.

Spec: [specs/incremental.md](../specs/incremental.md) (undiscovered).

Candidate stories (M4):

- Act on impact: re-run mapped specs and explore impacted areas (builds on MT-10.1).
- Triage failing accepted specs: product bug vs stale test.
- Targeted exploration for impacted areas only.
- CI entry point (`magpi-test pr --base <ref>`).

---

### MT-10.1 `magpi-test impact` (report only, M1 stretch)
- [x] done

**Outcome.** `magpi-test impact --base <ref>` says which accepted specs to re-run and
which areas to re-explore for a diff, with no model and no browser (QD17).

**Depends on.** MT-3.3, MT-6.3.
**Touches.** `src/discover/impact.ts`, `src/cli/impact.ts`, `tests/unit/impact.test.ts`.

**Done when.**
- Reads `git diff --name-only <ref>...HEAD` in the target, matches files against area
  and critical-path `sourceFiles`, and prints (and writes `state/impact.json`):
  impacted areas and paths, accepted specs covering them, areas with no accepted spec
  (re-explore), and `unmapped` changed files.
- Answer-key files in the diff are listed by path only, never opened.
- Unit tests over a fixture app map and fixed file lists; deterministic output.

**Notes for the implementer.**
- First in the M1 cut order: skip it if the day-2 afternoon is short.

**Questions.**
