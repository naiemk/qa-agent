# Magpi Test GitHub App (TestDriver-pattern)

Isolated module. See [PLAN.md](./PLAN.md) for structure, boundary rules, and
phases.

## Quick dogfood

```bash
cd testdriver
cp .env.example .env   # fill APP_ID, PRIVATE_KEY_PATH, WEBHOOK_SECRET
npm install
npm run serve
```

Point a webhook proxy at `http://localhost:3000` (or `$PORT`). Install the
**private** App on a dogfood repo, then comment:

```text
@magpi-test please QA https://your-preview.example.com
```

## Install link (after day 7–10 — public App)

```text
https://github.com/apps/<slug>/installations/new
```

Replace `<slug>` with the App’s public slug. Marketplace listing is optional
and does not block this URL.

## Boundary reminder

This process only **spawns** Magpi Test (`MAGPI_TEST_BIN`). It must not import
anything from `../src/`.
