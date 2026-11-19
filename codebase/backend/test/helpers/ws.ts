import { io, Socket } from 'socket.io-client';

/**
 * WebSocket e2e 공용 헬퍼. 백엔드 게이트웨이(`/ws` 네임스페이스)에 붙는 소켓을 만들고 이벤트를 기다린다.
 *
 * 이벤트 대기는 정해진 시간 안에 오지 않으면 실패한다. 기다리는 동안 `failOn` 의 이벤트가 먼저 오면 그
 * payload 를 실패 메시지에 싣고 바로 실패한다. 그래서 서버가 `exception` 으로 핸들러를 끝낸 경우 10초
 * 시간 초과 대신 서버가 보낸 사유가 보인다.
 */
export const WS_EVENT_TIMEOUT_MS = 10_000;

export interface WaitForEventOptions {
  /** 이 시간 안에 오지 않으면 실패한다. 기본 {@link WS_EVENT_TIMEOUT_MS}. */
  readonly timeoutMs?: number;
  /**
   * 기다리는 동안 이 이벤트가 오면 실패한다. 기본 `['exception']`(게이트웨이 핸들러가 던진 예외).
   * 기다리는 이벤트와 같은 이름은 무시한다.
   */
  readonly failOn?: readonly string[];
}

/** 실패 메시지에 싣기 위해 payload 를 한 줄로 적는다. `connect_error` 는 `Error` 를 넘긴다. */
function describePayload(payload: unknown): string {
  if (payload instanceof Error) return payload.message;
  try {
    return JSON.stringify(payload) ?? String(payload);
  } catch {
    return String(payload);
  }
}

/**
 * `event` 를 한 번 기다린다. 끝나면(성공 · 실패 · 시간 초과) 이 호출이 붙인 리스너를 모두 뗀다.
 *
 * 같은 소켓에서 두 이벤트를 함께 기다리면 `Promise.all` 로 묶는다. 하나씩 `await` 하면 앞의 것이 실패할 때
 * 뒤의 것의 거부를 아무도 받지 않아 unhandled rejection 이 난다.
 */
export function waitForEvent<T>(
  socket: Socket,
  event: string,
  {
    timeoutMs = WS_EVENT_TIMEOUT_MS,
    failOn = ['exception'],
  }: WaitForEventOptions = {},
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const failListeners: Array<[string, (payload: unknown) => void]> = [];
    const cleanup = () => {
      clearTimeout(timer);
      socket.off(event, onEvent);
      for (const [name, listener] of failListeners) socket.off(name, listener);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`${event} 를 ${timeoutMs}ms 안에 받지 못했다`));
    }, timeoutMs);
    const onEvent = (payload: T) => {
      cleanup();
      resolve(payload);
    };
    socket.once(event, onEvent);
    for (const name of failOn) {
      if (name === event) continue;
      const listener = (payload: unknown) => {
        cleanup();
        reject(
          new Error(
            `${event} 를 기다리는 중 ${name} 를 받았다: ${describePayload(payload)}`,
          ),
        );
      };
      failListeners.push([name, listener]);
      socket.on(name, listener);
    }
  });
}

export interface ConnectWsOptions {
  /**
   * 소켓을 만든 직후 `connect` 를 기다리기 전에 부른다. 서버가 연결 직후 보내는 이벤트(예:
   * `auth.token_expired`)를 기다리려면 여기서 리스너를 붙인다. 이벤트는 비동기로 오므로 이 안에서
   * 동기로 붙인 리스너는 놓치지 않는다.
   */
  readonly onCreated?: (socket: Socket) => void;
}

/**
 * access token 으로 `/ws` 에 붙고 `connect` 를 기다린다. 서버가 handshake 를 거절하면(`connect_error`) 그
 * 사유로 실패하고 소켓을 닫는다. 재연결은 끈다. 다시 붙는 흐름은 테스트가 새 소켓으로 직접 만든다.
 */
export async function connectWs(
  baseUrl: string,
  accessToken: string,
  { onCreated }: ConnectWsOptions = {},
): Promise<Socket> {
  const socket = io(`${baseUrl}/ws`, {
    auth: { token: accessToken },
    transports: ['websocket'],
    reconnection: false,
  });
  onCreated?.(socket);
  try {
    await waitForEvent(socket, 'connect', { failOn: ['connect_error'] });
  } catch (err) {
    socket.close();
    throw err;
  }
  return socket;
}

/** `subscribed` 응답 모양([WebSocket 메시지 「채널 구독」](CLE-API-WS-MSG#4-채널-구독)). */
export interface SubscribedAck {
  readonly success: boolean;
  readonly channel?: string;
  readonly error?: string;
  readonly code?: string;
}
