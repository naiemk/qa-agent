# TestDriver-pattern GitHub App — plan

This folder is **isolated distribution tooling** for Magpi Test. It implements the
[TestDriver-style](https://docs.testdriver.ai/quickstart-github) click-path:
install a GitHub App → `@mention` on an issue/PR → run QA → post results.

It is **not** a dependency on TestDriver.ai. The name `testdriver/` means “the
mention-bot distribution pattern,” nothing more. Do not import `testdriverai`
packages into this module unless a future OEM decision is made explicitly
(see “Leak risks”).

**Invariant:** nothing under `testdriver/` is imported by `src/`, `bin/`, or
tests of Magpi Test. Magpi Test must not know this module exists. The only
allowed call direction is:

```
testdriver (this process)  →  CLI subprocess  →  magpi-test
```

---

## 1. Folder / module structure

```
testdriver/
  PLAN.md                 ← this document
  README.md               ← how to run / dogfood
  package.json            ← own dependencies (not root package.json)
  tsconfig.json
  .env.example
  .gitignore              ← PEM keys, local queue state
  app.yml                 ← GitHub App manifest (permissions + events)
  bin/
    serve.mjs             ← process entry (tsx → src/index.ts)
  src/
    index.ts              ← boot Probot / HTTP server
    config.ts             ← module-local env (never reads Magpi Test internals)
    github/
      app.ts              ← Probot/Octokit factory
      webhooks.ts         ← route installation + comment events
      mention.ts          ← parse @magpi-test / configured mention
      comments.ts         ← post progress + final results on the thread
    jobs/
      types.ts            ← Job, JobResult shapes
      queue.ts            ← in-process queue (swap later; keep interface)
      runner.ts           ← dequeue → Magpi client → comments
    magpi/
      contract.ts         ← the ONLY boundary types shared with Magpi Test usage
      client.ts           ← spawn magpi-test CLI; parse exit codes / report path
      preview-url.ts      ← extract preview URL from mention / PR / deployment
    marketplace/          ← week 2+ only (listing draft notes, not runtime)
      LISTING.md
  fixtures/
    sample-mention.json   ← webhook payload for local replay
  scripts/
    dogfood-checklist.md  ← days 0–2 private App steps
```

Everything needed to register, receive webhooks, queue work, call Magpi Test,
and reply on GitHub lives here. Root Magpi Test stays untouched.

---

## 2. Boundary with Magpi Test (what stays out / thin contract)

### Stays out of Magpi Test core (`src/`, `bin/` except unchanged CLI)

- GitHub App credentials and private key
- Webhook verification and Probot
- Mention parsing and slash/mention UX copy
- Job queue, retries, concurrency limits
- Results-comment Markdown formatting for GitHub
- Marketplace listing assets and billing webhooks
- Any Octokit types or GitHub event payloads

### Thin contract (CLI only — no TypeScript imports from `../src`)

The module calls Magpi Test as a **subprocess**, the same way a QA CI job would:

```text
MAGPI_TEST_BASE_URL=<preview>
MAGPI_TEST_READY_URL=<optional>
OPENROUTER_API_KEY=<from testdriver env or passthrough>
node <repo>/bin/magpi-test.mjs run --target <checkout> --max-minutes <n>
```

Contract surface (`src/magpi/contract.ts`):

| Field | Meaning |
| --- | --- |
| `targetDir` | Absolute path to the customer/repo checkout this job should run against |
| `baseUrl` | Preview / attach URL → `MAGPI_TEST_BASE_URL` |
| `readyUrl` | Optional → `MAGPI_TEST_READY_URL` |
| `maxMinutes` | Optional CLI flag |
| `bin` | Path to `magpi-test` binary (default: sibling repo `../bin/magpi-test.mjs`) |
| `exitCode` | Process exit status (document Magpi Test’s EXIT map: 0 ok, 2 env, 3 brief, 4 budget) |
| `reportPath` | Convention: `<target>/magpi-tests/state/report.md` if present after run |
| `stdout` / `stderr` | Captured for the GitHub comment fallback |

**Forbidden:** `import … from "../../src/…"`, linking Magpi Test as a library,
reaching into `pipeline.ts`, or sharing Magpi Test’s model client. If Magpi Test
needs a new flag for GitHub App use, that is a **separate Magpi Test PR** with a
CLI/docs change — not an import.

Optional later (still out of process): a tiny `magpi-test run --json-summary`
flag added in core. Until then, parse exit code + read `report.md` if it exists.

---

## 3. Implementation phases (timeline)

### Days 0–2 — Private App + dogfood

- [ ] Register a **private** GitHub App on the dogfood org/user (see `app.yml`).
- [ ] Store `APP_ID`, `WEBHOOK_SECRET`, private key PEM paths in `testdriver/.env`
      (gitignored).
- [ ] Run `npm install` **inside** `testdriver/` only; start `npm run serve`.
- [ ] Expose webhook via tunnel (e.g. smee.io / cloudflared) pointed at local serve.
- [ ] Install the private App on `naiemk/qa-agent` (and/or onchain-invoice).
- [ ] Verify `issue_comment` deliveries hit `webhooks.ts` and log the payload
      (`fixtures/sample-mention.json` for offline replay).
- [ ] Checklist: `scripts/dogfood-checklist.md`.

**Exit:** App receives comments; no Magpi run required yet.

### Days 2–7 — Mention → Magpi Test → results comment

- [ ] Implement `mention.ts`: trigger on `@magpi-test` (configurable
      `MENTION_HANDLE`); parse optional preview URL and goal text.
- [ ] Implement `preview-url.ts`: URL in comment body wins; else PR deployment
      URL if present; else fail with a comment asking for a URL (attach mode).
- [ ] Implement `jobs/queue.ts` + `runner.ts`: one job per mention; ack with
      👀 / “queued” comment.
- [ ] Implement `magpi/client.ts`: spawn CLI with env; map exit codes to comment
      tone; attach truncated `report.md` or “open artifacts in …” link.
- [ ] Implement `comments.ts`: progress + final summary; never post secrets.
- [ ] Dogfood on a real preview URL against a fixture or onchain-invoice stack.

**Exit:** Mention on a PR/issue runs Magpi Test and posts a useful reply.

### Day 7–10 — Public App + install link

- [ ] Flip App visibility to **public** in GitHub Developer settings.
- [ ] Document install URL in `testdriver/README.md`:
      `https://github.com/apps/<slug>/installations/new`
- [ ] Add a short “Install the Magpi Test GitHub App” section that can later be
      linked from the **root** README in a separate PR (do not edit root README
      in the scaffold PR if isolation is required — link from this folder only
      until product wants it).
- [ ] Smoke-test install on a second personal/org account.

**Exit:** External users can install without Marketplace; no GitHub review wait.

### Week 2+ — Optional Marketplace listing

- [ ] Draft listing notes in `marketplace/LISTING.md` (screenshots, pricing,
      support URL, Marketplace purchase webhook if paid via GitHub).
- [ ] Submit listing; expect ~2–6 weeks review. **Do not block** customer installs
      on the public install link.
- [ ] Publisher verification only if selling paid plans through Marketplace.

---

## 4. Dependencies, config, how it runs

### Dependencies (only in `testdriver/package.json`)

| Package | Why |
| --- | --- |
| `probot` | GitHub App + webhook framework |
| `octokit` / Probot’s bundled Octokit | Comments, reactions, PR metadata |
| `tsx` | Run TypeScript in the serve entry (same style as Magpi Test) |
| `@types/node`, `typescript` | Dev typecheck for this package only |

Do **not** add these to the root Magpi Test `package.json`. Do **not** depend on
`testdriverai` / `@testdriverai/*` unless OEM is an explicit later decision.

Job queue v1: in-process async queue (no Redis). Interface in `queue.ts` so a
later Redis/SQS backend can drop in without touching Magpi Test.

### Config / env (`testdriver/.env.example`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_ID` | yes | GitHub App id |
| `PRIVATE_KEY_PATH` | yes | Path to PEM (or `PRIVATE_KEY` inline) |
| `WEBHOOK_SECRET` | yes | Webhook HMAC |
| `MENTION_HANDLE` | no | Default `magpi-test` |
| `MAGPI_TEST_BIN` | no | Default `../bin/magpi-test.mjs` relative to repo root |
| `MAGPI_TEST_WORKDIR` | no | Override checkout root for dogfood |
| `OPENROUTER_API_KEY` | for live runs | Passed through to Magpi Test subprocess |
| `JOB_MAX_MINUTES` | no | Default budget passed as `--max-minutes` |
| `PORT` / `WEBHOOK_PROXY_URL` | local | Serve / smee |

Magpi attach vars (`MAGPI_TEST_BASE_URL`, …) are set **per job** by the runner,
not as global process env for the webhook server.

### How the module is run

**Separate process, same monorepo.**

```bash
cd testdriver
npm install
npm run serve          # node bin/serve.mjs → Probot on PORT
```

- Not loaded by `magpi-test` CLI.
- Not a workspace package of Magpi Test’s runtime graph.
- CI for Magpi Test core does not need to start this process.
- Optional later: Docker image `magpi-test-github-app` built only from this
  folder + the Magpi Test bin path mounted or `COPY`’d for the subprocess.

---

## 5. Leak risks and how to avoid them

| Risk | Avoidance |
| --- | --- |
| Importing `../src/pipeline.ts` “just this once” | Enforce in PLAN + code review: only `child_process` spawn of `magpi-test`. Add a unit test that `testdriver/src` has zero imports matching `from \"\\.\\./\\.\\./src`. |
| Root `package.json` gains `probot` | Keep deps in `testdriver/package.json` only. |
| Renaming Magpi concepts to “TestDriver sandbox / computer-use” in core docs | Core docs stay Magpi/Magpi Test. This folder may say “TestDriver-pattern” only in PLAN/README. |
| Adding `testdriverai` SDK to root for sandboxes | OEM = new decision + new subfolder or opt-in; never silent. Prefer Magpi/Playwright attach URL first. |
| GitHub event types leaking into Magpi Test report schema | Results comments are formatted here; Magpi Test continues to write `magpi-tests/state/report.md` only. |
| Shared `.env` at repo root mixing App PEM with Magpi keys | Module uses `testdriver/.env`; root `.env` stays Magpi/OpenRouter only. |
| Mention handle hardcoded in Magpi Test CLI help | Handle lives in `testdriver` config; core CLI help stays unchanged. |
| “Install App” instructions patched into Magpi Test `src/` strings | Install docs live under `testdriver/` until a deliberate product PR links them. |

**Code-review rule of thumb:** if a change under `src/` or root `package.json`
is required for this module to compile, stop — fix the boundary (CLI flag or
subprocess contract) instead.

---

## 6. Success criteria (module ready for public install)

1. Private dogfood: mention → Magpi subprocess → comment with pass/fail summary.
2. No new imports from Magpi Test `src/` into this tree.
3. Root `npm run precommit` unchanged and still green without installing
   `testdriver/` deps (module has its own install).
4. Public App install link documented; Marketplace still optional.
5. Secrets never appear in GitHub comments or fixtures committed to git.
