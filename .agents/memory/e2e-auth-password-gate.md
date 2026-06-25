---
name: E2E testing the password-gated app
description: How to authenticate Playwright/runTest e2e against SongBook's single-password JWT gate, and a sandbox env caveat.
---

# E2E auth for the password-gated SongBook

SongBook is gated by single-password JWT auth (`APP_PASSWORD` -> JWT signed with `SESSION_SECRET`, stored in the persisted Zustand state under localStorage key `songbook-app-state`, and also `songbook_token`). A fresh Playwright browser context starts unauthenticated, so e2e flows must log in first.

**Why this is fiddly:** the `code_execution` sandbox does NOT expose `process.env` (reading `process.env.SESSION_SECRET` throws). So you cannot mint a JWT in the sandbox the "obvious" way.

**How to apply** (when you actually need a logged-in e2e run):
- Preferred: drive the real UI login — type the password into the Login page ("Enter Stage") via the test. The password value must come from `APP_PASSWORD`; do not hardcode/print it.
- To mint a token instead, you need `SESSION_SECRET` (HS256 over `{auth:true,iat,exp}`); retrieve it via the environment-secrets tooling (`viewEnvVars`), never via `process.env` in the sandbox, and never print it.
- Verifying without a browser: an `[API]`/`fetch` smoke against `localhost:80/api/sets` with `Authorization: Bearer <token>` confirms data shape; `GET /sets/:id` returns `set.songs` ordered by `sortOrder`.

**Cheaper signal:** the api-server request logs already reveal live usage — a `GET /api/sets/:id` followed by several `GET /api/songs/:id` is the set-open + prev/next navigation flow, which often makes a dedicated e2e unnecessary for contained client-side changes.
