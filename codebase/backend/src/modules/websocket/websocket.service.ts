import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { WebsocketGateway } from './websocket.gateway';
import { ExecutionSeqAllocator } from './execution-seq-allocator.service';
import {
  EXTERNAL_STRIPPED_FIELDS,
  stripExternalOnlyFields,
} from '../../shared/utils/strip-external-only-fields';
import { allowlistNodeOutputKeys } from '../../nodes/core/node-output-allowlist';
import {
  DEPTH_MASK_MARKER,
  deepRedactSecretsPreserving,
  KEY_MASK_MARKER,
} from '../../shared/utils/sanitize-error-message';

// 값·타입 정의는 **의존성-프리 모듈**로 분리했다 — 이 파일이 ES-module 순환 위에 있어
// 순환 위의 다른 파일이 모듈 평가 시점에 enum 을 읽으면 `undefined` 였기 때문이다
// (#1174 에서 72 suites 가 그렇게 터졌다). 자세한 근거는 그 모듈의 헤더 주석.
//
// **re-export 로 기존 import 경로를 보존**한다 — `WebsocketService` 와 함께 쓰는 호출부는
// 바꿀 필요가 없다. 다만 **타입만 쓰는 호출부는 새 모듈을 직접 import** 해야 순환에서
// 빠진다(이 파일을 거치면 서비스 모듈을 그대로 끌고 온다).
import {
  ExecutionEventType,
  NodeEventType,
  BackgroundRunEventType,
  InAppNotificationEventType,
} from './websocket-events.types';
import type {
  ExecutionChannelEvent,
  ChatChannelRoutingInfo,
  ExecutionRoutingContext,
  ToolCallStartedPayload,
  UserMessagePayload,
  ToolCallCompletedPayload,
  NotificationNewPayload,
  KbEventType,
} from './websocket-events.types';

export {
  ExecutionEventType,
  NodeEventType,
  BackgroundRunEventType,
  InAppNotificationEventType,
};
export type {
  ExecutionChannelEvent,
  ChatChannelRoutingInfo,
  ExecutionRoutingContext,
  ToolCallStartedPayload,
  UserMessagePayload,
  ToolCallCompletedPayload,
  NotificationNewPayload,
  KbEventType,
};

// 아래는 **구현 세부**다 — 타입 모듈이 아니라 이 파일에 남는다.
// (분리 시 함께 옮겼다가 클래스가 이들을 참조해 컴파일이 깨졌다. 타입 모듈은
//  `export` 된 값·타입만 갖는다.)
/**
 * WARN #10 (Security) — credential-like 키를 가진 필드를 WS 이벤트 페이로드에서
 * 마스킹. 핸들러가 echo 하지 말아야 할 자격증명 (password, apiKey, token, secret,
 * credentials.access_token 등) 이 노드 output / meta 에 실수로 포함된 경우에
 * 대비한 defense-in-depth. 채널 구독자 전원에게 평문 노출되는 것을 차단.
 *
 * 키 이름 패턴 매칭 방식 — 값 자체의 entropy 분석은 false positive 가 너무 많음.
 *
 * `[a-z0-9_-]*token` 은 `token` 계열 전체를 한 대안으로 덮는다 — bare `token` 과
 * 접두형(`access_token`·`csrf_token`·`csrfToken`·`x-auth-token`). 2026-08-17 실측:
 * 목록에 bare `token` 은 있었지만 접두형이 없어 `{csrf_token: …}` 이 평문으로 나갔다.
 *
 * `shared/utils/sanitize-error-message.ts` 의 동명 상수와 **의도된 미러**다 — 한쪽만
 * 고치면 그쪽 JSDoc 의 "같은 클래스를 방어한다" 서술이 거짓이 되므로 함께 갱신한다.
 * **미러의 범위는 자격증명 키 계열까지다**: 공용 쪽 `x[_-]api[_-]?key` 는 LLM/tool
 * structured output 을 받는 REST 표면 전용 확장이라 여기 없는 것이 정상이고, 동기화
 * 대상이 아니다.
 */
