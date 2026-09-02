/**
 * WebSocket 이벤트의 **값·타입 정의 전용** 모듈 — 의존성 0.
 *
 * ## 왜 서비스 파일에서 떼어냈나
 *
 * 이 선언들은 종전에 `websocket.service.ts` 가 함께 export 했다. 그 파일은
 * `ws.service ↔ gateway ↔ execution-engine/retry-turn ↔ event-emitter` **ES-module 순환**
 * 위에 있어서, 순환 위의 파일이 **모듈 평가 시점에** 이 enum 들을 읽으면 아직 `undefined` 다.
 *
 * 이론이 아니다 — 직전 작업(#1174)이 `type`→이벤트명 매핑을 모듈 스코프 상수로 두자
 * **72 suites 가 `Cannot read properties of undefined` 로 터졌다.** 그때는 호출 시점 지연
 * 평가로 우회했고, 이 모듈이 그 원인을 없앤다: **import 가 0줄이라 순환에 참여하지 않는다.**
 *
 * ## 무엇이 바뀌지 않았나
 *
 * DI 그래프·`forwardRef`·emit 경로는 **불변**이다. [4-execution-engine §4.4] Rationale 이
 * 유예한 것은 *"이벤트 기반 디커플링 등으로 순환을 근본 축소"* 하는 대규모 리팩터이고,
 * 이 모듈은 그 **봉인 기법을 대체하지 않는 보완 조치**다 — 값 평가 순서만 정리한다.
 *
 * `websocket.service.ts` 가 이 모듈을 re-export 하므로 기존 import 경로는 그대로 동작한다.
 */

/**
 * 외부 SSE 어댑터 (P5) 및 NotificationDispatcher (P6) 가 구독하는 fan-out stream payload.
 *
 * [Spec EIA §R10] — ExecutionEngine 단일 sink 정책 유지. emit 호출 측은 여전히
 * WebsocketService.emitExecutionEvent / emitNodeEvent 하나만. 본 service 가 facade 로
 * fan-out (socket.io + RxJS subject) 수행.
 */
export interface ExecutionChannelEvent {
  executionId: string;
  eventType: string;
  seq: number;
  /**
   * Fanout envelope — internal subscriber (SseAdapter / NotificationFanout /
   * ChatChannelDispatcher) 가 받는 payload. wire envelope (frontend 가 socket.io
   * 로 받는 payload) 와 base shape 은 같지만, execution 의 라우팅 컨텍스트
   * (`triggerId` / `chatChannel`) 가 등록되어 있으면 본 fanout envelope 에만
   * 추가로 첨부된다. 자세한 분리 이유는 {@link WebsocketService#executionRouting}.
   */
  payload: Record<string, unknown>;
}

/**
 * `ChatChannelDispatcher` 가 outbound 발송 시 라우팅에 사용하는 conversation
 * 식별자. 필수 두 필드는 [Spec Chat Channel §3.1 CCH-AD-05 / §4.3] 의 conversation
 * 매핑 키 — `(provider, conversationKey)` 1:1 ChannelConversation. provider 별
 * 추가 필드 (channelUserKey, 그 외 provider-specific) 는 index signature 로 허용 —
 * 본 타입은 dispatcher 에 전달되는 wire shape 의 최소 contract 만 강제하고
 * 확장 필드는 provider 책임으로 통과시킨다.
 */
export interface ChatChannelRoutingInfo {
  provider: string;
  conversationKey: string;
  channelUserKey?: string;
  [key: string]: unknown;
}

/**
 * Execution 단위 outbound 라우팅 컨텍스트. ExecutionEngine 이 execute() 진입
 * 시 등록 → 이후 emit 되는 모든 이벤트의 fanout envelope 에 자동 첨부 →
 * `ChatChannelDispatcher` / `NotificationFanout` 가 trigger 와 conversation 을
 * 식별 (Spec Chat Channel §3.1 CCH-AD-05 / EIA §6).
 */
