# Dogfood target: onchain-invoice

Status: **proposed (M1)**. Facts read from `naiemk/onchain-invoice` (local checkout
`../onchain-invoice`) on 2026-10-04. Re-check before relying on ports or commands.

## What it is

Trustless Commerce: merchants create stablecoin invoices (USDC/USDT) with deterministic
on-chain addresses and share a pay link; payers pay; a sweeper settles to the merchant.
It also has a passkey identity wallet under `/wallet`. React + Vite UI, Node commerce
API, background workers (bundler, sweeper, wallet deployer), Hardhat local chain.

## Answer key: never read

```json
"answerKey": ["ui/e2e/*.spec.ts", "system-tests/tests/**"]
```

The Playwright specs under `ui/e2e/` (`local-stack`, `identity-email-restore`,
`identity-recovery`, `persist-recovery`, `screenshot-gallery`, `super-wallet`) are
the hidden human suite. Do not open them, even to "check a selector". They are used in
M5 only, by the evaluation code, to compare coverage.

## Allowed infrastructure

| Path | Use |
| --- | --- |
| `playwright.config.ts` | Startup (`webServer`: Hardhat :8545 → `node ui/e2e/stack/boot.mjs` API+workers :8080 → Vite :5173 with `VITE_E2E_WEBAUTHN=1`). `reuseExistingServer` is on outside CI. |
| `ui/e2e/stack/*` | Stack boot and local contract deployment. |
| `ui/e2e/helpers/stack.ts` | `loadLocalStack`, `apiBase`, `triggerWorker`, `withWorkerTicks` (M3). |
| `ui/e2e/helpers/webauthn-shim.ts` | `installE2eWebAuthn` virtual passkeys (M3). |
| `ui/e2e/helpers/wallet.ts` | `fundUsdc`, `payInvoiceUsdc`, `waitForInvoiceStatus`, dev OTP via `GET /api/identity/email/dev-otp` (M3). Its higher-level UI helpers (`createWalletFromUi` and similar) encode flows; do not use them as scenarios. |
| `ui/e2e/helpers/eoa.ts` | `installE2eEoa` injected wallet (M3). |

## Startup for Magpi Test

Manifest uses `"start": { "fromPlaywrightConfig": "playwright.config.ts" }`, which
runs the three `webServer` entries in order with their env. Prerequisites:
`npm install`, `npm run commerce:build`, `npx playwright install chromium`.
UI at `http://localhost:5173`, API health at `http://127.0.0.1:8080/api/health`. No
secrets needed: `boot.mjs` injects its own local env (`IDENTITY_DEV_OTP=1`, empty
Turnstile).

For acceptance, stop the exploration stack and run with `CI=1` so Playwright starts a
fresh one (QD6). The Hardhat chain state therefore resets between exploration and
acceptance, which is the "clean enough state" we want.

If the project later adds a single `npm run e2e:stack` script, switch the manifest to
it. That is the project's change to make, not ours.

## UI surface

Routes from `ui/src/App.tsx` and `ui/src/pages/react/wallet/WalletRouter.tsx`:

| Area | Routes | M1? |
| --- | --- | --- |
| Marketing / info | `/`, `/get-paid`, `/security`, `/integrations`, `/developers` | Yes |
| Legal | `/legal`, `/terms`, `/privacy`, `/cookies`, `/risks`, `/security-checks` | Yes |
| Commerce | `/create`, `/pay`, `/buy`, `/merchant`, `/merchant/*`, `/admin` | Yes, except paying (needs funding) and admin success (needs key) |
| Wallet | `/wallet` and `/wallet/*` (create, send, receive, recover, pair, super wallet, ...) | Shell and empty states only; flows need passkeys, OTP, workers: M3 |

## Good M1 candidates (no fixtures needed)

- Navigation across marketing and legal pages, from nav and from deep links.
- Create invoice with a custom EOA payout address (no passkey) and land on its pay link.
- Create-form validation: missing amount, malformed address, zero or negative amount.
- Pay page with an invalid or unknown invoice link (`/pay?invalid=1` is a known state).
- Merchant page empty state.
- Admin gate refuses without a key.
- `/wallet` shell renders for a signed-out user.

These are suggestions for writing guided scenarios and for sanity-checking discovery.
Discovery must find its own list; do not paste this table into prompts.

## Locator notes

- About 66 `data-testid`s, mostly in wallet, auth, recovery, and Super Wallet. Commerce
  pages have almost none, so expect role + name and label locators there.
- Many accessible names come from i18n (`t("...")`). Pin `locale: "en-US"` in the
  generated config.
- Legacy `a[data-route]` links are routed client-side; treat them as links.
