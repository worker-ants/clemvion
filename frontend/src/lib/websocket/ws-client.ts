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
  emit: (event: string, data: unknown) => void;
  isConnected: () => boolean;
  getSocket: () => Socket | null;
  waitForConnect: () => Promise<void>;
}

export function createWsClient(): WsClient {
  let socket: Socket | null = null;

  const connect = (token: string) => {
    if (socket?.connected) {
      return;
    }

    if (socket) {
      socket.disconnect();
    }

    socket = io(`${WS_URL}/ws`, {
      auth: { token },
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

  const emit = (event: string, data: unknown) => {
    socket?.emit(event, data);
  };

  const isConnected = () => socket?.connected ?? false;

  const getSocket = () => socket;

  const waitForConnect = (): Promise<void> => {
    if (socket?.connected) return Promise.resolve();
    if (!socket) return Promise.reject(new Error("Socket not initialized"));
    return new Promise<void>((resolve, reject) => {
      const s = socket!;
      const onConnect = () => {
        s.off("connect_error", onError);
        resolve();
      };
      const onError = (err: Error) => {
        s.off("connect", onConnect);
        reject(err);
      };
      s.once("connect", onConnect);
      s.once("connect_error", onError);
    });
  };

  return {
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    on,
    off,
    emit,
    isConnected,
    getSocket,
    waitForConnect,
  };
}

let singletonInstance: WsClient | null = null;

export function getWsClient(): WsClient {
  if (!singletonInstance) {
    singletonInstance = createWsClient();
  }
  return singletonInstance;
}

export function resetWsClient(): void {
  if (singletonInstance) {
    singletonInstance.disconnect();
    singletonInstance = null;
  }
}