export interface ExecutionRoutingContext {
  /** 트리거 발화로 시작된 execution 만 set. 수동 실행은 undefined. */
  triggerId?: string;
  /**
   * Workflow id — `ChatChannelDispatcher.toChatChannelEvent` 가 EiaEvent.base 의 필수
   * 필드로 사용. PR #314 의 초기 routing context 에는 누락되어 있었고, 그 결과
   * dispatcher 가 `if (!workflowId) return null` 에서 silent skip 하여 outbound
   * 가 안 가던 회귀 (2026-05-25 사용자 production log 확인) 를 해소한다. trigger
   * 발화 execution 의 workflow 는 항상 알려져 있으므로 register 시점에 명시.
   */
  workflowId?: string;
  /**
   * 트리거가 `config.chatChannel` 설정 webhook 인 경우만 set. 일반 webhook
   * 트리거는 undefined.
   */
  chatChannel?: ChatChannelRoutingInfo;
}

export enum ExecutionEventType {
  EXECUTION_STARTED = 'execution.started',
  /** Emitted when execution resumes after a Form node receives user input (not a fresh start) */
  EXECUTION_RESUMED = 'execution.resumed',
  EXECUTION_COMPLETED = 'execution.completed',
  EXECUTION_FAILED = 'execution.failed',
  EXECUTION_CANCELLED = 'execution.cancelled',
  EXECUTION_WAITING_FOR_INPUT = 'execution.waiting_for_input',
  /**
   * AI Agent Multi Turn 모드에서 사용자 발화(q)를 수신 즉시(다음 턴 LLM 호출 전)
   * 라이브로 노출하기 위한 진행 신호. tool_call_* 와 동형의 비권위 신호 —
   * turn 종료 `AI_MESSAGE.messages` 스냅샷이 권위 출처이며 동일 user 메시지를
   * 포함한다. 영속 대상 아님 (spec/5-system/6-websocket-protocol.md §4.4
   * `execution.user_message`, spec/4-nodes/3-ai/1-ai-agent.md §7.5).
   */
  USER_MESSAGE = 'execution.user_message',
  AI_MESSAGE = 'execution.ai_message',
  /**
   * 표시-전용 presentation 노드(carousel/table/chart/template)가 버튼 없이 자동 진행
   * (non-blocking) 완료될 때 발행하는 표시 메시지. EIA SSE 표면(웹채팅 위젯 등)이 렌더한다.
   *
   * `execution.node.completed`(node-level)는 **모든 비차단 노드**에 대해 나오는 firehose 라
   * EIA 표면이 직접 구독하기엔 내부 라이프사이클이 새므로, presentation 4종 한정 execution-level
   * 표시 이벤트를 별도로 둔다. AI 가 생성한 메시지(`AI_MESSAGE`)가 아니며, 권위 출처는 영속
   * `NodeExecution.outputData` 다. payload: `{ nodeId, nodeType, presentations: [{config, output}] }`
   * — presentations envelope 은 AI Agent render_* 와 동일한 위젯 렌더 경로를 탄다.
   *
   * 명명 주의: WS 에러코드 `EXECUTION_MESSAGE_TOO_LONG` 와는 무관한 별개 네임스페이스다.
   */
  EXECUTION_MESSAGE = 'execution.message',
  /** AI Agent provider tool 실행 시작. 디버깅 타임라인의 pending 표시용 */
  TOOL_CALL_STARTED = 'execution.tool_call_started',
  /** AI Agent provider tool 실행 완료. status: 'success' | 'error' */
  TOOL_CALL_COMPLETED = 'execution.tool_call_completed',
  /** One-shot snapshot sent to the subscribing client right after it joins an `execution:*` channel */
  EXECUTION_SNAPSHOT = 'execution.snapshot',
}

/**
 * Wire payload for {@link ExecutionEventType.TOOL_CALL_STARTED}. Frontend
 * `use-execution-events.ts` maintains a structurally compatible local type;
 * keep the two in sync — adding a required field here is a breaking change
 * for the client.
 */
export interface ToolCallStartedPayload {
  /** Logical node id (graph UUID) of the AI Agent making the call. */
  nodeId: string;
  /** Multi-turn conversation index — assistants and tools share the same
   *  index within one turn so the timeline can group them visually. */
  turnIndex: number;
  /** LLM-assigned tool_use id; matches the eventual tool_result message and
   *  the COMPLETED event. */
  toolCallId: string;
  /** LLM-facing tool name (e.g. `kb_<sanitized>`, `mcp_<sid>__<tool>`). */
  name: string;
  /** Raw JSON-string arguments from the LLM; the client parses defensively. */
  arguments: string;
  /** ISO8601 — tool 실행 시작 절대 시각. 타임라인이 라이브/영속 동일 시각 표시.
   *  SoT: spec/5-system/6-websocket-protocol.md §4.4 execution.tool_call_started. */
  startedAt?: string;
}

