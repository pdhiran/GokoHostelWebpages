---
name: goko-local-docs
description: Review and update the gitignored GokoWeb local handbook in docs/ (architecture, flows, API map, secrets). Use when changing APIs, schema, auth, PMS, food, CMS, sync, deploy, or secrets; when the user asks to update docs; or after a feature lands.
---

# Goko local handbook

`docs/` is **not in git**. Update it in the same turn as the code. Never `git add docs/` or `MAINTAINER.local.md`.

## Steps

1. Read `docs/README.md` then `docs/llm-onboarding.md` (landmines).
2. Diff the change against **source** (`src/`, `migrations/`, `wrangler.jsonc`). Do not trust an older handbook paragraph if the route disagrees.
3. Patch every matching file in the table below. Keep mermaid diagrams accurate.
4. Secrets/passwords/live IDs → only `docs/secrets-and-access.md` and `MAINTAINER.local.md`.
5. Production stamps (Worker version, D1 applied list, R2) → `MAINTAINER.local.md`.
6. If `docs/` is missing, stop and say so.

## File map

| Change | Files |
|--------|--------|
| New/removed table or column | `data-model.md`, `relationships.md` |
| New route or `action` | `api-map.md`; permission maps → `auth-rbac.md` |
| Guest check-in / Vision / Drive | `flows-guest-checkin.md` |
| Food order / kitchen / stock / food settings keys | `flows-food-kitchen.md` |
| Beds, calendar bookings, inventory math, Aiosell | `flows-pms.md` |
| Expenses, ledger, salary | `flows-accounts.md` |
| Staff/volunteer IOUs | `flows-splits.md` |
| Events/Community CMS, R2, `/api/site` | `flows-cms.md` |
| Pi sync, failover, `SYNC_SECRET` | `flows-sync.md` |
| Review funnel, Form C, FRRO | `flows-reviews-formc.md` |
| Login, RBAC keys, env vs DB users | `auth-rbac.md` |
| Passwords, Google, Cloudflare tokens | `secrets-and-access.md` |
| How to run/deploy | `maintain.md` |
| npm scripts, tests, CI | `testing-and-ci.md`, `directory.md` |
| Why we built it this way | `decisions.md` |
| Landmines / wire formats / UI≠API | `llm-onboarding.md` |

## Style

- First line after title: `**LOCAL ONLY.**` plus login hint if relevant.
- Setting keys and `action` names must match code exactly (e.g. `food_kannada_kitchen_print`, not a guessed alias).
- Note real code drift when you find it (example: `syncEngine` still syncs `food_kannada_labels` while the UI uses print/display keys).
- Do not copy `docs/` content into committed markdown.

## Done when

Handbook matches the diff. Stale sentences that contradict `src/` are gone.
