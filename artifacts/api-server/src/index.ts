import http from "http";
import { Server as SocketServer } from "socket.io";
import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = http.createServer(app);

const io = new SocketServer(httpServer, {
  cors: { origin: "*" },
  path: "/ws/socket.io",
});

const hostRooms = new Map<string, string>(); // code -> socketId

io.on("connection", (socket) => {
  logger.info({ socketId: socket.id }, "Socket connected");

  socket.on("become_host", () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    hostRooms.set(code, socket.id);
    socket.join(`room:${code}`);
    socket.data.hostCode = code;
    socket.data.isHost = true;
    socket.emit("host_code", { hostCode: code });
    logger.info({ code }, "Host created");
  });

  socket.on("join_host", ({ code }: { code: string }) => {
    const hostSocketId = hostRooms.get(code);
    if (!hostSocketId) {
      socket.emit("join_error", { error: "Room not found" });
      return;
    }
    socket.join(`room:${code}`);
    socket.data.roomCode = code;
    socket.data.isHost = false;
    socket.emit("joined", { code });
    logger.info({ code }, "Participant joined");
  });

  socket.on("song_change", ({ songId }: { songId: string }) => {
    if (!socket.data.isHost) return;
    const code = socket.data.hostCode as string;
    socket.to(`room:${code}`).emit("song_change", { songId });
  });

  socket.on("scroll_sync", ({ position, speed }: { position: number; speed: number }) => {
    if (!socket.data.isHost) return;
    const code = socket.data.hostCode as string;
    socket.to(`room:${code}`).emit("scroll_sync", { position, speed });
  });

  socket.on("disconnect", () => {
    if (socket.data.isHost && socket.data.hostCode) {
      hostRooms.delete(socket.data.hostCode as string);
    }
    logger.info({ socketId: socket.id }, "Socket disconnected");
  });
});

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening");
});