const CREDENTIAL_KEY_PATTERN =
  /^(password|passwd|pwd|api[_-]?key|secret|[a-z0-9_-]*token|private[_-]?key|client[_-]?secret|authorization|cookie)$/i;

export const MAX_SANITIZE_DEPTH = 10;

/**
 * 값-패턴 마스킹에서 제외할 키 — 에디터 전용 raw 디버그 필드.
 *
 * `EXTERNAL_STRIPPED_FIELDS`(=`['llmCalls']`)를 **그대로 재사용**한다. 두 목록이 갈리면
 * "fanout 에서 지우는 필드" 와 "wire 에서 원문으로 남기는 필드" 가 어긋나, 지우지도
 * 남기지도 않는 필드가 조용히 생긴다.
 */
const WIRE_PRESERVED_FIELDS: ReadonlySet<string> = new Set(
  EXTERNAL_STRIPPED_FIELDS,
);

/**
 * 동일 객체 참조에 대한 sanitize 결과 캐시.
 *
 * ForEach 가 같은 `node.config` 를 5,000회 emit 해도 sanitize 는 1회만 수행된다.
 * WeakMap 이라 객체가 GC 되면 자동 정리. depth 마다 별도 캐시인 이유: 동일 부분트리가
 * 다른 깊이로 재방문될 때 (`MAX_SANITIZE_DEPTH` 경계 분기) 결과 형태가 달라질 수 있어서.
 * 실제 hot path 에서는 대부분 depth 0 이므로 캐시 적중률은 사실상 단일 캐시와 동일.
 */
const SANITIZE_CACHE = new WeakMap<object, unknown>();

/**
 * WS emit 페이로드에서 credential-like 키를 마스킹.
 *
 * - 자식 변경이 없으면 입력 그대로의 참조를 반환해 GC pressure 를 피한다 (참조 동일성 보장).
 * - depth 가 {@link MAX_SANITIZE_DEPTH} 를 초과하면 그 노드 이하의 키 매칭을 신뢰할 수 없다.
 *   하부에 credential 이 숨어 있을 가능성을 차단하기 위해 통째로 `'[REDACTED_DEPTH]'` 로 대체한다
 *   (옛 구현은 원본을 그대로 반환해 누출 위험이 있었음 — Review 후속 #4).
 * - 동일 객체 참조 재방문 시 {@link SANITIZE_CACHE} 에서 O(1) 조회. CPU 핫패스 완화 (C-4).
 *
 * @returns 동일 구조의 새 값(자식 mutation 발생 시) 또는 입력과 동일한 참조(변경 없을 때)
 */
function sanitizePayloadForWs(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') return value;
  // 마커 문자열은 `sanitize-error-message` 의 상수를 **공유**한다 — 값-마스커가
  // "이미 마스킹된 값" 을 알아보는 근거가 그 상수 집합이라, 여기서 리터럴을 따로 쓰면
  // 한쪽만 바뀌었을 때 재마스킹 방지가 조용히 깨진다.
  if (depth > MAX_SANITIZE_DEPTH) return DEPTH_MASK_MARKER;
  // depth 0 진입만 캐시 검사 — 부분트리는 부모 호출이 이미 캐시 적중 시 진입 자체 안 함.
  // 캐시 키는 입력 object identity. 결과는 sanitized output (원본일 수도 있음).
  if (depth === 0) {
    const cached = SANITIZE_CACHE.get(value);
    if (cached !== undefined) return cached;
  }
  const result = sanitizeInner(value, depth);
  if (depth === 0) {
    SANITIZE_CACHE.set(value, result);
  }
  return result;
}

function sanitizeInner(value: object, depth: number): unknown {
  if (Array.isArray(value)) {
    let mutated = false;
    const out: unknown[] = new Array(value.length);
    for (let i = 0; i < value.length; i++) {
      const sanitized = sanitizePayloadForWs(value[i], depth + 1);
      if (sanitized !== value[i]) mutated = true;
      out[i] = sanitized;
    }
    return mutated ? out : value;
  }
  let result: Record<string, unknown> | null = null;
  const obj = value as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) {
    if (CREDENTIAL_KEY_PATTERN.test(k)) {
      if (!result) result = { ...obj };
      result[k] = KEY_MASK_MARKER;
    } else {
      const sanitized = sanitizePayloadForWs(v, depth + 1);
      if (sanitized !== v) {
        if (!result) result = { ...obj };
        result[k] = sanitized;
      }
    }
  }
  return result ?? value;
}

