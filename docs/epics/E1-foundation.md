# E1 Foundation

**Outcome.** A TypeScript package with a `magpi-test` CLI, a validated target manifest,
an answer-key guard enforced in code, a stack controller that starts the target the way
its own Playwright config does, and a model port with a fake for tests.

**Milestone.** M1, day 1.

---

### MT-1.1 Scaffold the package
- [ ] done

**Outcome.** `npm run precommit` works on an empty-but-real package that mirrors Magpi's
conventions.

**Depends on.** Nothing.
**Touches.** `package.json`, `tsconfig.json`, `tsconfig.check.json`, `bin/magpi-test.mjs`,
`src/cli/main.ts`, `src/cli/run.ts`, `tests/unit/cli.test.ts`, `.gitignore`.

**Done when.**
- `package.json`: name `magpi-test`, `"type": "module"`, `engines.node >= 24`,
  `bin: { "magpi-test": "./bin/magpi-test.mjs" }`, scripts `typecheck`, `test`
  (`tsx --test tests/**/*.test.ts`), `precommit` (`typecheck && test`).
- Dependencies: `@naiemk/magpi` as `file:../browser-session-agent`,
  `@playwright/test`, `tsx`, `typescript`. Nothing else without a reason in the PR.
- `magpi-test --help` prints the commands from
  [specs/architecture.md](../specs/architecture.md) "CLI" and exits 0; unknown command
  exits 2. Covered by `tests/unit/cli.test.ts`.
- `npm run precommit` passes.

**Notes for the implementer.**
- Copy the shape of Magpi's `bin/browser-agent.mjs` (tsx loader) and
  `src/cli/main.ts` (`main(argv): Promise<number>` returning an exit code, tiny flag
  parser). Do not add a CLI framework.
- `tsconfig`: NodeNext, `allowImportingTsExtensions`, `noEmit`, strict.

**Questions.**

---

### MT-1.2 Target manifest and answer-key guard
- [ ] done

**Outcome.** `loadManifest(targetDir)` returns a validated manifest, and `src/files/`
is the only way to read target files, refusing answer-key paths.

**Depends on.** MT-1.1.
**Touches.** `src/config/manifest.ts`, `src/files/index.ts`, `tests/unit/manifest.test.ts`,
`tests/unit/files.test.ts`, `tests/fixtures/target-basic/`.

**Done when.**
- Manifest shape and rules match [specs/target-manifest.md](../specs/target-manifest.md);
  validation returns all errors at once (string list), not the first.
- `policy: "auto"` with a non-local `baseURL` is rejected (test).
- `files.read(path)`, `files.list(glob)`, `files.grep(pattern, glob)` resolve real paths
  and throw `AnswerKeyError` on answer-key matches, including via symlink (test).
- `files.list` never returns answer-key paths (test).
- Canary test: a fixture answer-key file contains `CANARY-7f3a`; a test runs every
  public `files` function over the fixture target and asserts the canary never appears
  in any return value.

**Notes for the implementer.**
- Node 22+ has `fs.glob` / `path.matchesGlob`; use them instead of a glob dependency.
- Later, MT-3.3 extends the canary test to recorded model prompts.

**Questions.**

---

### MT-1.3 Stack controller
- [ ] done

**Outcome.** `startStack(manifest)` brings the target up and `stop()` tears it down
cleanly, using the target's own Playwright `webServer` entries or explicit processes.

**Depends on.** MT-1.2.
**Touches.** `src/stack/index.ts`, `src/stack/playwright-webservers.ts`,
`tests/integration/stack.test.ts`, `tests/fixtures/target-basic/`.

**Done when.**
- `fromPlaywrightConfig`: imports the target's config (run under tsx, so `.ts` works),
  reads `webServer` (object or array), and starts each in order with its `command`,
  `env` merged over `process.env`, `cwd` (default: config file's directory), waiting for
  `url` (or `port`) to answer before starting the next, honoring `timeout`.
- If a readiness URL already answers before start, reuse it and do not spawn (same as
  Playwright `reuseExistingServer` locally); report which servers were reused.
- `stop()` kills each spawned process group (spawn with `detached: true`, kill
  `-pid`), in reverse order, and waits for exit. No orphaned processes after the
  integration test (assert ports are free).
- Logs for each process go to `magpi-tests/state/logs/<name>.log`.
- Integration test uses a fixture target with two tiny Node HTTP servers and a
  Playwright config declaring them.

**Notes for the implementer.**
- Readiness: poll with `fetch` every 500 ms; Playwright treats 2xx-3xx (and 4xx for
  `url`) as up. Match it: any status below 500 means ready.
- onchain-invoice's three servers take up to 3 minutes total on a cold start; do not
  shorten their timeouts.

**Questions.**

---

### MT-1.4 Model client port
- [ ] done

**Outcome.** Magpi Test's own model calls go through one small interface with an
OpenRouter adapter and a scripted fake for tests.

**Depends on.** MT-1.1.
**Touches.** `src/model/index.ts`, `src/model/openrouter.ts`, `src/model/fake.ts`,
`tests/unit/model.test.ts`.

**Done when.**
- `interface ModelClient { completeJson<T>(req: { system: string; user: string; schemaHint: string; validate: (v: unknown) => string[] }): Promise<{ value: T; usage: { inputTokens: number; outputTokens: number } }> }`.
- `completeJson` retries once with the validation errors appended if the first answer
  fails `validate`; then throws `ModelOutputError` with the raw text.
- OpenRouter adapter uses `fetch` to the chat completions endpoint, model from
  `MAGPI_TEST_MODEL` or the manifest; key from `OPENROUTER_API_KEY`.
- Every call is appended to `magpi-tests/state/prompts.jsonl` (system, user, output,
  usage) so the answer-key canary check and cost accounting can read it.
- Fake: constructed with a list of canned outputs (or a function of the request);
  records requests. All tests use the fake. A test asserts no test file imports
  `openrouter.ts`.

**Notes for the implementer.**
- Keep prompts small: a cheap model gets one local problem plus a JSON shape. No
  conversation history.

**Questions.**
