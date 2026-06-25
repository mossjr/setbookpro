import { useEffect, type ReactNode } from "react";
import { useAppStore, useGigStore } from "@/store";
import { getSocket, disconnectSocket } from "@/lib/socket";

/**
 * Owns the single socket lifecycle for the live gig session. Mounted once,
 * inside the auth boundary, so it only connects with a valid token. All
 * inbound events funnel into useGigStore; components read from there.
 */
export default function GigProvider({ children }: { children: ReactNode }) {
  const token = useAppStore((s) => s.token);

  useEffect(() => {
    if (!token) {
      // Logged out: tear the socket down so a future login reconnects fresh.
      disconnectSocket();
      useGigStore.getState().reset();
      return;
    }

    const socket = getSocket();
    const gig = useGigStore.getState;

    const onConnect = () => {
      gig().setIdentity(socket.id ?? null);
      gig().setConnected(true);
    };
    const onDisconnect = () => gig().setConnected(false);

    const handlers = {
      sync_state: gig().applySync,
      present: gig().applyPresent,
      host_changed: ({ hostId }: { hostId: string | null }) => {
        gig().applyHostChanged(hostId);
        // Host went away -> nothing should keep auto-scrolling.
        if (hostId === null) gig().pushScroll({ type: "stop", fraction: 0, ms: 0 });
      },
      scroll_start: (p: { fraction: number; durationMs: number }) =>
        gig().pushScroll({ type: "start", fraction: p.fraction, ms: p.durationMs }),
      scroll_seek: (p: { fraction: number; remainingMs: number }) =>
        gig().pushScroll({ type: "seek", fraction: p.fraction, ms: p.remainingMs }),
      scroll_stop: (p: { fraction: number }) =>
        gig().pushScroll({ type: "stop", fraction: p.fraction, ms: 0 }),
    } as const;

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("sync_state", handlers.sync_state);
    socket.on("present", handlers.present);
    socket.on("host_changed", handlers.host_changed);
    socket.on("scroll_start", handlers.scroll_start);
    socket.on("scroll_seek", handlers.scroll_seek);
    socket.on("scroll_stop", handlers.scroll_stop);

    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("sync_state", handlers.sync_state);
      socket.off("present", handlers.present);
      socket.off("host_changed", handlers.host_changed);
      socket.off("scroll_start", handlers.scroll_start);
      socket.off("scroll_seek", handlers.scroll_seek);
      socket.off("scroll_stop", handlers.scroll_stop);
    };
  }, [token]);

  return <>{children}</>;
}
