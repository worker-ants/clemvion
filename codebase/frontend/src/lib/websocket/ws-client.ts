import { io, Socket } from "socket.io-client";
import { refreshAccessToken } from "../api/client";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";

export interface WsClient {
  connect: (token: string) => void;
  disconnect: () => void;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  off: (event: string, handler: (...args: unknown[]) => void) => void;
  once: (event: string, handler: (...args: unknown[]) => void) => void;
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

    socket.on("error", (err: unknown) => {
      console.error("[ws] Server error:", err);
    });

    // Carousel disabled stuck 버그 fix — 첫 connect_error 시 일단 token refresh
    // + 명시적 재연결 한 번 시도. socket.io 자체 reconnect 는 같은 stale token
    // 으로 무한 재시도하므로 auth race 시 영구 실패한다. 첫 실패 message 가
    // "Unauthorized" / "401" 등이 아닐 수도 있어 (browser 가 "WebSocket is
    // closed before the connection is established" 같은 generic 메시지를
    // 보내는 경우 다수) 메시지 패턴 검사보다 첫 실패 1회는 무조건 refresh +
    // 재연결 시도 — 가장 흔한 root cause (auth race) 차단.
    //
    // refreshAttempted flag 가 무한 loop 방지. 정상 connect 되면 reset 해
    // 다음 disconnect 후 새 세션에서 다시 시도 가능.
    let refreshAttempted = false;
    socket.on("connect", () => {
      refreshAttempted = false;
    });
    socket.on("connect_error", async (err: Error) => {
      console.error("[ws] Connection error:", err.message);
      if (refreshAttempted) return;
      refreshAttempted = true;
      try {
        const newToken = await refreshAccessToken();
        if (newToken && socket) {
          // socket.io 의 auth payload 를 새 token 으로 갱신 후 명시적 재연결.
          (socket.auth as { token: string }).token = newToken;
          socket.connect();
        }
      } catch (refreshErr) {
        console.error("[ws] Token refresh failed:", refreshErr);
      }
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

  const once = (event: string, handler: (...args: unknown[]) => void) => {
    socket?.once(event, handler);
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
    once,
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
