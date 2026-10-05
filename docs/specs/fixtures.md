# Environment fixtures

Status: **undiscovered** (M3). Brief sections 10 and 12.

## Intent

Real apps need things that are not browser clicks: email OTP, passkeys, wallet funding,
chain state, background workers, API setup, test accounts. The project provides these;
Magpi Test should use them, both while exploring (so Magpi does not try to reinvent them
through the UI) and in generated specs.

## Decided constraints

- Application-specific environment setup is allowed. Application-specific test logic
  should still be discovered.
- Nothing application-specific inside Magpi.
- Generated specs may import only modules listed in the manifest's
  `fixtures.allowedImports`.
- M1 skips scenarios that need fixtures and records them as `needsFixture`.

## Known first case

onchain-invoice already has `installE2eWebAuthn`, dev OTP endpoint, `fundUsdc`,
`triggerWorker`, `withWorkerTicks` ([onchain-invoice.md](onchain-invoice.md)).

## Open questions

- How does a running Magpi exploration call a fixture (tool? pre-step? context
  setup before the run)?
- How does a fixture appear in a Trajectory and in emitted code (Playwright
  `test.extend` fixtures seem the natural target)?
- Native Playwright virtual authenticator vs the app's shim.
