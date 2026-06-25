---
name: SongBook architecture
description: Non-obvious design decisions for the SongBook app (auth, Socket.io, UG API, chord rendering)
---

## Auth
Single-password JWT: `APP_PASSWORD` env var checked at `/api/auth/login`; 30-day JWT signed with `SESSION_SECRET`. Token stored in `localStorage` as `songbook_token`. The `custom-fetch.ts` in `lib/api-client-react` is pre-wired to read it — default getter is set at module initialization, no setup needed in the app.

**Why:** No user accounts needed; the whole app is a shared tool for a single band/team.

## Socket.io path
Server mounts at `/ws/socket.io`. The `artifact.toml` must list both `/api` and `/ws` as paths. The frontend `io()` call must use `path: "/ws/socket.io"`.

**Why:** Default `/socket.io` path conflicts with the Express router and the proxy strips it. `/ws` is a dedicated path to avoid collisions.

## UG API key
MD5 hash of `deviceId + formattedDate + "createLog()"` where `formattedDate` is `YYYY-MM-DD:H` (UTC hour, no padding). A new `deviceId` is generated per request. See `artifacts/api-server/src/lib/ug.ts`.

**Why:** UG API requires a rotating key derived from device identity. The hash scheme was reverse-engineered from the Android app.

## Chord content format
UG API returns content with `[ch]Am[/ch]` markers. These are stripped to `[Am]` format by `extractLyricsChords()` in `lib/ug.ts`. The frontend `ChordRenderer` then parses `[Am]` style markers for display and transposition.

**Why:** Keeps a single consistent chord marker format throughout the system.

## Lib rebuild rule
After changing `lib/db/src/schema/` or `lib/api-spec/openapi.yaml`, always run `pnpm run typecheck:libs` before checking leaf packages. Missing exports from `@workspace/db` are almost always stale declarations, not bad imports.
