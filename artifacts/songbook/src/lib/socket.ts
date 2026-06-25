import { io, Socket } from "socket.io-client";
import { useAppStore } from "@/store";

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    socket = io("/", {
      path: "/ws/socket.io",
      transports: ["websocket", "polling"],
      auth: {
        token: localStorage.getItem("songbook_token")
      }
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