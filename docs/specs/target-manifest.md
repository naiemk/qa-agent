# Target manifest

Status: **proposed (M1)**. Decisions: QD7, QD8, QD9, QD11, QD12, QD14.

The manifest is how a project tells Magpi Test how to run it and what it must not read.
It lives at `<target>/magpi-tests/magpi-test.json`. JSON, not YAML, to avoid a parser
dependency and to validate with the same code as everything else.

## Shape (schemaVersion 1)

```json
{
  "schemaVersion": 1,
  "name": "onchain-invoice",
  "baseURL": "http://localhost:5173",
  "start": { "attach": {} },
  "allowedHosts": [],
  "playwrightConfig": "playwright.config.ts",
  "read": {
    "include": ["README.md", "AGENTS.md", "docs/**/*.md", "ui/src/**/*.{ts,tsx}"],
    "answerKey": ["ui/e2e/*.spec.ts", "system-tests/tests/**"]
  },
  "brief": "magpi-tests/qa-brief.md",
  "fixtures": {
    "allowedImports": []
  },
  "policy": "auto",
  "locale": "en-US",
  "model": { "magpi": "openrouter/<id>", "magpiTest": "openrouter/<id>" }
}
```

`start` is one of:

```json
{ "attach": {} }
```

The default (QD11). The environment already runs; the QA CI job that brought it up
passes the environment contract below. Magpi Test polls readiness and never spawns
anything. `baseURL` in the file is only the local fallback when
`MAGPI_TEST_BASE_URL` is unset.

```json
{ "fromPlaywrightConfig": "playwright.config.ts" }
```

Load the target's Playwright config and run its `webServer` entries in order (command,
`url` readiness probe, `env`, `timeout`, `cwd` defaulting to the config's directory).
This is the default for projects that already have Playwright E2E, because the startup
is already written and maintained there.

```json
{ "processes": [ { "name": "api", "command": "npm run api", "readyURL": "http://127.0.0.1:8080/health", "env": {}, "timeoutMs": 180000 } ] }
```

Explicit processes, for projects without that. Both start modes are local-dev
conveniences (QD8).

## Environment contract (attach mode, MT-1.5)

Set by the target's QA CI job before it runs `magpi-test`.

| Variable | Required | Meaning |
| --- | --- | --- |
| `MAGPI_TEST_BASE_URL` | yes | Where the UI is reachable. Overrides `baseURL`. |
| `MAGPI_TEST_READY_URL` | no | Polled until any status below 500 (default: the base URL). |
| `MAGPI_TEST_READY_TIMEOUT_MS` | no | Default 300000. Timeout → exit code 2. |
| `MAGPI_TEST_RESET_CMD` | no | Shell command, run from the target root, that returns the environment to its seeded state. Acceptance runs it before each replay (QD15). |
| `MAGPI_TEST_ENV_KIND` | no | `simulated` (default) or `shared` (QD12). |

The same variables are passed through to Playwright on replay, so the generated config
reads `MAGPI_TEST_BASE_URL` for `use.baseURL`.

## Field rules

| Field | Rule |
| --- | --- |
| `baseURL` | Where the UI is reachable once started. Discovery and Magpi runs start here. |
| `start` | Required. Magpi Test never guesses how to start a project. |
| `playwrightConfig` | Optional. If present, the generated config extends it (QD7, [test-synthesis.md](test-synthesis.md)). |
| `read.include` | Files discovery may read. Default: `README*`, `docs/**`, and source under `src/`, `app/`, `ui/src/`. |
| `read.answerKey` | Never read, grep, list contents of, or send to a model. Enforced by `src/files/` (QD9). |
| `fixtures.allowedImports` | Modules generated specs may import besides `@playwright/test` (empty in M1). |
| `allowedHosts` | Hosts besides localhost/127.0.0.1 where `policy: auto` is allowed (QD12). |
| `policy` | Passed to Magpi `--policy`. `auto` is allowed only when the effective base URL host is localhost/127.0.0.1 or in `allowedHosts`, and `MAGPI_TEST_ENV_KIND` is not `shared`; otherwise the loader rejects it. |
| `brief` | Path to the QA brief (QD14). Default `magpi-tests/qa-brief.md`. |
| `locale` | Pinned in the generated config (`use.locale`) so role names do not change with i18n. |
| `model` | Optional pins. Default from env (`MAGPI_TEST_MODEL`, Magpi's own profile). |

## Answer-key guard (MT-1.2)

- `src/files/` is the only module allowed to read target files (`fs` imports elsewhere
  touching the target are a review failure).
- It resolves symlinks and real paths before matching globs.
- Matching an `answerKey` glob throws `AnswerKeyError`. Callers do not catch it to retry
  some other way.
- A test plants a canary string in a fixture answer-key file, runs discovery against
  the fixture target with the fake model, and asserts the canary never appears in any
  recorded prompt.

## Open

- Whether `magpi-test init` (which writes the QA brief, MT-3.0) should also propose a
  manifest. Not in M1; hand-write it.
