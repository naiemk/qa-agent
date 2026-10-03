# E8 Knowledge (M2, sketch)

**Outcome.** A second `magpi-test run` reuses what the first learned and explores only
what is new, failed, or uncertain.

Spec: [specs/knowledge.md](../specs/knowledge.md) (undiscovered). Do not start until M1
exits.

Candidate stories (to be written properly when M2 starts):

- Decide where app knowledge lives (own files vs Magpi `PlanStore`), with evidence from
  M1 runs.
- Mark critical paths covered by accepted, passing specs; skip them on the next run.
- Detect new or changed routes by diffing the static scan and live survey.
- Measure rediscovery avoided (passes and tokens saved on a second run).
