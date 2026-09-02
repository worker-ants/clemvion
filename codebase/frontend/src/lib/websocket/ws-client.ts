import { io, Socket } from "socket.io-client";
import { refreshAccessToken } from "../api/client";
import { WS_BASE_URL } from "../api/constants";

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
    // m-3 (06 concurrency) — pending 가드. `connected` 만 보면 연결 **진행 중**
    // (handshake/reconnect 대기) 재호출 시 아래에서 disconnect+재생성해 churn·
    // listener 누수가 생긴다. socket.io `active` 는 연결 시도·reconnect 대기까지
    // 포함하므로 이를 함께 가드한다. (토큰 갱신 재연결은 이 함수가 아니라
    // connect_error 핸들러가 기존 인스턴스의 auth 갱신 후 재연결하므로 무영향.)
    if (socket && (socket.connected || socket.active)) {
      return;
    }

    if (socket) {
      socket.disconnect();
    }

    socket = io(`${WS_BASE_URL}/ws`, {
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

    // §1.2/§9.2 — 소켓 수명이 토큰 수명에 종속된다. 서버가 만료 60초 전
    // `auth.token_expired` 를 통지하고 `exp` 에 `disconnect()` 한다.
    //
    // **위 `connect_error` 경로로는 못 잡는다.** 그쪽은 *연결 시도가 실패*할 때 발화하고,
    // 여기서 다루는 것은 *이미 연결된* 소켓이 서버에 의해 끊기는 경우다. 그리고
    // **Socket.IO 자동 재연결은 서버발신 `disconnect()` 에 발화하지 않는다**
    // (reason `"io server disconnect"`, §6.1 예외) — 명시적 `connect()` 가 필요하다.
    // 이 두 경로가 없으면 사용자는 조용히 연결을 잃는다.
    const refreshAndReconnect = async (why: string) => {
      try {
        const newToken = await refreshAccessToken();
        if (newToken && socket) {
          (socket.auth as { token: string }).token = newToken;
          socket.connect();
        }
      } catch (refreshErr) {
        console.error(`[ws] Token refresh failed (${why}):`, refreshErr);
      }
    };

    // 정상 경로 — 통지 창(60초) 안에 갈아탄다. 성공하면 끊김이 보이지 않는다.
    socket.on("auth.token_expired", () => {
      void refreshAndReconnect("auth.token_expired");
    });

    // fallback — 백그라운드 탭 등으로 통지를 놓친 경우. **reason 을 좁게 본다**:
    // 그 밖의 disconnect(transport close 등)까지 가로채면 Socket.IO 내장 백오프와
    // 이중으로 붙어 재연결 폭풍이 된다.
    socket.on("disconnect", (reason: string) => {
      if (reason !== "io server disconnect") return;
      void refreshAndReconnect("io server disconnect");
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
