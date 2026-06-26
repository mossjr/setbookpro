---
name: songbook static asset imports
description: Why @assets imports fail typecheck in the songbook artifact and what to do instead
---

# Importing image/static assets in `artifacts/songbook`

The Vite config defines an `@assets` alias (→ repo `attached_assets/`), but
`artifacts/songbook/tsconfig.json` only maps `@/*`, and there is no `*.png`
ambient module declaration. So `import icon from "@assets/foo.png"` resolves at
Vite build time yet **fails `tsc --noEmit` typecheck** (no path mapping + no
module type).

**Rule:** to use an attached image in this artifact, copy it into
`artifacts/songbook/public/` and reference it by a root-absolute URL
(e.g. `src="/foo.png"`). The artifact is served/proxied at `/`, so root-absolute
public URLs resolve correctly — this matches the existing favicon pattern.

**Why:** avoids touching tsconfig paths + adding a png module decl just to use one
image, and keeps consistency with how favicons/manifest icons are already
referenced.

**How to apply:** any time you add an image/font/static asset for the React PWA,
prefer `public/` + URL over an `@assets` import unless you also add the tsconfig
path mapping and a `*.png` module declaration.
