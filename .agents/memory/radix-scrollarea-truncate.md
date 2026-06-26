---
name: Radix ScrollArea breaks truncate / causes horizontal overflow
description: Why text-truncate and width constraints fail inside a Radix ScrollArea, and the fix.
---

Radix `ScrollArea` (`@radix-ui/react-scroll-area`) renders its `Viewport`'s
direct child as a wrapper with inline `display:table; min-width:100%`. A table
box sizes to its **widest** descendant, so any wide child (e.g. a long song
title row) makes the whole scroll content wider than the sidebar/container.

**Symptom:** `truncate` / `min-w-0` / `flex-1` on inner children have no effect,
and sibling controls in the same scroll content (e.g. a banner's "Exit" button)
get pushed off the right edge out of the visible width.

**Fix:** force the viewport child to behave as a block constrained to 100%:
add `[&>div]:!block [&>div]:!min-w-0` to the `Viewport` className in
`components/ui/scroll-area.tsx`. `!important` is required because Radix sets the
display via inline style. We don't use horizontal scrolling, so disabling the
table-measure trick is safe.

**Why:** this is the standard shadcn fix for the exact truncation bug. Applying
it at the shared `ScrollArea` component fixes every list that scrolls.

**How to apply:** if truncation or width clamping misbehaves anywhere inside a
ScrollArea, suspect this before adding more `shrink-0`/`min-w-0` to children.
