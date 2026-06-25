import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@workspace/gig-protocol";

export type GigSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GigSocket | null = null;

export const getSocket = (): GigSocket => {
  if (!socket) {
    socket = io("/", {
      path: "/ws/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: false,
      // Function form so the *current* token is read on every (re)connect,
      // not just when the singleton was first created.
      auth: (cb) =>
        cb({ token: localStorage.getItem("songbook_token") ?? "" }),
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
