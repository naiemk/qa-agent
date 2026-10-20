# Days 0–2 — private App dogfood checklist

Do this entirely from `testdriver/`. Do not change Magpi Test `src/`.

1. [ ] GitHub → Settings → Developer settings → GitHub Apps → **New GitHub App**
2. [ ] Copy permissions/events from [`../app.yml`](../app.yml); leave App **private**
3. [ ] Generate a private key; save under `testdriver/secrets/` (gitignored)
4. [ ] Set webhook URL to a tunnel (smee / cloudflared) → `http://localhost:$PORT`
5. [ ] Copy App ID + webhook secret into `testdriver/.env` from `.env.example`
6. [ ] `cd testdriver && npm install && npm run serve`
7. [ ] Install the private App on the dogfood repo (only select that repo)
8. [ ] Post a test issue comment containing `@magpi-test hello`
9. [ ] Confirm the webhook delivery appears in App settings and in serve logs
10. [ ] Offline: use `fixtures/sample-mention.json` once replay is implemented

**Stop here for days 0–2.** Magpi subprocess wiring is days 2–7.
