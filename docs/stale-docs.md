# Stale docs — do not follow

Prefer `docs/` + `src/`. Secrets and live stamps: gitignored `secrets-and-access.md` + `MAINTAINER.local.md`.

| File | Lie |
|------|-----|
| `syncEngine` `food_kannada_labels` | Live UI keys are `food_kannada_kitchen_print` / `food_kannada_kitchen_display`. Sync list is stale. |
| Root `README.md` Option A | `.github/workflows/deploy-cloudflare.yml` **does not exist**. GitHub Actions does **not** deploy. Dashboard **Workers Builds** on `goko-hostel-latest-webpage` **does** auto-deploy on push to `main`. |
| `.cursor/rules/goko-web-overview.mdc` | Claims GitHub auto-deploy and “do not run deploy:cf”; claims no tests; claims Drive-only (CMS uses R2); table counts ~24 (schema is **52** tables). |
| Root `ARCHITECTURE.md` | Admin tabs incomplete (no Inventory, Website, Channel Manager, Reviews, Splits). Sheets as primary DB (moved to D1). |
| `RASPBERRY_PI_SERVER_DOCS.md` older “Not Yet Set Up” / PM2 idle | Tunnel and app **are** running; verify `pm2 list` on the device. SSH password: secrets file. |
| `Kitchen-Order-Tracking-Plan.md` | Plan, not live. |
| `drizzle/migrations` | Not what Wrangler applies. Use `migrations/`. |

Ops: `.cursor/rules/goko-web-ops.mdc` + `.cursor/rules/goko-local-docs.mdc`.
