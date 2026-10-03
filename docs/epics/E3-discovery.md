# E3 Discovery

**Outcome.** Dropped on a repo with a manifest, Magpi Test finds the UI surface and the
critical paths and writes `state/app-map.json`, without reading the answer key.

**Milestone.** M1, day 2 morning. Spec:
[specs/discovery-and-exploration.md](../specs/discovery-and-exploration.md).

---

### MT-3.1 Static scan
- [ ] done

**Outcome.** `staticScan(files)` returns routes, docs headings, helper exports, and
locator hints from source, deterministically, with no browser and no model.

**Depends on.** MT-1.2.
**Touches.** `src/discover/static-scan.ts`, `tests/unit/static-scan.test.ts`,
`tests/fixtures/target-react/`.

**Done when.**
- Finds React Router routes in the three forms listed in the spec, with file and line.
- Collects docs headings (`#`, `##`) from allowed markdown.
- Lists exported function names from allowed helper folders.
- Collects `data-testid` and `aria-label` literal values per file.
- Uses only `src/files/` (test: a fixture answer-key file containing a fake route
  `/answer-key-route` never shows up).
- Fixture test asserts the exact JSON output.

**Notes for the implementer.**
- Regex over source is fine for M1. Do not add a TS/JSX parser dependency.
- On onchain-invoice the routes are in `ui/src/App.tsx` and
  `ui/src/pages/react/wallet/WalletRouter.tsx`; the scan should find them without being
  told.

**Questions.**

---

### MT-3.2 Live surface survey
- [ ] done

**Outcome.** `liveSurvey(stack, scan)` visits each parameter-free route and records
what the page is and what it advertises, without submitting anything.

**Depends on.** MT-1.3, MT-3.1.
**Touches.** `src/discover/live-survey.ts`, `tests/integration/live-survey.test.ts`.

**Done when.**
- For each route: final URL, HTTP status, title, `h1`/`h2` texts, console errors, links
  (name + href), forms (field labels, submit button names), primary buttons.
- Follows in-app links one level from `baseURL` and adds routes not in the scan, marked
  `source: "live"`.
- Never clicks a submit button or fills a form (test against a fixture page whose form
  posts to a handler that records any hit; assert zero hits).
- Records which implementation was used and why in `docs/decisions.md`: plain
  Playwright (`getByRole`, `ariaSnapshot()`), a Magpi run, or a new exported Magpi
  `surveyAffordances` API. Plain Playwright is the default for M1 unless MT-0.2 found a
  cheap Magpi path.

**Notes for the implementer.**
- Cap per page: 10 s for load, 200 links, 20 forms. Record truncation.
- Use the manifest `locale` for the browser context.

**Questions.**

---

### MT-3.3 App map and critical paths
- [ ] done

**Outcome.** `buildAppMap(scan, survey, model)` writes `state/app-map.json` with areas
and ranked critical paths, and seeds candidate scenarios.

**Depends on.** MT-3.2, MT-1.4.
**Touches.** `src/discover/app-map.ts`, `src/discover/prompts.ts`, `src/cli/discover.ts`,
`tests/unit/app-map.test.ts`.

**Done when.**
- Output matches the `AppMap` type in the spec and passes validation; any `startPath`
  not seen in scan or survey is rejected and the model is asked once more.
- Model input is a trimmed summary (no source code, under 6k tokens for onchain-invoice
  size apps; test asserts the prompt size for the fixture).
- `needsFixture` is inferred from helper names and route names (e.g. `webauthn`,
  `passkey`, `otp`, `fund`, `wallet`), and the model may add but not remove them.
- For each critical path × lens, one candidate Scenario (`source: "discover"`,
  `criteria: []`, `status: "pending"`) is written; criteria come later (MT-4.2).
- `magpi-test discover --target <dir>` runs scan → stack → survey → map → stop.
- Canary test extended: after `discover` on the fixture target with the fake model,
  `prompts.jsonl` does not contain `CANARY-7f3a`.

**Notes for the implementer.**
- Two calls are fine: one to group routes into areas, one to pick and rank critical
  paths. Each is a small JSON task for a cheap model.
- Prompt tells the model: rank by user value and risk (money, identity, data loss);
  prefer flows that end in a visible, checkable outcome.

**Questions.**