// 외부 fanout 의 debug 전용 필드 제거는 공유 유틸이 담당한다 —
// `shared/utils/strip-external-only-fields`. 여기 두지 않는 이유(같은 데이터에 출구가 둘
// 이상이다)와 깊이 상한 근거는 그 파일 JSDoc 참조. 이 파일의 호출부는 자매 sanitizer 와
// 같은 `MAX_SANITIZE_DEPTH` 를 넘긴다.
//
// (블록 JSDoc 으로 두었더니 붙을 선언이 없어 **당시 뒤따르던 선언의 문서로 읽혔다** —
//  `14_55_29` maintainability W4. 그래서 라인 주석이다. 그 선언이던 KB union 은 이후
//  `websocket-events.types.ts` 로 옮겨졌으니 "바로 아래" 로 읽지 말 것.)

/**
 * envelope 의 **최상위 키 하나**를 fail-closed allowlist 로 좁힌다 — 조립은 호출자
 * ({@link allowlistFanoutNodeOutput}) 몫이다.
 *
 * `key` 가 유니온인 이유: 같은 `NodeHandlerOutput` 래퍼가 이벤트에 따라 **다른 이름**으로
 * 실린다 — waiting 은 `nodeOutput`, `execution.node.*` 는 `output`. 값이 객체가 아니면
 * (없거나 `null` 포함) 입력을 그대로 돌려준다.
 *
 * **copy-on-change** — 좁힐 것이 없으면 **입력 참조 그대로** 반환한다. fanout 은 모든
 * execution 이벤트가 지나는 hot path 라 무변경 이벤트에 객체를 새로 만들지 않는다.
 */
function narrowTopLevelNodeOutput(
  envelope: Record<string, unknown>,
  key: 'nodeOutput' | 'output',
): Record<string, unknown> {
  const value = envelope[key];
  if (value === null || typeof value !== 'object') return envelope;
  const narrowed = allowlistNodeOutputKeys(value);
  return narrowed === value ? envelope : { ...envelope, [key]: narrowed };
}

/**
 * fanout envelope 안에서 `NodeHandlerOutput` 래퍼가 실리는 **세 자리**를 좁힌다 — 이
 * 파일의 실제 chokepoint 다.
 *
 * | 이벤트 | 자리 |
 * |---|---|
 * | waiting (form / ai_conversation) | `nodeOutput` |
 * | waiting (buttons) | `buttonConfig.nodeOutput` (**한 겹 아래**) |
 * | `execution.node.completed` / `.failed` | `output` |
 *
 * payload 는 envelope 에 **평평하게** 펼쳐지므로(`{executionId, ...payload, seq, ...}`)
 * 앞 두 자리는 REST `getStatus` 와 위치가 같다. emit 하는 곳은 여럿이지만
 * {@link WebsocketService.toFanoutEnvelope} 이 유일한 외부 출구라 여기서 한 번 건다.
 *
 * 최상위 두 키는 {@link narrowTopLevelNodeOutput} 에 위임하고, `buttonConfig.nodeOutput`
 * 만 인라인이다 — 중첩 자리는 그 헬퍼의 계약(최상위 한 키) 밖이다. 네 번째 중첩 자리가
 * 생기면 경로 기반으로 일반화한다.
 */
function allowlistFanoutNodeOutput(
  envelope: Record<string, unknown>,
): Record<string, unknown> {
  // **키 이름이 둘인 것이 이 표면의 함정이었다** — `nodeOutput` 만 찾은 종전 배선이
  // `output` 을 통째로 지나쳤다(`23_29_27` cross_spec CRITICAL).
  let next = narrowTopLevelNodeOutput(envelope, 'nodeOutput');
  next = narrowTopLevelNodeOutput(next, 'output');

  // buttons waiting 은 한 겹 아래다 — 최상위 헬퍼로 못 덮는 유일한 자리.
  const bc = next.buttonConfig;
  if (bc !== null && typeof bc === 'object') {
    const inner = (bc as Record<string, unknown>).nodeOutput;
    if (inner !== null && typeof inner === 'object') {
      const narrowed = allowlistNodeOutputKeys(inner);
      if (narrowed !== inner) {
        next = { ...next, buttonConfig: { ...bc, nodeOutput: narrowed } };
      }
    }
  }

  return next;
}

