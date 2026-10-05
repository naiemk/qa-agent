# E7 Dogfood: onchain-invoice

**Outcome.** M1 is demonstrated on a real product: Magpi Test is unleashed on
onchain-invoice and leaves a first batch of accepted Playwright specs, from both guided
scenarios and coached exploration.

**Milestone.** M1. Facts: [specs/onchain-invoice.md](../specs/onchain-invoice.md).

Work in a branch of `naiemk/onchain-invoice` for anything written there
(`magpi-tests/`). Never read the answer-key files listed in the spec.

---

### MT-7.1 onchain-invoice manifest
- [ ] done

**Outcome.** `onchain-invoice/magpi-tests/magpi-test.json` exists and
`startStack` brings the app up from it.

**Depends on.** MT-1.3.
**Touches (onchain-invoice).** `magpi-tests/magpi-test.json`, `.gitignore`
(`magpi-tests/state/magpi-home/`, `magpi-tests/state/logs/`).

**Done when.**
- Manifest uses `fromPlaywrightConfig: "playwright.config.ts"`, `baseURL`
  `http://localhost:5173`, the answer-key globs from the spec, `locale: "en-US"`,
  `policy: "auto"`.
- `read.include` covers `README.md`, `AGENTS.md`, `docs/**/*.md`, `ui/src/**`, and
  `ui/e2e/helpers/**` (helpers allowed, specs not).
- A script or test in this repo starts and stops the onchain-invoice stack from the
  manifest and confirms `GET /api/health` and the UI respond.

**Questions.**

---

### MT-7.2 First guided batch
- [ ] done

**Outcome.** At least 3 human scenarios for onchain-invoice are accepted specs.

**Depends on.** MT-4.3, MT-6.4.
**Touches (onchain-invoice).** `magpi-tests/scenarios/*.md`, `magpi-tests/specs/`,
`magpi-tests/state/`.

**Done when.**
- 3+ scenarios written by a human (or by the implementer from the product docs and the
  live UI, never from the answer key), including at least one edge case.
- `magpi-test guided --target ../onchain-invoice` accepts at least 3.
- From onchain-invoice root, `CI=1 npx playwright test --config
  magpi-tests/playwright.config.ts --repeat-each=3 --retries=0` is green with no
  provider key set in the environment.

**Questions.**

---

### MT-7.3 Unleash: `magpi-test run` on onchain-invoice
- [ ] done

**Outcome.** One command discovers, explores through lenses with coaching, and accepts
specs for onchain-invoice.

**Depends on.** MT-5.3, MT-6.4, MT-7.2.
**Touches.** `src/cli/run.ts` (this repo); onchain-invoice `magpi-tests/`.

**Done when.**
- `magpi-test run --target ../onchain-invoice` runs discover → guided → explore →
  accept → report, resumable after interruption.
- Roadmap M1 exit checks for discovery, explored specs (5+, 2+ lenses, 1+ edge case),
  and coaching evidence are met, or the shortfall is written in the report with the
  reason.
- Fixture-needing paths (wallet, passkeys, settlement) appear as skipped with
  `needsFixture`, not as failures.

**Questions.**

---

### MT-7.4 M1 report and roadmap update
- [ ] done

**Outcome.** `magpi-tests/state/report.md` tells a reader what Magpi Test found and
produced, and the roadmap reflects reality.

**Depends on.** MT-7.2, MT-7.3.
**Touches.** `src/report/index.ts` (this repo), `docs/roadmap.md`,
`docs/specs/open-questions.md`, `docs/decisions.md`.

**Done when.**
- Report sections: app map summary; specs accepted (by source and lens); quarantined
  with suspected cause; skipped with `needsFixture`; tokens and browser actions per
  accepted spec; passes coached vs not; product bugs suspected.
- One extra full replay of all accepted specs at the end is recorded (stability).
- Roadmap M1 boxes ticked or annotated with dated notes; open-questions answers
  updated; any new decision recorded.

**Questions.**
