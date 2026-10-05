# E9 Fixtures and hard flows (M3, sketch)

**Outcome.** Wallet creation, passkeys, email OTP, and payment settlement on
onchain-invoice are explored and tested using the project's own helpers, with nothing
onchain-specific inside Magpi.

Spec: [specs/fixtures.md](../specs/fixtures.md) (undiscovered).

Candidate stories:

- Research: how successful tools expose fixtures to generated tests (Playwright
  `test.extend`, Hercules custom tools); native virtual authenticator vs app shim.
- Manifest `fixtures` section: named capabilities mapped to project helper modules.
- Making a capability available during Magpi exploration (pre-run setup vs tool).
- Emitting fixtures in specs; extend the no-AI guard to the allowed imports.
- Dogfood levels 3 and 4 from the brief: wallet creation with OTP and passkey; payment
  settlement with funding and worker ticks.
