# qa-agent (Magpi Test)

An autonomous QA engineer built on [Magpi](https://github.com/naiemk/browser-session-agent).
Point it at a running app and its codebase. It builds a QA brief from the repo's own docs,
maps the UI and critical paths back to source files, explores them like a QA engineer,
and leaves behind manual test cases plus ordinary Playwright tests.

AI is used to discover and author tests. AI is not needed to run them: accepted tests
replay with `npx playwright test`, no Magpi process, no model, no tokens.

## Quick start

```bash
# 1. Next to a checkout of naiemk/browser-session-agent (the Magpi engine):
npm install

# 2. A model key for Magpi Test and Magpi (kept out of git):
echo 'OPENROUTER_API_KEY=sk-or-...' > .env

# 3. Start your app however your QA CI does it, then attach:
export MAGPI_TEST_BASE_URL=http://localhost:5173
export MAGPI_TEST_READY_URL=http://127.0.0.1:8080/api/health   # optional
node bin/magpi-test.mjs run --target ../your-app --max-minutes 30 --max-usd 1
```

The target needs `magpi-tests/magpi-test.json` (see
[docs/specs/target-manifest.md](docs/specs/target-manifest.md)). Results land in the target:

| Path | What |
| --- | --- |
| `magpi-tests/qa-brief.md` | What the agent believes the product is. Review and commit it. |
| `magpi-tests/manual/<area>.md` | Manual test cases with automation status. Move one to `scenarios/` to automate it. |
| `magpi-tests/specs/*.spec.ts` | Accepted Playwright specs (passed 3× with `--retries=0`, no AI). |
| `magpi-tests/state/report.md` | What was found, accepted, quarantined, skipped; tokens per spec. |
| `magpi-tests/state/app-map.json` | Areas and critical paths, each linked to source files. |

`magpi-test impact --target ../your-app --base main` maps a diff to the areas, specs to
re-run, and areas to re-explore. The onchain-invoice setup (stack script, manifest, CI
workflow) is in [examples/onchain-invoice/](examples/onchain-invoice/).

## Going live on Trustless Commerce (status 2026-10-27)

Proven locally: 5 accepted specs (3 guided, 2 explored) pass 15/15 replays with plain
`npx playwright test`, no AI. The GitHub workflow has **not run yet**.

Steps:

1. Merge qa-agent PR #6 (the workflow checks out qa-agent `main`).
2. In TC, from a clean branch off `main`, add:
   - `.github/workflows/qa-agent.yml`, copied from
     [examples/onchain-invoice/qa-agent.yml](examples/onchain-invoice/qa-agent.yml);
   - `magpi-tests/` from `~/nk/trustless-commerce/magpi-tests/` (specs, scenarios,
     state, `.gitignore`; about 91 files, its `.gitignore` keeps logs and Magpi homes out).
     It was generated on branch `identity-recovery-pathways`; first run
     `npx playwright test --config magpi-tests/playwright.config.ts` against a stack
     started from `main` (`examples/onchain-invoice/start-stack.sh`) and drop any spec
     that fails there.
3. TC repo settings: add secret `OPENROUTER_API_KEY`; enable Settings → Actions →
   General → "Allow GitHub Actions to create and approve pull requests".
4. On OpenRouter, put a spend limit on that key (it has none).
5. Actions → QA agent → Run workflow (default cap $1). Then open a small PR touching
   `ui/` to see the PR path: replay gate, a $0.25 run, a report comment, and a
   `magpi-test/<branch>` follow-up PR if tests changed.

Will it work once done? The replay gate and the run are the same commands that work
locally, so they very likely do. Expect one or two fix-ups on the first GitHub run, in
this order of likelihood:

- **Stack start on Ubuntu**: `start-stack.sh` (Hardhat, `boot.mjs`, Vite) has only run
  on macOS. Check `magpi-tests/state/logs/stack.log` in the artifact.
- **Node 24**: TC's own CI uses Node 22; this job runs `npm ci` on 24. Should be fine
  (`better-sqlite3` builds for 24) but unverified there.
- **Write-back**: the `magpi-test/<branch>` push and `gh pr create` need step 3's
  setting; the diff gate was tested in a scratch repo only.
- **Explore yield**: on TC about 2 of 9 explore passes become tests; the drafter guesses
  what an action does before seeing it. Fix planned as a scout run (MT-5.2/5.3). Guided
  scenarios in `magpi-tests/scenarios/*.md` are the reliable way to add coverage.

Spend so far on TC: about $0.49. Product bugs found are in
[docs/specs/onchain-invoice.md](docs/specs/onchain-invoice.md).

## Development

`npm run precommit` (typecheck + unit and integration tests). Tests never call a model:
they use the fake model client and a stubbed Magpi process.

## Where to start reading

| You want | Read |
| --- | --- |
| What we are building and why | [docs/product-brief.md](docs/product-brief.md) |
| What happens next, in order | [docs/roadmap.md](docs/roadmap.md) |
| The work items | [docs/epics/](docs/epics/README.md) |
| How it works (as far as we know) | [docs/specs/](docs/specs/README.md) |
| You are a coding agent implementing a story | [AGENTS.md](AGENTS.md), then [docs/guides/implementer-guide.md](docs/guides/implementer-guide.md) |
