"use client";

import { io, Socket } from "socket.io-client";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";

export interface WsClient {
  connect: (token: string) => void;
  disconnect: () => void;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  off: (event: string, handler: (...args: unknown[]) => void) => void;
  isConnected: () => boolean;
  getSocket: () => Socket | null;
}

export function createWsClient(): WsClient {
  let socket: Socket | null = null;

  const connect = (token: string) => {
    if (socket?.connected) {
      return;
    }

    socket = io(`${WS_URL}/ws`, {
      auth: { token },
      query: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    });

    socket.on("connect", () => {
      // Connection established
    });

    socket.on("error", (err: unknown) => {
      console.error("[ws] Server error:", err);
    });

    socket.on("connect_error", (err: Error) => {
      console.error("[ws] Connection error:", err.message);
    });
  };

  const disconnect = () => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  };

  const subscribe = (channel: string) => {
    socket?.emit("subscribe", { channel });
  };

  const unsubscribe = (channel: string) => {
    socket?.emit("unsubscribe", { channel });
  };

  const on = (event: string, handler: (...args: unknown[]) => void) => {
    socket?.on(event, handler);
  };

  const off = (event: string, handler: (...args: unknown[]) => void) => {
    socket?.off(event, handler);
  };

  const isConnected = () => socket?.connected ?? false;

  const getSocket = () => socket;

  return {
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    on,
    off,
    isConnected,
    getSocket,
  };
}