/**
 * Wire payload for {@link ExecutionEventType.USER_MESSAGE}. 사용자 발화(q)를
 * 다음 턴 LLM 호출 전에 라이브로 노출하는 비권위 진행 신호. Frontend
 * `use-execution-events.ts` 가 구조 호환 로컬 타입을 유지하므로 두 정의를
 * 동기화한다. SoT: spec/5-system/6-websocket-protocol.md §4.4 execution.user_message.
 */
export interface UserMessagePayload {
  /** 실행 ID. */
  executionId: string;
  /** 메시지를 수신한 AI 노드의 graph UUID. */
  nodeId: string;
  /** 이 시점 `waiting_for_input` 상태였던 NodeExecution row PK (multi-row 라우팅). */
  nodeExecutionId?: string;
  /** 사용자가 보낸 발화 본문. */
  message: string;
  /** 엔진 수신 시각 (ISO 8601). 클라이언트 optimistic bubble dedup 키. */
  receivedAt: string;
}

/**
 * Wire payload for {@link ExecutionEventType.TOOL_CALL_COMPLETED}. `content`
 * is a 200-char preview string (full result lives in
 * `ai_message.messages` snapshot + persisted `outputData`).
 */
export interface ToolCallCompletedPayload {
  nodeId: string;
  turnIndex: number;
  toolCallId: string;
  /** JSON-stringified preview of the tool result (capped server-side). */
  content: string;
  status: 'success' | 'error';
  /** Sanitized human-readable error summary. Set when status='error'. */
  error?: string;
  durationMs: number;
  /** ISO8601 — tool 실행 시작 절대 시각 (= 대응 tool_call_started.startedAt). */
  startedAt?: string;
  /** ISO8601 — tool 실행 종료 절대 시각. */
  finishedAt?: string;
}

export enum NodeEventType {
  NODE_STARTED = 'execution.node.started',
  NODE_COMPLETED = 'execution.node.completed',
  NODE_FAILED = 'execution.node.failed',
  NODE_SKIPPED = 'execution.node.skipped',
  // 노드 외부 I/O 가 abortSignal 로 중단됨 (AbortError) — failed 와 별도 terminal
  // 이벤트로, 타임라인이 취소를 실패와 구분하고 running 에 잔류하지 않게 한다
  // (spec/5-system/6-websocket-protocol.md §4.4 / node-cancellation §5.1).
  NODE_CANCELLED = 'execution.node.cancelled',
}

/**
 * Background 본문 run-level 이벤트. 본문 안의 NodeExecution 변화는 기존
 * `execution:<id>` 채널에 그대로 발행되며 (`parentNodeExecutionId` 로 필터),
 * 본 채널은 **run 의 시작/종료** 같은 수명주기 이벤트만 받는다.
 *
 * 채널: `background:run:<backgroundRunId>` — execution:<id> 와 격리.
 * spec/4-nodes/1-logic/12-background.md §8.5 참조.
 */
export enum BackgroundRunEventType {
  BACKGROUND_RUN_STARTED = 'execution.background_run.started',
  BACKGROUND_RUN_COMPLETED = 'execution.background_run.completed',
}

/**
 * 사용자 알림 도메인 이벤트. 채널: `notifications:<userId>`.
 * 권위 정의: spec/5-system/6-websocket-protocol.md §4.5 (`notification.new`).
 *
 * **인앱 알림 벨 전용** — 이름의 `InApp` 접두가 그 스코프다.
 *
 * `triggers/dto/notification-config.dto.ts` 의 `NotificationEventType` 과 **다른 것**이다.
 * 그쪽은 outbound webhook 구독 화이트리스트(`execution.*` 5값)이고 둘은 무관하다.
 * 종전에는 **둘이 같은 이름**이라 disambiguation JSDoc 으로만 막고 있었는데(`18_53_27`
 * naming W3), 주석은 오import 를 막지 못한다 — 자동완성이 두 심볼을 같은 이름으로 보여
 * 주면 잘못 고른 쪽도 컴파일된다. 그래서 이름 자체로 갈랐다.
 *
 * 개명 대상으로 **이쪽**을 고른 이유: 저쪽은 EIA §3.1 의 외부 계약(구독 화이트리스트)에
 * 붙어 있고, 이 모듈의 자매 enum 들이 이미 `<도메인>EventType` 규칙(`ExecutionEventType` ·
 * `NodeEventType` · `BackgroundRunEventType` · `KbEventType`)을 따르므로 도메인을 앞에
 * 붙이는 것이 그 규칙 안에 있다.
 */
