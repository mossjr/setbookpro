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

## Private media serving (audio uploads)
Uploaded audio lives in private object storage and is served via `GET /api/storage/objects/*`, which is auth-guarded by `requireAuthAllowQuery` — it accepts the JWT via either the `Authorization: Bearer` header **or** a `?token=` query param. The client's `resolveAudioUrl()` appends `?token=<songbook_token>` to the URL it puts in `<audio src>`. The route keeps HTTP Range (206) support so scrubbing works. Upload size/MIME limits (audio/*, ≤50 MB) are enforced server-side in the `request-url` handler, not on the signed PUT.

**Why:** `<audio>`/`<video>` elements cannot attach an Authorization header, so a header-only guard would break playback; query-token auth was chosen over short-lived signed GET URLs to avoid an extra OpenAPI endpoint + codegen + async URL-refresh complexity. The Replit signed-URL sidecar only binds bucket/object/method/expires (not content-type/length), so PUT constraints must be validated at request-url issuance time.

## Media search (Spotify / YouTube pickers)
Spotify search uses the Web API **Client Credentials** flow (`SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET`, app-token, cached until expiry). When those secrets are absent the lib throws `SpotifyNotConfiguredError` and the route returns **HTTP 503 (ErrorEnvelope)** — the frontend detects `error.status === 503` to show a "not configured" setup prompt instead of an error. YouTube search is a **server-side HTML scrape** of the public results page (no key), parsing `ytInitialData` — same zero-setup, fragile-to-markup-change tradeoff as the UG scraper. Both live in `artifacts/api-server/src/lib/mediaSearch.ts`.

**Why:** Spotify has no keyless search; Client Credentials avoids per-user OAuth since the app has no user accounts. The 503-vs-empty-results split lets the UI distinguish "needs setup" from "no matches". YouTube has no free official search API, so scraping mirrors the existing UG approach. Untrusted external HTML/JSON is parsed under hard caps (fetch timeout, response-size cap, recursion depth + node-count caps) to prevent a slow/huge/hostile response from exhausting an authenticated request — keep these caps when touching the scraper.

## Per-song media player (continuous playback across modal toggles)
The player is a custom, ALWAYS-MOUNTED panel in `MediaPlayerModal.tsx` (NOT a Radix Dialog). When closed it is hidden with `opacity-0 + pointer-events-none + inert` (plus `aria-hidden`) — never `display:none`, `visibility:hidden`, translate-offscreen, or unmount. The YouTube `<iframe>` lives inside this panel in a wrapper div (`ytWrapperRef`, created in `SongView`, passed as a prop and rendered once). Because the wrapper is never unmounted or moved, the iframe never reloads, so audio keeps playing and the floating tap-toggle stays in sync whether the panel is open or closed. `SongView` owns both controllers (`useAudioPlayer`, `useYouTubePlayer(ytWrapperRef, videoId)`); a generic `MediaTransport` (play/pause + scrub Slider) drives both audio and YouTube identically. Floating icon: tap calls `audio.toggle()`/`yt.toggle()` directly inside the gesture (so autoplay policy allows it), or opens the panel when no controllable source; long-press (500ms) always opens the panel.

**Why:** A normally-mounted iframe reloads (playback restarts/desyncs) whenever its React owner unmounts OR when the node is `appendChild`-relocated between parents. An earlier design relocated ONE shared host node between a closed-state mini-player and the modal slot — moving the iframe forced a reload that silently desynced the YT player, so tap-toggle no-opped. Keeping the iframe in one never-moving, always-mounted node is what actually fixes it.

**How to apply:** Hide the closed panel only with opacity/pointer-events/inert so the iframe stays rendered (opacity-0 elements still paint → media keeps running; display:none/visibility:hidden/unmount suspend it). Do NOT reintroduce DOM relocation, `createPortal` hosts, or a Radix Dialog wrapper for the player — Radix unmounts its subtree on close and would kill the iframe. Spotify was DROPPED from the UX (only uploaded audio + YouTube remain); the DB column `spotifyLink` and `mediaType` enum value `"spotify"` are kept for backward-compat (no migration) and legacy `"spotify"` songs fall through to the default (Music icon, tap opens the panel). The custom panel hand-rolls a11y (focus trap, Escape, scroll lock, focus restore) — harden it (e.g. background-app inert) if it becomes a reusable primitive.

## Lib rebuild rule
After changing `lib/db/src/schema/` or `lib/api-spec/openapi.yaml`, always run `pnpm run typecheck:libs` before checking leaf packages. Missing exports from `@workspace/db` are almost always stale declarations, not bad imports.