/**
 * execution 채널의 종결 이벤트 — emit 후 seq counter 를 해제해 메모리 누수를 막는다.
 * 같은 executionId 가 재사용되어도 새 실행은 seq=1 부터 시작.
 */
const TERMINAL_EXECUTION_EVENTS: ReadonlySet<ExecutionEventType> = new Set([
  ExecutionEventType.EXECUTION_COMPLETED,
  ExecutionEventType.EXECUTION_FAILED,
  ExecutionEventType.EXECUTION_CANCELLED,
]);

@Injectable()
export class WebsocketService {
  private readonly logger = new Logger(WebsocketService.name);

  /**
   * Execution-scoped monotonic sequence counter.
   *
   * 외부 SSE 의 `id:` 와 Outbound Notification 의 `seq` 가 본 카운터와 같은 값을
   * 공유한다 (Spec WS §2.2 + Spec EIA §R7).
   *
   * v2 (2026-06): seq 발급을 {@link ExecutionSeqAllocator} (Redis `INCR exec:seq:<id>`)
   * 로 분산-안전하게 강화. multi-instance 환경에서 같은 execution 의 emit 이 다른
   * 인스턴스에서 발생해도 atomic INCR 로 monotonic invariant 가 유지된다
   * (Spec EIA §R7 "execution 별 atomic INCR" 전제). Redis 장애 시 allocator 가
   * in-memory degraded fallback. emit 메서드가 async 인 이유 = Redis round-trip await.
   */

  /**
   * 외부 fan-out subject — execution: 채널 이벤트만 발행. SseAdapter / NotificationDispatcher 가
   * 본 stream 을 구독 (R10 facade 레이어).
   */
  private readonly executionEventSubject = new Subject<ExecutionChannelEvent>();

  /** Observable form — listener 가 subscribe(). */
  readonly executionEvents$: Observable<ExecutionChannelEvent> =
    this.executionEventSubject.asObservable();

  /**
   * Execution 단위 라우팅 컨텍스트 — `executionId → {triggerId?, chatChannel?}`.
   *
   * [Spec Chat Channel §3.1 CCH-AD-05 / §3.2]: `ChatChannelDispatcher` 와
   * `NotificationFanout` 은 `event.payload.triggerId` / `event.payload.chatChannel.conversationKey`
   * 를 가드로 사용한다. ExecutionEngine 이 execute() 진입 시 본 Map 에 등록하면,
   * 이후 모든 `emitExecutionEvent` / `emitNodeEvent` 가 만드는 **fanout envelope**
   * 에만 자동 첨부된다. **wire envelope** (`gateway.broadcastToChannel`) 에는
   * 첨부하지 않아 WS spec §4.4 의 frontend wire shape 호환성을 유지한다.
   *
   * Lifecycle 은 seq allocator 의 키와 동일 — terminal event 발송 후 자동
   * release. 명시 release 필요 시 {@link releaseExecutionRouting}.
   */
  private readonly executionRouting = new Map<
    string,
    ExecutionRoutingContext
  >();

  constructor(
    private readonly gateway: WebsocketGateway,
    private readonly seqAllocator: ExecutionSeqAllocator,
  ) {}

