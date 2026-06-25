import http from "http";
import { Server as SocketServer } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  HostMode,
  SyncState,
} from "@workspace/gig-protocol";
import app from "./app";
import { logger } from "./lib/logger";
import { verifyToken } from "./lib/auth";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = http.createServer(app);

const io = new SocketServer<ClientToServerEvents, ServerToClientEvents>(
  httpServer,
  {
    cors: { origin: "*" },
    path: "/ws/socket.io",
  },
);

// Every socket must present the same JWT used for the REST API. Without this
// any client reaching /ws/socket.io could claim host and drive every device.
io.use((socket, next) => {
  const token = socket.handshake.auth?.["token"];
  if (typeof token === "string" && verifyToken(token)) {
    next();
    return;
  }
  next(new Error("unauthorized"));
});

// --- Single implicit global gig session (server-authoritative) -------------
// One band, one shared password => one session. The newest claim wins and
// demotes any prior host; late joiners get a full snapshot via `sync_state`.
let hostId: string | null = null;
let songId: string | null = null;
let transpose = 0;
let hostMode: HostMode = "scroll";
// `fraction` is the start position at `startedAt`; `durationMs` is the time
// from there to the bottom (1.0). We derive current progress on demand.
let scroll: { fraction: number; durationMs: number; startedAt: number } | null =
  null;

const clamp01 = (n: number) =>
  Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
const sanitizeMode = (m: unknown): HostMode => (m === "page" ? "page" : "scroll");

/** Snapshot of the session, with scroll progress advanced to "now". */
function currentSync(): SyncState {
  let s: SyncState["scroll"] = null;
  if (scroll) {
    const elapsed = Date.now() - scroll.startedAt;
    const remainingMs = scroll.durationMs - elapsed;
    if (remainingMs > 0) {
      const progress =
        scroll.durationMs > 0 ? Math.min(1, elapsed / scroll.durationMs) : 1;
      const fraction = scroll.fraction + (1 - scroll.fraction) * progress;
      s = { fraction, remainingMs };
    } else {
      scroll = null;
    }
  }
  return { hostId, songId, transpose, hostMode, scroll: s };
}

io.on("connection", (socket) => {
  logger.info({ socketId: socket.id }, "Socket connected");

  // Bring the new arrival up to speed immediately.
  socket.emit("sync_state", currentSync());

  socket.on("claim_host", (payload) => {
    hostId = socket.id;
    songId = payload?.songId ?? null;
    transpose = Number.isFinite(payload?.transpose) ? payload.transpose : 0;
    hostMode = sanitizeMode(payload?.hostMode);
    scroll = null;
    logger.info({ socketId: socket.id, songId }, "Host claimed");
    io.emit("host_changed", { hostId });
    io.emit("present", { songId, transpose, hostMode });
  });

  socket.on("release_host", () => {
    if (socket.id !== hostId) return;
    hostId = null;
    scroll = null;
    logger.info({ socketId: socket.id }, "Host released");
    io.emit("host_changed", { hostId: null });
  });

  socket.on("host_present", (payload) => {
    if (socket.id !== hostId) return;
    songId = payload?.songId ?? null;
    transpose = Number.isFinite(payload?.transpose) ? payload.transpose : 0;
    hostMode = sanitizeMode(payload?.hostMode);
    // A song/mode change cancels any in-flight scroll.
    scroll = null;
    socket.broadcast.emit("present", { songId, transpose, hostMode });
  });

  socket.on("host_scroll_start", (payload) => {
    if (socket.id !== hostId) return;
    scroll = {
      fraction: clamp01(payload?.fraction),
      durationMs: Math.max(0, payload?.durationMs ?? 0),
      startedAt: Date.now(),
    };
    socket.broadcast.emit("scroll_start", {
      fraction: scroll.fraction,
      durationMs: scroll.durationMs,
    });
  });

  socket.on("host_scroll_seek", (payload) => {
    if (socket.id !== hostId) return;
    scroll = {
      fraction: clamp01(payload?.fraction),
      durationMs: Math.max(0, payload?.remainingMs ?? 0),
      startedAt: Date.now(),
    };
    socket.broadcast.emit("scroll_seek", {
      fraction: scroll.fraction,
      remainingMs: scroll.durationMs,
    });
  });

  socket.on("host_scroll_stop", (payload) => {
    if (socket.id !== hostId) return;
    scroll = null;
    socket.broadcast.emit("scroll_stop", { fraction: clamp01(payload?.fraction) });
  });

  socket.on("disconnect", () => {
    if (socket.id === hostId) {
      hostId = null;
      scroll = null;
      io.emit("host_changed", { hostId: null });
    }
    logger.info({ socketId: socket.id }, "Socket disconnected");
  });
});

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening");
});
