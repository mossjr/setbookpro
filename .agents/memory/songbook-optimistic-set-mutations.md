---
name: SongBook optimistic set mutations
description: Convention for optimistic set-detail mutations (reorder/remove) so out-of-order responses don't corrupt state
---

# Optimistic set-detail mutations

Set-detail mutations (reorder, remove-from-set, and any future set-membership
edit) in `Set.tsx` share a single monotonic token (`opSeqRef`). Each operation
increments the token, awaits `cancelQueries(setKey)`, snapshots `previous`,
writes the optimistic cache, then on settle only applies its server payload /
rollback **if its token is still the latest**.

**Why:** these all mutate the same `getGetSetQueryKey(setId)` cache entry. The
reorder endpoint takes the *full* ordering, so a stale response or rollback that
lands after a newer operation will silently revert the user's latest intent
(drag/renumber/remove in quick succession). The token guard makes late responses
no-ops.

**How to apply:** any new optimistic flow that touches a set's `songs` must join
the same `opSeqRef` guard — increment at start, check `token === opSeqRef.current`
before writing in `onSuccess`/`onError`. On error prefer restoring the snapshot
or refetching authoritative state; never blindly write a captured server payload
unconditionally. Note this guards out-of-order *responses*, not server-side
request ordering (acceptable for this single-user app).
