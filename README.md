# Post Tracker

Track individual Reddit, X and LinkedIn posts from your browser and watch their engagement
over time in a dashboard.

```
apps/
  dashboard/   Next.js 16 dashboard + REST API + background collector (Prisma/PostgreSQL)
  extension/   WXT (Manifest V3) browser extension: injects "Track" on posts
packages/
  core/        Platform adapters (Reddit, X, LinkedIn), shared types, API schemas (zod)
  db/          Prisma schema, repository functions, embedded PostgreSQL dev server
  ui/          Shared shadcn-style React components + Tailwind v4 design tokens
e2e/           Playwright tests (dashboard + real extension in Chromium)
```

## Quick start

Requirements: Node 22+ with corepack (`corepack enable pnpm`, or `corepack enable --install-directory ~/.local/bin pnpm` without sudo). No Docker or system PostgreSQL needed.

```bash
pnpm install          # installs deps, generates Prisma client
pnpm db:start         # terminal 1: local PostgreSQL on :54329 (embedded-postgres)
pnpm db:push          # create tables (first run / after schema changes)
pnpm dev              # terminal 2: dashboard on http://localhost:3000
pnpm collector        # terminal 3 (optional): background engagement collector
pnpm --filter @post-tracker/extension build
```

Load the extension: `chrome://extensions` → Developer mode → **Load unpacked** →
`apps/extension/.output/chrome-mv3`. Open any Reddit post and click **Track**.

`pnpm --filter @post-tracker/extension dev` runs WXT with hot reload in a fresh browser.

To use another PostgreSQL, set `DATABASE_URL` in `packages/db/.env` and `apps/dashboard/.env`.

## How it works

- **Adapters** (`packages/core/src/adapters`) implement one interface per platform:
  `parseUrl` (canonical URL + stable id), `detectPosts`, `identify`, `extract`. The extension
  and dashboard never contain platform-specific logic.
- **Deduplication**: posts are unique on `(platform, platformPostId)`; any URL form
  (`redd.it/…`, `old.reddit.com`, share slugs, `twitter.com`, LinkedIn `/posts/…-activity-…`)
  resolves to the same id. Concurrent duplicate requests are handled by the unique constraint.
- **Snapshots**: each engagement reading is a timestamped `Snapshot` (`source` = `EXTENSION`
  or `COLLECTOR`). `NULL` means _unavailable_ and is never shown or sorted as zero.
  - The extension records visible metrics when you track a post and whenever you revisit a
    tracked post (throttled to one per 15 min).
  - The collector (`pnpm collector`) samples due posts: hourly for posts < 24h old,
    6-hourly for < 7 days, then daily. It batches requests, honours `429`/rate-limit headers
    platform-wide, backs off exponentially on errors and marks deleted/removed posts
    `UNAVAILABLE`.

### Platform data access

| Platform | Extension                                                                                                                                                                    | Server-side collector                                                                                                                                 |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reddit   | ✅ New + old Reddit, feeds + post pages. Verified end-to-end on live reddit.com with the real extension.                                                                     | Needs `REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET` (Reddit returns 403 to anonymous server requests). Create an app at https://www.reddit.com/prefs/apps |
| X        | Beta. Verified end-to-end on live x.com (logged-out view) with the real extension; supports both the current markup (no `data-testid`) and the classic `data-testid` markup. | Not available (paid API)                                                                                                                              |
| LinkedIn | Beta. Adapter verified against the live logged-in UI (company page posts); extension flow tested on a page replicating that UI.                                              | Not available (no public API)                                                                                                                         |

Metrics per platform: Reddit = score + comments (no shares/views). X = likes, replies, reposts,
views (read from the action bar's accessible summary). LinkedIn = reactions only in the current
UI; comment/repost counts are recorded only when visible, otherwise _unavailable_.

### Beta limitations (X, LinkedIn)

- **LinkedIn post ids are not in the page markup.** In feeds, the id is resolved when you click
  Track by briefly opening the post's "…" menu and reading its "Embed this post" link (the menu
  is closed again). On a single-post page (`/feed/update/urn:li:…`) the URL is used. Feed posts
  therefore show "Track" until clicked, even when already tracked; clicking reports
  "Already tracked" without creating a duplicate.
- LinkedIn exposes the same post under different URN kinds (`activity` vs `share`/`ugcPost`).
  Ids are namespaced, so a post tracked from its `activity` URL and again from a feed
  (`share` id) can appear twice.
- X was verified logged-out only (no X session was available). The logged-in UI may still use
  the classic `data-testid` markup, which is supported but not re-verified live.
- Both sites change their markup frequently; adapters are isolated in
  `packages/core/src/adapters/` with fixtures in `packages/core/test/fixtures/`.

## API

| Method             | Path                                 | Purpose                                                   |
| ------------------ | ------------------------------------ | --------------------------------------------------------- |
| `POST`             | `/api/posts`                         | Track a post (idempotent; `201` created / `200` existing) |
| `GET`              | `/api/posts?q=&platform=&sort=&dir=` | List/search                                               |
| `POST`             | `/api/posts/lookup`                  | Batch "is tracked?" for the extension                     |
| `POST`             | `/api/posts/observe`                 | Extension-observed metrics for a tracked post             |
| `GET/PATCH/DELETE` | `/api/posts/:id`                     | Detail / pause-resume / delete                            |
| `POST`             | `/api/posts/:id/collect`             | Collect now                                               |
| `POST`             | `/api/collect`                       | One collector pass (for cron)                             |
| `GET`              | `/api/health`                        | Health + DB check                                         |

## Tests

```bash
pnpm test             # Vitest: adapters (real Reddit markup), repository, collector
pnpm test:e2e         # Playwright: dashboard + extension (incl. live reddit.com)
pnpm test:e2e:offline # same, skipping the live Reddit tests
LIVE_X=1 HEADED=1 pnpm exec playwright test extension-x-live   # live x.com (needs a display)
pnpm lint && pnpm typecheck
```

Unit/integration and e2e tests use the `post_tracker_test` database (created by `db:start`);
run `DATABASE_URL=postgresql://postgres:postgres@localhost:54329/post_tracker_test pnpm db:push`
once to create its tables. E2E builds are not automatic: run `pnpm build` first.
