# Progress checkpoint

_Last updated: 2026-11-11_

## Verified

- Monorepo (pnpm workspaces), TypeScript, ESLint, Prettier; lint + typecheck clean.
- Production builds: dashboard (Next.js 16) and extension (WXT, Chrome MV3).
- PostgreSQL (embedded-postgres) data survives stopping and restarting both the database and
  the dashboard.
- Reddit: real extension on live reddit.com — Track button on post pages and feeds, metadata
  - metrics persisted, duplicate detection after reload, unreachable-dashboard error state.
- X: real extension on live x.com (logged-out) — tracked a NASA post from the profile timeline
  (3/3 runs). Adapter extraction checked on 5 live posts incl. video posts.
- LinkedIn: adapter run against the live logged-in UI (Microsoft company posts): detection,
  id resolution via the post menu, author (incl. reposts), text, media, reactions, publish date.
- Dashboard: list/search/filter/sort, detail chart + history, pause/resume/delete,
  collect-now messaging, desktop + mobile + dark mode inspected.
- Collector: snapshots, scheduling, error backoff, rate-limit deferral, removed posts → unavailable,
  skipped (not fabricated) when no credentials.
- Snapshot throttling (15 min) for extension observations.

## Known gaps

- Reddit collector unverified against the real API (no credentials available).
- LinkedIn extension flow not run in a logged-in browser with the extension installed (the
  logged-in session is in the user's Chrome; the extension was not installed there).
- X logged-in UI not verified live.
- LinkedIn URN kinds (activity vs share/ugcPost) can produce two records for one post.
- No authentication between extension and dashboard (localhost only); Prisma uses `db push`.

## Next task

1. Load the extension in your Chrome and track a LinkedIn feed post + an X post while logged in.
2. Add Reddit API credentials and run `pnpm collector --once`.
3. API key between extension and dashboard; `prisma migrate`.