  /**
   * Execution 시작 시 호출 — 이후 emit 되는 모든 이벤트의 fanout envelope 에
   * `triggerId` / `chatChannel` 이 자동 첨부된다.
   *
   * 같은 executionId 로 재호출하면 덮어쓰기. 일반 webhook (chatChannel 미설정)
   * 경로는 `triggerId` 만 전달해도 무관 (NotificationFanout 가드는 통과,
   * ChatChannelDispatcher 가드는 chatChannel 까지 필요해 자체 silent skip).
   */
  registerExecutionRouting(
    executionId: string,
    context: ExecutionRoutingContext,
  ): void {
    if (!executionId) return;
    this.executionRouting.set(executionId, context);
    // production 진단용 debug log — log level 을 'debug' 로 올리면 dispatcher 의
    // listenerRegistry miss 와 envelope 첨부 누락을 시간순으로 추적 가능.
    this.logger.debug(
      `routing context registered: executionId=${executionId} ` +
        `triggerId=${context.triggerId ?? '<none>'} ` +
        `chatChannel=${context.chatChannel ? `${context.chatChannel.provider}/${context.chatChannel.conversationKey}` : '<none>'}`,
    );
  }

  /**
   * Routing context 명시 해제. terminal event (`COMPLETED` / `FAILED` /
   * `CANCELLED`) 발송 시 {@link emitExecutionEvent} 가 자동 호출하므로 정상
   * 흐름에서는 호출 불필요. 엔진이 비정상 종료 (예: workflow not found 로 emit
   * 자체가 발생하지 않는 케이스) 등에서 누수 방지용으로 사용.
   */
  releaseExecutionRouting(executionId: string): void {
    this.executionRouting.delete(executionId);
  }

  async emitExecutionEvent(
    executionId: string,
    eventType: ExecutionEventType,
    payload: unknown,
  ): Promise<void> {
    const channel = `execution:${executionId}`;
    const sanitizedPayload = sanitizePayloadForWs(payload);
    const seq = await this.seqAllocator.next(executionId);
    const wireEnvelope: Record<string, unknown> = this.maskWireEnvelope({
      executionId,
      ...((sanitizedPayload && typeof sanitizedPayload === 'object'
        ? sanitizedPayload
        : { data: sanitizedPayload }) as Record<string, unknown>),
      seq,
      timestamp: new Date().toISOString(),
    });
    // wire envelope (frontend socket.io) — WS spec §4.4 shape 그대로. 인증된
    // 내부 WS(에디터) 채널은 debug 필드(llmCalls) 를 원문으로 수신한다
    // ({@link WIRE_PRESERVED_FIELDS}); 그 밖의 값은 위에서 마스킹됐다.
    this.gateway.broadcastToChannel(channel, eventType, wireEnvelope);
    // fanout envelope (internal subscriber: SseAdapter / NotificationFanout /
    // ChatChannelDispatcher) — routing context 가 등록되어 있으면 첨부.
    // wire 와 분리한 이유: frontend wire shape 의 호환성을 유지하면서 dispatcher
    // 가 trigger 식별에 필요한 추가 context 만 internal subscriber 에 전달.
    // 또한 fanout 은 외부 수신자(SSE 토큰 보유 채널 end-user 포함) 로 나가므로
    // debug 전용 llmCalls 를 strip 한다 (WS §4.4 strip-only 결정). wireEnvelope
    // 은 위에서 이미 broadcast 됐고 여기선 새 clone 을 strip 하므로 WS copy 불변.
    const fanoutEnvelope = this.toFanoutEnvelope(executionId, wireEnvelope);
    this.executionEventSubject.next({
      executionId,
      eventType,
      seq,
      payload: fanoutEnvelope,
    });
    // 진단 log — dispatcher 가 못 받는다는 보고 (2026-05-25) 의 emit-vs-subscribe
    // 분리 가설 검증용. ai_message / waiting_for_input 만 log (noise 회피).
    // dispatcher 의 handle log 와 짝지어 보면 emit-subscribe 가 같은 Subject 인지
    // 확인 가능. routing context 등록 여부도 같이 찍어 PR #314 fix 작동 검증.
    if (
      eventType === ExecutionEventType.AI_MESSAGE ||
      eventType === ExecutionEventType.EXECUTION_WAITING_FOR_INPUT
    ) {
      const hasRouting = this.executionRouting.has(executionId);
      this.logger.log(
        `emit ${eventType} (executionId=${executionId}, seq=${seq}, routing=${hasRouting ? 'attached' : 'NONE'})`,
      );
    }
    if (TERMINAL_EXECUTION_EVENTS.has(eventType)) {
      this.seqAllocator.release(executionId);
      this.releaseExecutionRouting(executionId);
    }
  }

