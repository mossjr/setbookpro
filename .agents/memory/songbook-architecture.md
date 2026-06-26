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

## Song-view layout: user controls font, layout reflows (never auto-shrink)
The song body has three modes — scroll (one column + vertical/auto-scroll), split (paginated multi-column, tap right/left half to turn pages, no scroll), and auto (resolves to scroll when only one comfortable column fits, else split). Font/zoom is **user-controlled** (Settings + zoom +/-); the layout REFLOWS around it and must NEVER silently shrink the font to fit. Lives in `useSongViewLayout.ts` (replaced an earlier auto-fit hook). Auto-scroll is hidden in effective split mode (can't vertical-scroll multiple columns).

**Why:** This reverses an earlier "auto-fit font+columns" decision. The Director explicitly wants to pick the font size and have the layout adapt — auto-shrinking the font out from under the user was the wrong default for live-stage reading.

**Width-safety invariant — ABSOLUTE, and it recurred twice:** content must NEVER be wider than the music viewport (no horizontal scrollbar, every split column ≥ its widest line). The mechanism: a hidden shrink-wrapped (`inline-block`) ChordRenderer mirror at zoom 1 measures the widest no-wrap line; the effective zoom is capped at `availW / widestLine`. **This cap must dominate every other clamp.** Both regressions here came from a lower bound (a readability floor, then a hard `0.1` floor) being applied with `Math.max` AFTER the width cap, letting effZoom exceed the width-safe value for very wide lines. Correct shape: floor must itself be `min(readabilityFloor, widthSafeZoom)` so the result can never rise above `widthSafeZoom`.

**How to apply:** (1) The hidden measurer only exists in chord mode (`!lyricsOnly`); lyrics-only bypasses it, so EVERY lyrics-only block (lines AND section labels) must self-wrap with `overflowWrap: anywhere` or a long unbreakable token overflows. (2) Every top-level line/label/gap block in ChordRenderer needs `breakInside: avoid` so columns never split a line. (3) When touching the zoom math, re-verify `effZoom ≤ widthSafeZoom` holds for the pathological case (a line wider than the viewport even at the readability floor) — that case must force a single column, not clip.

## Auto-scroll scrubber: per-song speed, dead-center = base
The scrubber is a circular handle on a track: dead-center = the user's **base** speed (a Settings slider), drag right/left → faster/slower toward the Settings max/min (nonlinear per half). Speed is saved **per song** in localStorage (in the persisted settings store, NOT the DB). Base/min/max are mutually clamped in the store setters — changing min or max re-clamps base into range (don't rely on slider bounds alone, since persisted values can drift out of range).

**Why:** Songs need different stage tempos; per-song client-side persistence avoids a DB round-trip. Center=base lets the player nudge around a sensible default instead of from zero.

## Gig live-sync (HOST/PARTICIPANT)
One server-authoritative **single global session** (no rooms): newest `claim_host` wins and demotes the prior host; late joiners get a full `sync_state` snapshot on connect. Role is derived purely from `hostId === myId` (host) / `hostId === null` (idle) / else participant. Scroll is synced as **fraction + remainingMs**, never pixel positions — each follower re-derives its own px/s every frame (`useAutoScroll` follow mode) so devices with different fonts/zoom land at the bottom at the same wall-clock time. Participant lock-down is enforced at the **router** level (App.tsx returns `<Home/>` whenever role is participant) — Home/Layout hiding alone is not enough because a participant could already be on `/import` or `/sets/:id`.

**Why:** One band shares one password ⇒ one implicit session; rooms would add UI with no product value. Fraction/time sync (not pixels) is the only way heterogeneous devices stay in lockstep.

**How to apply — scroll-cancel invariant (this caused a multi-round bug):** ANY change to what the host presents must cancel in-flight scroll on BOTH server and every client. Server nulls `scroll` on `host_present`/`claim_host`; the client `applyPresent` AND the null-scroll branch of `applySync` must each push a fresh `stop` `scrollCmd` with a **new monotonic `seq`** (the seq is what makes a repeated/identical command re-fire its effect). Skipping the client-side stop lets a stale `start` replay when the next host song mounts, and lets a host demoted on the same song keep auto-scrolling. If you add any new event that changes the presented song/mode, reset `scrollCmd` the same way. (Note: this also cancels scroll on transpose-only presents — accepted tradeoff; the next host `scroll_seek` re-anchors within ~1.2s.) Socket.io auth: every socket must present the same JWT as REST via `io.use` + `verifyToken`; `SESSION_SECRET`/`APP_PASSWORD` now fail-fast at startup (no public-default fallback).

## Song rating + performability status + filters
Performability `status` is a plain `text` column (notNull, default `'new'`) backed by a Zod enum (`new`/`practicing`/`polishing`/`performance_ready`) — **not** a Postgres enum. `rating` is a nullable integer 1–5. Rating + status filtering (range min/max + status multi-select) is **purely client-side** via `songMatchesFilters` in `artifacts/songbook/src/lib/songMeta.ts`, applied in BOTH the library list and set mode (set mode preserves original 1-based positions by numbering before filtering).

**Why:** A text column + Zod enum means adding a new status is a spec+code change with **no DB migration** (mirrors the `spotifyLink`/`mediaType` backward-compat philosophy elsewhere in this file). Client-side filtering avoids new query params/endpoints/codegen for what is a small in-memory list.

**How to apply:** (1) To add a status value, extend `STATUS_OPTIONS` + the OpenAPI enum + regenerate — no migration. (2) Clearing a nullable field like `rating` relies on **null vs undefined**: the editor always sends `rating` as `number | null` and `SongUpdate.rating` is `.nullish()`, so `null` = clear, omitted = unchanged — never coerce a cleared rating to `undefined`. (3) Any new song-list projection (e.g. `getSetWithSongs` in `sets.ts`) MUST select `rating` + `status`, or set-mode filters/indicators silently break. (4) Local `status` state is typed as the `SongStatus` union and cast only at the Radix Select boundary (`onValueChange` gives a plain `string`).

## Lib rebuild rule
After changing `lib/db/src/schema/` or `lib/api-spec/openapi.yaml`, always run `pnpm run typecheck:libs` before checking leaf packages. Missing exports from `@workspace/db` are almost always stale declarations, not bad imports.
