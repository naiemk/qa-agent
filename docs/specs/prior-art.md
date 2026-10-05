# Prior art and reuse

Status: **undiscovered**. MT-0.1 fills this in (timebox: 2 hours). Until then, this is
the list of questions, not answers.

The goal is not a market report. It is a short list of **things we call instead of
build** and **ideas we copy at the design level**, each with a link and one sentence.

## Questions to answer

| Source | Question for us | Feeds |
| --- | --- | --- |
| [Playwright codegen](https://playwright.dev/docs/codegen) | Can its selector generator be called from code (not just the recorder UI)? If yes, how, and is it stable across versions? | MT-6.4 repair loop, test-synthesis.md |
| [Playwright locators](https://playwright.dev/docs/locators), [ARIA snapshots](https://playwright.dev/docs/aria-snapshots) | Is `ariaSnapshot()` / `toMatchAriaSnapshot` a better repair input or assertion than text? | MT-6.4 |
| [Playwright WebAuthn / virtual authenticator](https://playwright.dev/docs/api/class-cdpsession) | Native passkey support vs the app's shim | M3 fixtures |
| [Playwright test agents](https://playwright.dev/docs/test-agents) | Playwright now ships planner / generator / healer agents. What do they do, what format do they emit, can we reuse them instead of our emitter or repair loop? | MT-6.1, MT-6.4, possibly QD4 |
| [Stagehand](https://github.com/browserbase/stagehand) | How `act` / `observe` / caching turn AI actions into replayable deterministic actions. | test-synthesis.md |
| [TestZeus Hercules](https://github.com/test-zeus-ai/testzeus-hercules) (AGPL: study only) | Planner vs navigator split, Gherkin scenario format, evidence and reports. | scenario format, report |
| [BrowserStack Test Companion](https://www.browserstack.com/docs/test-companion) | How requirements become test cases; how they write into existing frameworks. | guided mode |
| [QA Wolf](https://www.qawolf.com/) | Failure triage categories (bug vs flaky vs stale test). | MT-6.3 classification |
| [Momentic](https://momentic.ai/) | Authoring UX, how steps are stored, how they handle locator drift. | M2+ |
| [Meticulous](https://www.meticulous.ai/) | Learning from real sessions; deriving regressions without writing tests. | M4 |
| [TestSprite](https://www.testsprite.com/) | Repo understanding and test planning; MCP feedback to coding agents. | discovery, M4 |

## Output format (for MT-0.1)

Replace the table above with:

```markdown
## Call, do not build
- <thing> — <link> — <how we use it> — <story affected>

## Copy the idea
- <idea> — <source> — <where it lands in our design>

## Not for us (and why)
- ...

## Changes to specs or decisions
- <spec/decision> — <change> (also applied in this PR)
```
