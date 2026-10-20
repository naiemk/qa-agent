# Days 0–2 — private App dogfood checklist

Stay inside `testdriver/`. Do not change Magpi Test `src/`.

Customer-facing install steps (after the App is public) live in
[`../INSTALL.md`](../INSTALL.md).

## Ordered steps

1. **Register a private GitHub App** using permissions/events from
   [`../app.yml`](../app.yml):
   - Events: `issue_comment`, `pull_request`
   - Permissions: issues / pull requests / checks / statuses **write**;
     contents **read**; metadata read
   - Visibility: **private** (dogfood org/user only)
2. **Generate a private key**; save under `testdriver/secrets/` (gitignored).
   Copy App ID and webhook secret into `testdriver/.env` from `.env.example`
   (`APP_ID`, `PRIVATE_KEY_PATH` or `PRIVATE_KEY`, `WEBHOOK_SECRET`,
   `TRIGGER_PHRASE`).
3. **Start the server**
   ```bash
   cd testdriver
   npm install
   npm run serve
   ```
   Webhook path: `http://localhost:3000/api/github/webhooks` (or `$PORT`).
4. **Point the App webhook at a reachable URL**
   - GitHub cannot call `localhost`. For local dogfood, expose the port with
     **cloudflared** (`cloudflared tunnel --url http://localhost:3000`) or
     **localtunnel** / **smee.io**, then set Webhook URL to
     `https://<tunnel>/api/github/webhooks` and the same `WEBHOOK_SECRET`.
   - Hosted dogfood: deploy this process and use its HTTPS URL.
5. **Install the private App** on a test org/repo (only that repository).
6. **Fire a test mention** on an issue or PR:
   ```text
   @magpi-test please QA https://your-preview.example.com
   ```
   (Or whatever `TRIGGER_PHRASE` you set.) Confirm serve logs show
   `issue_comment.created`, trigger match, and `runner` accepted job.
7. **Offline proof (no GitHub)** — already works without credentials:
   ```bash
   npm run replay-fixture
   ```

## Phase 1 stop line

Webhook routing + mention detect + job log only. Magpi Test is **not** executed
until days 2–7.