  /**
   * KB 도메인 이벤트 발송. EmbeddingService / GraphExtractionService 가 문서 처리 진행/완료/실패
   * 시 호출. 채널 prefix 는 `kb:` 그대로 — `execution:` 으로 변환되지 않는다 (V038 fix).
   */
  emitKbEvent(
    documentId: string,
    eventType: KbEventType,
    payload: Record<string, unknown>,
  ): void {
    const channel = `kb:${documentId}`;
    const sanitizedPayload = sanitizePayloadForWs(payload);
    this.gateway.broadcastToChannel(channel, eventType, {
      documentId,
      ...((sanitizedPayload && typeof sanitizedPayload === 'object'
        ? sanitizedPayload
        : { data: sanitizedPayload }) as Record<string, unknown>),
      timestamp: new Date().toISOString(),
    });
  }

  async emitNodeEvent(
    executionId: string,
    nodeId: string,
    eventType: NodeEventType,
    payload: unknown,
  ): Promise<void> {
    const channel = `execution:${executionId}`;
    const sanitizedPayload = sanitizePayloadForWs(payload);
    const seq = await this.seqAllocator.next(executionId);
    const wireEnvelope: Record<string, unknown> = this.maskWireEnvelope({
      executionId,
      nodeId,
      ...((sanitizedPayload && typeof sanitizedPayload === 'object'
        ? sanitizedPayload
        : { data: sanitizedPayload }) as Record<string, unknown>),
      seq,
      timestamp: new Date().toISOString(),
    });
    this.gateway.broadcastToChannel(channel, eventType, wireEnvelope);
    // node 이벤트는 현재 llmCalls 를 포함하지 않으나, 미래 누출 경로를 차단하기 위해
    // emitExecutionEvent 와 동일하게 strip 적용 (방어심층화 — W-1/W-4).
    const fanoutEnvelope = this.toFanoutEnvelope(executionId, wireEnvelope);
    this.executionEventSubject.next({
      executionId,
      eventType,
      seq,
      payload: fanoutEnvelope,
    });
  }

  /**
   * **값-패턴 마스킹 초크포인트** — emit 되는 모든 execution/node 이벤트가 여기를 지난다.
   *
   * ## 왜 키-이름 마스킹만으로 부족한가 (무수정 프로브로 실증)
   *
   * {@link sanitizePayloadForWs} 는 **키 이름** 기반이라 `typeof value !== 'object'` 면
   * 문자열을 그대로 돌려준다. 그래서 자유 텍스트 **값** 안에 박힌 자격증명이 통과한다 —
   * `error: 'Upstream rejected: Authorization: Bearer eyJ…'` 이 그대로 나갔다.
   * `stripExternalOnlyFields` 는 `llmCalls` **필드 제거** 전용이라 값을 보지 않는다.
   * 종결 이벤트는 `toTerminalErrorPayload` 가 막고 있었지만 **node 이벤트와 비-종결
   * execution 이벤트에는 이 층이 아예 없었다.**
   *
   * ## wire 에도 거는 이유 (결정 2026-08-16)
   *
   * 초안은 fanout 분기에만 걸려 했다("내부 wire 는 소유자 콘솔이니 원문 유지"). 실측하니
   * **그 전제가 틀렸다** — `execution:<id>` 구독 인가는
   * {@link ExecutionChannelAuthorizer} 가 `verifyOwnership(executionId, workspaceId)`
   * 만 보고 role 을 아예 받지 않는다. 즉 수신 인구가 `GET /api/executions/:id` 와
   * **동일**(viewer 포함 워크스페이스 멤버 전원)이고, EIA §R17 이 같은 인구를 근거로
   * *"안전성은 롤 게이팅이 아니라 egress masking parity 에 의존"* 이라며 내부 REST 를
   * 마스킹한 바로 그 상황이다. 한쪽만 열어 두면 선례가 갈린다.
   *
   * ## 단 `llmCalls` 는 wire 에서 제외한다
   *
   * {@link WIRE_PRESERVED_FIELDS} 참조. 이 예외가 없으면 WS §Rationale 의 strip-only
   * 결정이 *"값-레벨 마스킹은 에디터 디버깅 가치를 훼손한다"* 며 기각한 상태가 된다.
   * fanout 에서는 그 필드가 통째로 제거되므로 외부 노출은 늘지 않는다.
   *
   * @returns 마스킹된 **새 envelope** (`deepRedactSecretsPreserving` 의 copy-on-change 라
   *   바뀐 것이 없으면 같은 참조). 입력은 변이되지 않는다.
   */
  private maskWireEnvelope(
    wireEnvelope: Record<string, unknown>,
  ): Record<string, unknown> {
    return deepRedactSecretsPreserving(
      wireEnvelope,
      WIRE_PRESERVED_FIELDS,
    ) as Record<string, unknown>;
  }

