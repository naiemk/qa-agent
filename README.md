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
node bin/magpi-test.mjs run --target ../your-app --max-minutes 30
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

## Install on your repo

Install the Magpi Test GitHub App so a comment on an issue or pull request can run QA
against a preview URL and post the summary back on the thread.

1. Open [Install Magpi Test](https://github.com/apps/magpi-test/installations/new)
   (App name `magpi-test`) and choose the repositories — public or private.
2. Follow the numbered steps in [testdriver/INSTALL.md](testdriver/INSTALL.md): webhook
   URL, install confirmation, trigger phrase, and where results appear.

After install, comment the configured trigger (default `@magpi-test`) with your preview
URL, for example `@magpi-test please QA https://your-preview.example.com`.

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
