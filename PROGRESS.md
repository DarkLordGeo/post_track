# Progress checkpoint

_Last updated: 2026-11-11_

## Done (built + tested)

- Monorepo (pnpm workspaces), TypeScript, ESLint, Prettier, Vitest, Playwright.
- PostgreSQL via `embedded-postgres` (no Docker/sudo), Prisma schema: `Post`, `Snapshot`.
- Platform adapter interface + **Reddit** adapter (new & old Reddit), tested on captured live markup.
- Extension (WXT, MV3): Track button on every post, tracked-state lookup, duplicate prevention,
  success/error toasts, passive snapshots on revisit, popup with connection status + settings.
- Verified live on reddit.com via Playwright with the real extension loaded.
- Dashboard: overview (KPIs, platforms, recent, top movers), posts list (search, platform
  filter, sort, mobile layout), post detail (metric cards, engagement chart, snapshot
  history, pause/resume/delete/collect now), empty/loading/error states, dark mode.
- Collector: scheduling by post age, batching, rate-limit backoff, failure backoff,
  removed-post detection. Reddit via OAuth (needs credentials).
- X + LinkedIn adapters (beta), tested on synthetic pages via the real extension.

## Known gaps / bugs

- Reddit collector unverified against the real API (no credentials available).
- X/LinkedIn selectors not yet verified on logged-in live pages.
- No authentication: the API is open to anything that can reach the dashboard (localhost only).
- Prisma uses `db push` (no migration history yet).

## Next task

1. Add Reddit API credentials to `apps/dashboard/.env` and verify `pnpm collector --once`.
2. Verify X and LinkedIn adapters on logged-in pages; capture real fixtures.
3. Add API-key auth between extension and dashboard; switch to `prisma migrate`.