  /**
   * fanout(외부 수신자) envelope 조립 — `emitExecutionEvent`/`emitNodeEvent` 공용.
   *
   * **두 emit 경로가 같은 문을 지나게 한다.** 종전엔 두 곳이 strip → routing 첨부를
   * 각자 조립했고, 이 저장소는 그렇게 갈린 자매에서 *"넷 중 하나만"* 을 반복해 겪었다.
   * 세 번째 emit 경로가 생겨도 여기를 부르면 마스킹·strip 이 구조적으로 빠지지 않는다.
   *
   * 순서는 **strip → nodeOutput allowlist → routing 첨부**다. 값 마스킹은 이미
   * {@link maskWireEnvelope} 가 wire 단계에서 끝냈으므로 여기서 다시 걸지 않는다 —
   * 다시 걸면 {@link attachRoutingContext} 가 붙인 `chatChannel` 의 `[REDACTED]`
   * 마커를 `***` 로 덮는다(그 마커는 기존 테스트가 고정하는 계약이다).
   *
   * ## `nodeOutput` 은 deny-list 가 아니라 allowlist 로 좁힌다
   *
   * `stripExternalOnlyFields` 는 이름을 아는 필드(`llmCalls`)만 뺀다 — fail-open 이라
   * 핸들러가 **새로 추가한** 내부 필드는 그대로 나간다. EIA §R17 이 REST `getStatus`
   * 를 fail-closed allowlist 로 닫은(#1205) 이유가 그것이고, 여기까지 닫아야 REST 와
   * SSE 의 **`waiting_for_input` 표면** 방어 강도가 같아진다. `_retryState` 가 그
   * fail-open 의 현존 사례다 — `NodeHandlerOutput` 의 비공개 필드인데
   * `NodeExecution.outputData` 에 영속돼 emit payload 로 흘러들 수 있다.
   *
   * **키 이름이 둘이다 — `nodeOutput` 과 `output`.**
   * `execution.node.completed`/`.failed` 는 같은 `NodeExecution.outputData` 를
   * **`output`** 이라는 다른 키로 최상위에 싣는다 — emit **6곳**(`execution-engine` 2 ·
   * `form-interaction` 1 · `button-interaction` 1 · `ai-turn-orchestrator` 2). 종전 배선이 `nodeOutput`
   * 만 찾아 그 표면을 통째로 지나쳤고, 2026-08-24 에 함께 닫았다.
   *
   * 그때 유예 근거로 적었던 *"이종 payload 라 같은 목록을 걸 수 없다(버튼 재개 record 가
   * `{}` 가 된다)"* 는 **틀렸다** — 그 flat record 는 in-memory `nodeOutputCache` 에만
   * 들어가고 `outputData` 가 되는 것은 `buildResumedStructuredOutput` 의
   * `NodeHandlerOutput` 이다. 실 DB 조회(e2e 285건 후 teardown 전)에서 `outputData`
   * top-level 키는 `meta`·`config`·`output`·`port`·`status`·`conversationConfig` 뿐이었고
   * **전부 이 목록 안**이다. 근거는 EIA §R17 의 범위 표.
   *
   * **내부 WS 는 건드리지 않는다.** 호출 시점에 `wireEnvelope` 은 이미
   * `broadcastToChannel` 로 나갔고 여기서 만드는 것은 새 clone 이다 — 에디터 콘솔의
   * 디버깅 가치는 그대로다.
   */
  private toFanoutEnvelope(
    executionId: string,
    maskedWireEnvelope: Record<string, unknown>,
  ): Record<string, unknown> {
    const externalPayload = allowlistFanoutNodeOutput(
      stripExternalOnlyFields(maskedWireEnvelope, MAX_SANITIZE_DEPTH),
    );
    return this.attachRoutingContext(executionId, externalPayload);
  }