export enum InAppNotificationEventType {
  NOTIFICATION_NEW = 'notification.new',
}

/**
 * Wire payload for {@link InAppNotificationEventType.NOTIFICATION_NEW}.
 * spec/5-system/6-websocket-protocol.md §4.5 의 shape
 * `{ id, type, title, message, resourceType, resourceId }`. `resourceType` /
 * `resourceId` 는 리소스 attribution 이 없는 알림에서 null.
 */
export interface NotificationNewPayload {
  id: string;
  type: string;
  title: string;
  message: string;
  resourceType?: string | null;
  resourceId?: string | null;
}

/**
 * Knowledge Base 도메인 이벤트 — KB 이벤트의 **권위 정의**. frontend `useKbEvents`
 * (`KB_EVENT_NAMES`) 가 이 union 과 1:1 로 구독한다. 채널 명명규약: `kb:${documentId}`.
 * (execution: 채널과 구분)
 *
 * emit 경로도 이 union 을 컴파일타임에 강제한다 — `Embedding/GraphExtractionService` 의
 * private `emitEvent(event: KbEventType, …)` 시그니처가 union 밖 이벤트명을 build 에러로
 * 차단한다. 따라서 union 은 문서상 권위일 뿐 아니라 emit 지점에서도 실제로 강제된다.
 *
 * 총 11종 = embedding 6 + graph 5:
 * - `document:embedding_error` 는 선언돼 있으나 현재 emit 경로가 없다 — 일시 오류는
 *   `embedding_status='error'` 전환과 함께 `_retry` 로 통지한다 (data-flow §2.5). union
 *   멤버로 남겨 forward-compat 을 확보한다.
 * - graph 에는 대응하는 `document:graph_error` 가 없다 — emit 경로가 없어 #443 에서 union
 *   에서 제거했다. graph 의 일시 오류도 `_retry`, 최종 실패는 `_failed` 로만 신호한다.
 */
export type KbEventType =
  | 'document:embedding_started'
  | 'document:embedding_progress'
  | 'document:embedding_completed'
  | 'document:embedding_error'
  | 'document:embedding_retry'
  | 'document:embedding_failed'
  | 'document:graph_started'
  | 'document:graph_progress'
  | 'document:graph_completed'
  | 'document:graph_retry'
  | 'document:graph_failed';

/**
 * 인증 도메인 시스템 이벤트. 구독 불필요 — 연결 전체에 자동 전송.
 * 권위 정의: spec/5-system/6-websocket-protocol.md §4.6 · Rationale
 * `R-ws-socket-lifetime-binds-token`.
 *
 * **`token_expired`(Integration `status_reason` DB 슬러그)·`TOKEN_EXPIRED`(REST/JWT 검증
 * 에러 코드)와 별개다.** 세 식별자가 표기만 가깝고 네임스페이스가 다르므로 로그·에러
 * 메시지에서 혼용하지 않는다 (`--impl-prep` naming_collision INFO#7).
 */
export enum AuthEventType {
  AUTH_TOKEN_EXPIRED = 'auth.token_expired',
}

/**
 * Wire payload for {@link AuthEventType.AUTH_TOKEN_EXPIRED}.
 * spec §4.6 의 shape `{ message, expiresAt }`.
 *
 * `expiresAt` 은 ISO 8601 이고 의미는 **이 소켓이 강제 종료되는 시각**이다 —
 * `_retryState.expiresAt`(AI retry TTL, §4.2)·`auth.refreshed.expiresAt`(§1.3 비채택)과
 * 이름만 같고 가리키는 대상이 다르다. 클라이언트는 이 값으로 남은 창을 계산해 재발급 +
 * **명시적 재연결**을 수행한다(§9.2) — Socket.IO 자동 재연결은 서버발신 disconnect 에
 * 발화하지 않는다(§6.1 예외).
 */
export interface AuthTokenExpiredPayload {
  message: string;
  expiresAt: string;
}
