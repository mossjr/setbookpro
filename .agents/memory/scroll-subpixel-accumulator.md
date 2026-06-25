---
name: rAF scroll sub-pixel accumulator
description: Why slow auto-scroll stalls when driven directly off scrollTop, and the float-accumulator fix
---

# Slow auto-scroll stalls: sub-pixel rAF accumulation

**Rule:** When animating scroll position in a requestAnimationFrame loop, do NOT
do `el.scrollTop += speed * dt` and read `scrollTop` back each frame. The browser
rounds `scrollTop` to whole (or sub-) pixels, so any per-frame delta below ~1px
(roughly any speed under ~60px/s at 60fps) rounds away to zero — the scroll
crawls slower and slower, then stalls completely. Keep a float accumulator
(`posRef`) seeded once from `el.scrollTop`, advance the accumulator each frame,
and write `el.scrollTop = posRef`. Reset the accumulator to null on stop/begin.

**Why:** SongBook's auto-scroll "slowed to a level then stopped, couldn't crawl
really slow." Root cause was exactly this rounding loss in `ScrollScrubber`'s
step loop, not a min-speed floor (the settings slider already floored at 2px/s).

**How to apply:** Applies to any rAF-driven scroll/position animation in this app
(auto-scroll, and any future metronome-synced or smooth-scroll feature). The same
class of bug bites any code that treats a browser-rounded DOM property as its own
accumulator. Trade-off: the accumulator does not resync if the user manually
scrolls mid-animation, so it can fight/snap — reseed from `el.scrollTop` on user
scroll if that ever matters.