  /**
   * wire envelope 에 execution routing context (`triggerId` / `chatChannel`) 를
   * shallow-merge 한 새 fanout envelope 반환. context 미등록이면 wire envelope
   * 동일 참조 반환 (allocation 없음). chatChannel 은 sanitize 한 사본을 첨부 —
   * 호출자 회귀로 secret 이 섞이는 케이스의 defense-in-depth.
   */
  private attachRoutingContext(
    executionId: string,
    wireEnvelope: Record<string, unknown>,
  ): Record<string, unknown> {
    const ctx = this.executionRouting.get(executionId);
    if (!ctx) return wireEnvelope;
    const additions: Record<string, unknown> = {};
    if (ctx.triggerId) additions.triggerId = ctx.triggerId;
    if (ctx.workflowId) additions.workflowId = ctx.workflowId;
    if (ctx.chatChannel) {
      additions.chatChannel = sanitizePayloadForWs(ctx.chatChannel);
    }
    if (Object.keys(additions).length === 0) return wireEnvelope;
    return { ...wireEnvelope, ...additions };
  }

  /**
   * Background 본문 run 의 수명주기 이벤트를 `background:run:<id>` 채널에 발행.
   * processor 가 본문 실행 시작 / 종료 시 호출 — execution:<id> 와 격리된
   * 채널이라 메인 흐름 구독자에게 본문 이벤트가 전파되지 않는다.
   *
   * `backgroundRunId` 가 비어있으면 (옛 NodeExecution 의 본문 실행) emit 을
   * skip — 채널 식별자가 없어 라우팅 불가.
   */
  emitBackgroundRunEvent(
    backgroundRunId: string,
    eventType: BackgroundRunEventType,
    payload: Record<string, unknown>,
  ): void {
    if (!backgroundRunId) return;
    const channel = `background:run:${backgroundRunId}`;
    const sanitizedPayload = sanitizePayloadForWs(payload) as Record<
      string,
      unknown
    >;
    this.gateway.broadcastToChannel(channel, eventType, {
      backgroundRunId,
      ...sanitizedPayload,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 사용자 알림 실시간 push — `notifications:<userId>` 채널에 `notification.new` emit.
   * spec/data-flow/8-notifications.md §1·§2.2 + spec/5-system/6-websocket-protocol.md §4.5.
   *
   * 채널 authorizer(`NotificationsChannelAuthorizer`, JWT `sub` == userId)가 이미
   * fail-closed 로 배치돼 있어 다른 사용자 채널로 새지 않는다 (WS spec §3.3 Rationale).
   *
   * best-effort — WS 전달 실패가 알림 적재(source of truth)를 되돌리면 안 되므로
   * broadcast 예외를 삼키고 warn log 만 남긴다 (spec 의 "이메일 실패는 warn 만" 기조 동형).
   * `userId` 가 비면 no-op (채널 식별 불가).
   */
  emitNotificationEvent(
    userId: string,
    notification: NotificationNewPayload,
  ): void {
    if (!userId) return;
    const channel = `notifications:${userId}`;
    try {
      // payload shape 은 WS spec §4.5 의 { id, type, title, message, resourceType,
      // resourceId } 정확히 그대로 — 다른 이벤트의 timestamp/seq 는 여기선 붙이지
      // 않는다 (§4.5 가 권위 shape 이고 wire 계약을 spec 밖으로 확장하지 않는다).
      this.gateway.broadcastToChannel(
        channel,
        InAppNotificationEventType.NOTIFICATION_NEW,
        {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          resourceType: notification.resourceType ?? null,
          resourceId: notification.resourceId ?? null,
        },
      );
    } catch (err) {
      this.logger.warn(
        `notification.new emit failed (userId=${userId}, id=${notification.id}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
