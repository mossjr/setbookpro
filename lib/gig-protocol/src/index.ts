// Shared Socket.io contract for the live HOST/PARTICIPANT gig session.
// Imported by both the API server and the songbook client so the wire
// protocol stays in lockstep across packages.

export type HostMode = "scroll" | "page";

/** What the host is currently presenting. Participants mirror this. */
export interface PresentState {
  songId: string | null;
  transpose: number;
  hostMode: HostMode;
}

export interface ScrollStartPayload {
  /** 0..1 position within the scrollable range to begin from. */
  fraction: number;
  /** Time, in ms, to travel from `fraction` to the bottom (1.0). */
  durationMs: number;
}

export interface ScrollStopPayload {
  fraction: number;
}

export interface ScrollSeekPayload {
  fraction: number;
  /** Time, in ms, remaining from `fraction` to the bottom. */
  remainingMs: number;
}

/** Current scroll progress, normalized so any font size lands together. */
export interface SyncScroll {
  fraction: number;
  remainingMs: number;
}

/** Full session snapshot sent to a socket on connect (and after claims). */
export interface SyncState {
  hostId: string | null;
  songId: string | null;
  transpose: number;
  hostMode: HostMode;
  scroll: SyncScroll | null;
}

export interface ClientToServerEvents {
  claim_host: (payload: PresentState) => void;
  release_host: () => void;
  host_present: (payload: PresentState) => void;
  host_scroll_start: (payload: ScrollStartPayload) => void;
  host_scroll_stop: (payload: ScrollStopPayload) => void;
  host_scroll_seek: (payload: ScrollSeekPayload) => void;
}

export interface ServerToClientEvents {
  sync_state: (payload: SyncState) => void;
  host_changed: (payload: { hostId: string | null }) => void;
  present: (payload: PresentState) => void;
  scroll_start: (payload: ScrollStartPayload) => void;
  scroll_stop: (payload: ScrollStopPayload) => void;
  scroll_seek: (payload: ScrollSeekPayload) => void;
}
