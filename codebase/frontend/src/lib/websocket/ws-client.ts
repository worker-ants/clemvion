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
    // 포함하므로 이를 함께 가드한다. (토큰 갱신 재연결은 이 함수가 아니라 세 트리거
    // — `connect_error` · `auth.token_expired` · `disconnect("io server disconnect")` —
    // 가 공유하는 `refreshAndReconnect` 헬퍼가 **기존 인스턴스에서** 처리하므로 무영향.)
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

    // 토큰 재발급 → `auth.token` 교체 → 재연결. **세 트리거의 공통 몸통**이다
    // (`connect_error` · `auth.token_expired` · 서버발신 `disconnect`). 재발급 정책이
    // 바뀔 때 한쪽만 고치는 shotgun surgery 를 막으려 한 곳에 둔다(리뷰 1R W1).
    //
    // **in-flight 가드가 이 안에 있다.** 종전에는 `refreshAttempted` 가 `connect_error`
    // 트리거에만 있어 신규 두 트리거는 무가드였다(리뷰 2R W2). 재발급이 lead time 보다
    // 오래 걸리면 통지 경로의 재연결이 진행 중인 채로 서버 cutoff 가 도착하고, fallback 이
    // 두 번째 재연결을 기동해 **방금 성공한 연결을 다시 끊는다** — §9.2 계약을 좁은 타이밍
    // 창에서 다시 깨는 경로다. 가드를 트리거가 아니라 **헬퍼 안**에 두면 트리거가 늘어도
    // 자동으로 덮인다.
    let inFlight: Promise<void> | null = null;
    const refreshAndReconnect = async (why: string) => {
      if (inFlight) return inFlight;

      // **처리 대상 소켓을 진입 시점에 스냅샷한다.** `socket` 은 클로저 공유 변수라
      // `await` 사이에 `connect()` 가 다시 불리면 **다른 세대**를 가리킬 수 있다. 그때
      // 공유 변수를 그대로 쓰면 옛 세대의 재발급이 **새 소켓을 끊고 다시 붙인다** —
      // 이 PR 이 막으려던 "보이는 끊김" 이 다른 경로로 재현된다(리뷰 3R W1, 격리 재현됨).
      const mySocket = socket;

      const run = (async () => {
        try {
          const newToken = await refreshAccessToken();
          // 세대가 바뀌었으면 이 결과는 옛 소켓의 것이다 — 새 소켓을 건드리지 않는다.
          if (!newToken || !mySocket || socket !== mySocket) return;
          (mySocket.auth as { token: string }).token = newToken;

          // **`connect()` 단독은 이미 연결된 소켓에서 아무 일도 하지 않는다** —
          // socket.io-client 가 `connect() { if (this.connected) return this; }` 로 즉시
          // 반환한다(v4.8.3 실측). 사전 통지 경로는 소켓이 **연결된 채로** 도착하므로,
          // 끊지 않고 connect 만 부르면 새 토큰이 `auth` 에만 얹히고 재핸드셰이크가 없다.
          //
          // 그러면 실제 재연결은 서버가 `exp` 에 강제 종료한 뒤에야 일어나 §9.2 의 "끊김이
          // 보이지 않는다" 가 **매 토큰 주기마다** 깨진다(리뷰 1R CRITICAL #1). 명시적으로
          // 끊고 다시 붙어 그 창을 밀리초로 줄인다.
          if (mySocket.connected) mySocket.disconnect();
          mySocket.connect();
        } catch (refreshErr) {
          console.error(`[ws] Token refresh failed (${why}):`, refreshErr);
        }
      })();

      // 완료 후 **반드시 초기화**한다 — 안 하면 최초 1회 갱신 뒤 세 트리거가 영구히
      // 무시돼 두 번째 토큰 주기부터 "만료 후 무기한 인가" 가 조용히 재발한다(3R W2).
      inFlight = run.finally(() => {
        inFlight = null;
      });
      return inFlight;
    };

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
    socket.on("connect_error", (err: Error) => {
      console.error("[ws] Connection error:", err.message);
      if (refreshAttempted) return;
      refreshAttempted = true;
      // promise 를 **돌려준다** — socket.io 는 반환값을 무시하지만, 테스트가 실제 작업을
      // 기다릴 수 있어야 한다. `void` 로 버리면 `await handler()` 가 `undefined` 를 기다려
      // 단언이 작업보다 먼저 도는 vacuous 테스트가 된다(3R 에서 실제로 그랬다).
      return refreshAndReconnect("connect_error");
    });

    // §1.2/§9.2 — 소켓 수명이 토큰 수명에 종속된다. 서버가 만료 60초 전
    // `auth.token_expired` 를 통지하고 `exp` 에 `disconnect()` 한다.
    //
    // **위 `connect_error` 경로로는 못 잡는다.** 그쪽은 *연결 시도가 실패*할 때 발화하고,
    // 여기서 다루는 것은 *이미 연결된* 소켓이다. 그리고 **Socket.IO 자동 재연결은
    // 서버발신 `disconnect()` 에 발화하지 않는다**(reason `"io server disconnect"`,
    // §6.1 예외). 이 두 경로가 없으면 사용자는 조용히 연결을 잃는다.

    // 정상 경로 — 통지 창(60초) 안에 갈아탄다. 성공하면 끊김이 보이지 않는다.
    socket.on("auth.token_expired", () => {
      return refreshAndReconnect("auth.token_expired");
    });

    // fallback — 백그라운드 탭 등으로 통지를 놓친 경우. **reason 을 좁게 본다**:
    // 그 밖의 disconnect(transport close 등)까지 가로채면 Socket.IO 내장 백오프와
    // 이중으로 붙어 재연결 폭풍이 된다.
    socket.on("disconnect", (reason: string) => {
      if (reason !== "io server disconnect") return;
      return refreshAndReconnect("io server disconnect");
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
