# E12 Models and cost (M2+, sketch)

**Outcome.** Each model role uses the cheapest model that works, with escalation only
where cheap models repeatedly fail.

M1 records tokens per accepted spec (MT-7.4) and uses one default model for Magpi Test's
own calls. Magpi's browsing models come from Magpi profiles.

Candidate stories:

- Per-role cost table from M1 runs (discover, criteria, harvest, repair; Magpi
  default / plan / coach).
- Try cheaper models per role against fixed fixtures; keep the cheapest that passes.
- Escalation rule: when, and to what, after repeated failure.
