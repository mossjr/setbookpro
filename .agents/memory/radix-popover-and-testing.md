---
name: Radix popover trigger gotcha
description: Why a tappable element that opens a popover AND must stop event bubbling should use controlled + PopoverAnchor, not PopoverTrigger
---

## A child onClick on `PopoverTrigger asChild` can stop the popover opening
When you wrap an element in `<PopoverTrigger asChild>` AND give that child its own
`onClick` (e.g. to `stopPropagation` so the click doesn't bubble to an ancestor
frame handler), the child's handler can shadow Radix's internal open-toggle — the
popover then never opens, even on a direct DOM `.click()`.

**Fix that works:** make the popover **controlled** (`open`/`onOpenChange` state) and
use `<PopoverAnchor asChild>` instead of `PopoverTrigger`. The anchor child's own
`onClick` then fully owns opening (`setOpen(true)` + `stopPropagation`), with no Radix
handler to collide with. Outside-click / Escape still close it via `onOpenChange`.

**Why:** `asChild` prop-merge does not reliably compose the child's `onClick` with the
trigger's toggle in every Radix version; treating the element as an Anchor and driving
state yourself is deterministic.

**How to apply:** Any tappable inline element that opens a popover AND must block
bubbling (chord tokens over the song frame, table-cell actions, etc.) → controlled +
PopoverAnchor, not PopoverTrigger. Trade-off: re-clicking the same anchor won't close
it (anchor isn't a trigger); rely on outside-click/Escape, which is conventional.
