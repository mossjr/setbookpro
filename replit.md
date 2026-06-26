# Set Book Pro

A full-stack PWA (setbook.pro) for shared chord/lyrics library management — built for live musicians to view, manage, and sync songs on stage. Note: the workspace package and directory name remain `songbook`; only the user-facing brand is "Set Book Pro".

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api` and `/ws`)
- `pnpm --filter @workspace/songbook run dev` — run the React PWA (proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `APP_PASSWORD`, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, Radix UI, Zustand, wouter, socket.io-client
- API: Express 5 + Socket.io (mounted at `/ws/socket.io`)
- DB: PostgreSQL + Drizzle ORM
- Auth: Single-password JWT (`APP_PASSWORD` → token signed with `SESSION_SECRET`, 30-day expiry, stored in `localStorage` as `songbook_token`)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/songbook/` — React PWA frontend
- `artifacts/api-server/` — Express API + Socket.io backend
- `lib/db/src/schema/` — Drizzle schema: songs, tags, song_tags, sets, set_songs
- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/api-client-react/` — Generated React Query hooks
- `lib/api-zod/` — Generated Zod validation schemas

## Architecture decisions

- Single-password auth: APP_PASSWORD env var checked at login; JWT returned and stored client-side. No user accounts.
- Socket.io mounted at `/ws/socket.io` with a separate `/ws` proxy path to avoid conflicts with the REST API at `/api`.
- Contract-first: all API shapes defined in OpenAPI spec, code-generated via Orval. Never hand-write API types.
- Chord rendering is purely client-side: `[Am]` markers are parsed by ChordRenderer and transposition is computed in the browser.
- UG (Ultimate Guitar) scraper uses MD5-hashed API key derived from deviceId + date + "createLog()" — see `artifacts/api-server/src/lib/ug.ts`.

## Product

- **Library:** Song/tag/set CRUD with search, multi-select, and tag filtering.
- **Song view:** Chord/lyric renderer with semitone transposition, display modes (scroll/columns), zoom, and auto-scroll.
- **Import:** Search Ultimate Guitar, preview tabs, and import into the library.
- **Gig sync:** Host/participant real-time sync via Socket.io — host broadcasts song changes and scroll position to all participants.
- **Metronome:** Web Audio API click track with BPM control.
- **PWA:** Installable on iOS/Android via manifest + service worker.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm run typecheck:libs` after changing `lib/db` or `lib/api-spec` before checking leaf packages — stale declarations cause false type errors in routes.
- After OpenAPI spec changes, run `pnpm --filter @workspace/api-spec run codegen` then restart the API server workflow.
- The `/ws` path must be listed alongside `/api` in the API server's `artifact.toml` for Socket.io to work through the proxy.
- UG API may return empty results or fail silently — the `searchUg` and `exploreUg` functions return `{ tabs: [] }` on any error.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
