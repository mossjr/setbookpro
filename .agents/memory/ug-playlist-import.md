---
name: UG shared-playlist import
description: How to read an Ultimate Guitar shared playlist server-side, and why a JS-rendering scraper is required.
---

# Reading a UG shared playlist (`/user/playlist/shared?h=<hash>`)

A UG shared-playlist link is genuinely public in a browser, but **cannot** be read by a plain server request:
- The web page is behind Cloudflare bot protection — a direct `fetch` from a datacenter IP returns a 403 "Just a moment" challenge page with zero playlist data, regardless of browser-like headers.
- The UG mobile API playlist endpoints (`/list/songbook/tab`, `/list/songbook/collection`) require a logged-in UG account (401). The share `h=` hash is **not** accepted by the mobile API.

**Why:** Cloudflare JS challenge needs a real browser; the hash is only consumed by the Cloudflare-protected web page.

**How to apply:** Use a JS-rendering scraper to fetch the rendered HTML, then parse it.
- We use Firecrawl (`POST https://api.firecrawl.dev/v1/scrape`, `formats:["rawHtml"]`, `Authorization: Bearer $FIRECRAWL_API_KEY`). It clears Cloudflare and returns the full rendered HTML (~480KB). No managed/no-key Replit integration for Firecrawl exists, so the app calls Firecrawl's REST API directly with a user-provided key.
- The shared-playlist page does NOT use the `js-store` `data-content` JSON that UG tab pages use. Instead, parse the rendered table anchors: each song is `<a href="https://tabs.ultimate-guitar.com/tab/<artist-slug>/<song-slug>-<tabId>">Song Title</a>`. Tab id = trailing digits; title = anchor text; artist ≈ artist-slug (approximate — prefer the authoritative title/artist from the mobile `/tab/info` fetch at import time).
- Playlist name comes from the page `<h1>` / `<title>` (strip the trailing " @ Ultimate-Guitar.Com").
- Dedupe entries by tab id (the table repeats some anchors).

**Security — validate the URL before scraping (required):**
The playlist-preview endpoint forwards a user-supplied URL to Firecrawl. Without an allowlist it becomes an authenticated arbitrary-URL scraping proxy that burns the Firecrawl quota (SSRF-style abuse). `isUgPlaylistUrl()` in `lib/ug.ts` enforces: parses via `new URL`, `https:` only, host `ultimate-guitar.com`/`www.ultimate-guitar.com`, pathname `/user/playlist/shared`, non-empty `h` param, length ≤ 2048. Reject with 400 *before* calling Firecrawl.
**Why:** single-password auth does not make the endpoint safe — any logged-in client could otherwise scrape anything on our dime.

**Gotchas:**
- The Replit `externalApi__firecrawl` passthrough callback (agent sandbox) is buggy — it mangles the URL ("URL must have a valid top-level domain"). Don't rely on it; the deployed app uses the real Firecrawl REST API with the key.
- The code_execution sandbox does NOT have user secrets in its env; verify scraper logic from the shell/api-server env instead (the shell has the secrets).
