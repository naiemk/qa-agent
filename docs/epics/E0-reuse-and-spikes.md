# E0 Reuse and spikes

**Outcome.** Before anyone builds, we know what to call instead of build, and the two
Magpi run paths M1 depends on are confirmed working (or the fallback is chosen).

**Milestone.** M1, day 1 morning. Both stories are timeboxed and run in parallel.

---

### MT-0.1 Prior-art reuse note
- [ ] done

**Outcome.** [specs/prior-art.md](../specs/prior-art.md) lists what we call, what
ideas we copy, and what we skip, with links, and any spec changes that follow.

**Depends on.** Nothing.
**Touches.** `docs/specs/prior-art.md`, possibly `docs/specs/test-synthesis.md`,
`docs/decisions.md`.
**Timebox.** 2 hours. Stop at the timebox and write what you have.

**Done when.**
- Every question row in `prior-art.md` has an answer or "unknown after timebox".
- The Playwright selector-generator question has a concrete answer: a callable API
  with a code snippet that you ran, or "not public" with the evidence.
- The Playwright test agents (planner / generator / healer) question has an answer:
  what they emit, whether our emitter or repair loop should use them instead, and a
  recommendation recorded as a proposed decision if it changes QD4.
- Any spec change is applied in the same PR.

**Notes for the implementer.**
- Read primary sources (docs, source on GitHub). Do not summarize marketing pages
  beyond one sentence.
- Hercules is AGPL-3.0: describe ideas, do not paste code.
- This is a research task. Do not write product code here.

**Questions.**

---

### MT-0.2 Magpi spike: confirm run paths and artifacts
- [ ] done

**Outcome.** We have run both Magpi paths against a real page and recorded what they
actually do, so E2 and E5 build on facts.

**Depends on.** Nothing. Needs `OPENROUTER_API_KEY` (live, paid; keep it to a few runs).
**Touches.** `docs/specs/magpi-integration.md` (corrections section and the
"Unverified" note), `docs/decisions.md` (QD2 status), `spikes/magpi/` (scripts and
captured artifacts, small).

**Done when.**
- A bounded run works: `browser-agent run "<goal>" --url <a page of onchain-invoice or
  any local page> --criterion '<json>' --policy auto --root <dir> --json` exits 0, and
  the goal directory's `events.jsonl`, `payloads.jsonl`, `metrics.jsonl` are copied to
  `spikes/magpi/bounded/` (redact anything secret).
- The coached parent path is tried: `magpie --json --plan-file plan.md "<objective>"`
  then `magpie --session <id> -p ...`. Record exactly: does it run unattended to
  completion, how the start URL and policy are passed, where the goal directory is,
  whether `strategyArtifact` appears in `goal.json`, and how to tell the session is done.
- `magpi-integration.md` "Unverified" note is replaced with what you found, and QD2
  is marked `accepted` or amended. If the parent path does not work unattended,
  write that the M1 fallback in
  [discovery-and-exploration.md](../specs/discovery-and-exploration.md) is in force.
- One captured goal directory is reduced to a small test fixture under
  `spikes/magpi/fixture-goal/` for MT-2.4 to use.

**Notes for the implementer.**
- Local Magpi checkout: `../browser-session-agent`. `npm install`, then
  `npx tsx src/cli/run.ts run ...` or `npm run agent -- run ...` from there.
- `--root` keeps your runs out of `~/.browser-agent-core`.
- A local static page or onchain-invoice's `/create` both work as a target; the stack
  needs `npm run commerce:build` and the three `webServer` processes
  ([specs/onchain-invoice.md](../specs/onchain-invoice.md)).
- Do not change Magpi in this story.

**Questions.**
