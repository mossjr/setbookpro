import { getSocket } from "./socket";
import type {
  PresentState,
  ScrollStartPayload,
  ScrollSeekPayload,
} from "@workspace/gig-protocol";

// Thin client->server emitters for the gig session. State that comes *back*
// from the server is handled by GigProvider + useGigStore.

export const claimHost = (present: PresentState) =>
  getSocket().emit("claim_host", present);

export const releaseHost = () => getSocket().emit("release_host");

export const hostPresent = (present: PresentState) =>
  getSocket().emit("host_present", present);

export const hostScrollStart = (payload: ScrollStartPayload) =>
  getSocket().emit("host_scroll_start", payload);

export const hostScrollSeek = (payload: ScrollSeekPayload) =>
  getSocket().emit("host_scroll_seek", payload);

export const hostScrollStop = (fraction: number) =>
  getSocket().emit("host_scroll_stop", { fraction });
