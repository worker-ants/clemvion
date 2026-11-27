// 근거: [EIA 데이터와 흐름 「SSE 스트림」](CLE-EIA-DATA#sse-스트림), NERV Task `CLE-T-Z35F7P` · `CLE-T-1GR2JE` · `CLE-T-FHG7MT`.
// EIA SSE 의 시간 · 개수 · 크기 상수를 한 곳에 둔다. 컨트롤러 · 어댑터 · Redis 전달 코드와 e2e 가 함께 읽는다.
// 이 파일은 다른 모듈을 import 하지 않는다.

/** 재연결 replay 를 받아 주는 기간(ms). 버퍼 키의 TTL 이기도 하다. */
export const SSE_REPLAY_WINDOW_MS = 5 * 60 * 1000;

/** 실행 하나의 버퍼에 두는 이벤트 수의 상한. Redis 는 `MAXLEN ~` 라 조금 넘길 수 있다. */
export const SSE_BUFFER_MAX_EVENTS = 1000;

/** SSE heartbeat 주석을 보내는 간격(ms). 연결 상한의 member 점수도 이 간격으로 갱신한다. */
export const SSE_HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * `itk_*` 로 연 스트림이 토큰을 다시 확인하는 주기(ms). heartbeat 몇 번마다 한 번으로 센다. 이 주기를 둔 이유는
 * `InteractionStreamController` 의 JSDoc 에 있다.
 */
export const SSE_TOKEN_RECHECK_INTERVAL_MS = 60_000;

/** 연결 상한 member 를 오래됐다고 보는 시간(ms). heartbeat 간격의 3배다. 키 TTL 도 같다. */
export const SSE_CONNECTION_SLOT_TTL_MS = 3 * SSE_HEARTBEAT_INTERVAL_MS;

/** 실행 하나에 동시에 열 수 있는 SSE 연결 수. 모든 서버 인스턴스를 합쳐 센다. */
export const SSE_MAX_CONNECTIONS_PER_EXECUTION = 3;

/**
 * Redis 에 올리는 메시지 하나의 최대 크기(UTF-8 바이트). 넘으면 이벤트 대신 생략 표시만 올리고 이벤트 전체는 이 서버
 * 인스턴스의 메모리 버퍼에 둔다. 종료 이벤트는 스트림을 끝내는 이벤트라 상한을 적용하지 않는다. 정한 값이고 재 본 값이
 * 아니다. 근거: CLE-EIA-DATA Rationale 「SSE 의 Redis 쓰기를 줄이고 구독 공백을 메운다」, NERV Task `CLE-T-XPG8DQ`.
 */
export const SSE_BUFFER_MAX_MESSAGE_BYTES = 64 * 1024;

/** 스트림을 끝내는 종료 이벤트. */
export const SSE_TERMINAL_EVENT_TYPES: ReadonlySet<string> = new Set([
  'execution.completed',
  'execution.failed',
  'execution.cancelled',
]);

/** 구독 전용 연결의 이름(`CLIENT SETNAME`). 운영에서 연결을 알아볼 때와 e2e 가 연결 끊김을 만들 때 쓴다. */
export const SSE_SUBSCRIBER_CONNECTION_NAME = 'eia-sse-sub';
