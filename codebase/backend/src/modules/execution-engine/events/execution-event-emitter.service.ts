import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { WebsocketService } from '../../websocket/websocket.service';
import {
  ExecutionEventType,
  ExecutionRoutingContext,
  NodeEventType,
} from '../../websocket/websocket-events.types';
import { ExecutionStatus } from '../../executions/entities/execution.entity';
import type { TerminalErrorPayload } from '../../../shared/utils/terminal-error-payload';

/**
 * 종결 이벤트(`completed`/`failed`/`cancelled`) payload 의 **판별 union**.
 *
 * SoT: `spec/5-system/14-external-interaction-api.md` §6 필드 집합 표 · §6.5 행동 계약.
 *
 * `TerminalErrorPayload`(에러 봉투)를 **포함하는** 관계다 — 이름을 한 단어 차이로 두면
 * 둘을 혼동한다.
 *
 * ## 왜 union 인가 — 형태마다 필수 필드가 다르다
 *
 * `emitExecution(payload: unknown)` 은 아무것도 강제하지 않았다. 그래서 필드 하나를
 * 호출부마다 손으로 스레딩해야 했고, **한 곳을 빠뜨려도 아무도 잡지 못했다** — 이 저장소가
 * 최근 연속으로 겪은 결함이 전부 그 형태다:
 *
 * - `error` 를 네 emit 중 문자열로 실음 (#1170)
 * - `durationMs` 를 16 경로 어디서도 안 실음 (#1171)
 * - `cancelledBy` 를 retry-turn 경로에서만 누락 (본 PR 이 흡수)
 *
 * 각 variant 의 필수 필드가 그 셋을 **컴파일 타임에** 막는다.
 */
export type TerminalEventPayload =
  | { type: 'completed'; durationMs: number | null }
  | {
      type: 'failed';
      durationMs: number | null;
      /** §6.4 — 객체다. 문자열을 실으면 타입이 거부한다. */
      error: TerminalErrorPayload | null;
    }
  | {
      type: 'cancelled';
      durationMs: number | null;
      /** §6.5 — **닫힌 3값 union**. 확장하지 않는다. */
      cancelledBy: 'user' | 'system' | 'timeout';
      /**
       * §6.5 — 시스템/타임아웃 취소만 동행한다. **일반 user cancel 에는 키가 없다**
       * (`null` 이 아니라 부재).
       */
      error?: { code: string; message: string };
    };

/**
 * `type` → wire 이벤트명·`status`. 둘이 어긋날 수 없도록 한 곳에서만 파생한다.
 *
 * ## 이 상수가 **모듈 스코프**에 있다는 것 자체가 회귀 가드다
 *
 * #1174 는 이 파생을 모듈 스코프에 뒀다가 **72 suites 가
 * `Cannot read properties of undefined` 로 터졌다** — 이 파일이 ES-module 순환 위에 있어
 * 모듈 평가 시점에 `ExecutionEventType` 이 아직 `undefined` 였다. 그때는 호출 시점 지연
 * 평가로 우회했다.
 *
 * 이제 enum 은 **의존성-프리 모듈**(`websocket-events.types.ts`)에서 오고, 이 파일은 그
 * 모듈만 값으로 참조한다 — 순환에 참여하지 않으므로 모듈 스코프 평가가 안전하다.
 *
 * **우회를 되돌린 이유는 그게 캐너리이기 때문이다.** 누군가 값 import 를 다시
 * `websocket.service` 로 되돌리거나 순환을 되살리면 이 상수가 즉시 `undefined` 를 읽어
 * 테스트가 대량으로 깨진다 — 조용히 되돌아가지 않는다.
 *
 * 다만 캐너리는 **터진 뒤에야** 말해 준다. 원인을 곧장 가리키는 쪽은
 * `websocket/websocket-events.types.spec.ts` 다 — 순환 재편입을 정적으로 잡는다.
 */
const TERMINAL_SHAPE = {
  completed: {
    eventType: ExecutionEventType.EXECUTION_COMPLETED,
    status: ExecutionStatus.COMPLETED,
  },
  failed: {
    eventType: ExecutionEventType.EXECUTION_FAILED,
    status: ExecutionStatus.FAILED,
  },
  cancelled: {
    eventType: ExecutionEventType.EXECUTION_CANCELLED,
    status: ExecutionStatus.CANCELLED,
  },
} as const;

/**
 * 실행 엔진이 발행하는 도메인 이벤트의 단일 진입점.
 *
 * 옛 코드는 `ExecutionEngineService` 가 `WebsocketService.emitExecutionEvent` /
 * `emitNodeEvent` 를 24곳에서 직접 호출했다. 이벤트 형식·라우팅을 한 서비스가
 * 들고 있어 (a) 향후 이벤트 채널 다중화 (Sentry / OTel span event 등) 가 불가,
 * (b) 엔진 unit test 가 websocket service 의 broadcastToChannel 까지 mock 해야
 * 했다. 본 facade 가 그 책임을 분리한다 (C-6 strangle step 1).
 *
 * 본 facade 는 **현재로선** WebsocketService 로의 thin wrapper다. 향후 단계에서
 * 비-WS 채널 (Sentry breadcrumb, OTel SpanEvent, 외부 observability 등) 을
 * 추가할 때, 엔진 호출 사이트를 더 건드리지 않아도 되도록 진입점만 통일한다.
 *
 * **단, 종결 3종은 thin wrapper 가 아니다** — {@link emitTerminalExecution} 이
 * `status`·이벤트명·`result` 중첩을 조립한다. 그 책임을 여기 둔 이유는 그 조립이
 * 종전에 11 호출부에 흩어져 있었고 한 곳만 틀려도 아무도 못 잡았기 때문이다.
 */
@Injectable()
export class ExecutionEventEmitter {
  constructor(
    // C-1 후속 ④ — engine→Retry 역방향 DI 제거로 retry-turn.service 의 import 위치가
    // 엔진에서 외부 진입점(websocket.gateway)으로 이동하며 ws.service↔gateway↔
    // event-emitter ES-module 순환이 더 짧은 경로로 노출됐다. forwardRef 로 주입을
    // 지연 해석해 데코레이터 메타데이터 eval 순서와 무관하게 견고화한다(동작 불변).
    @Inject(forwardRef(() => WebsocketService))
    private readonly websocketService: WebsocketService,
  ) {}

  /**
   * Execution 단위 이벤트 발행 — `execution:<id>` 채널.
   * 옛 `websocketService.emitExecutionEvent` 와 동작·payload 동일.
   */
  async emitExecution(
    executionId: string,
    eventType: ExecutionEventType,
    payload: unknown,
  ): Promise<void> {
    await this.websocketService.emitExecutionEvent(
      executionId,
      eventType,
      payload,
    );
  }

  /**
   * **종결 이벤트 전용** 발행 — `completed`/`failed`/`cancelled` 셋만.
   * 그 외 execution 이벤트는 {@link emitExecution} 을 직접 부른다.
   *
   * 호출부는 `status` 와 이벤트 타입을 **적지 않는다** — `type` 에서 파생하므로 둘이
   * 어긋날 수 없다. 종전엔 두 값을 손으로 맞췄고 그게 어긋나도 아무도 안 잡았다.
   *
   * @see TerminalEventPayload — 각 형태의 필수 필드와 그 근거(§6/§6.5).
   */
  async emitTerminalExecution(
    executionId: string,
    payload: TerminalEventPayload,
  ): Promise<void> {
    const { eventType, status } = TERMINAL_SHAPE[payload.type];
    const wire: Record<string, unknown> = {
      status,
      durationMs: payload.durationMs,
    };
    if (payload.type === 'failed') {
      wire.error = payload.error;
    } else if (payload.type === 'cancelled') {
      // §6.5 — `cancelledBy` 는 `result` 안에 온다(필드 집합 표의 중첩을 펴지 않는다).
      wire.result = { cancelledBy: payload.cancelledBy };
      // user cancel 은 키 자체가 없어야 한다 — `null` 로 채우면 계약 위반이다.
      if (payload.error) wire.error = payload.error;
    }
    await this.emitExecution(executionId, eventType, wire);
  }

  /**
   * Node 단위 이벤트 발행 — `execution:<id>` 채널, payload 에 nodeId 첨부.
   * 옛 `websocketService.emitNodeEvent` 와 동작·payload 동일.
   */
  async emitNode(
    executionId: string,
    nodeId: string,
    eventType: NodeEventType,
    payload: unknown,
  ): Promise<void> {
    await this.websocketService.emitNodeEvent(
      executionId,
      nodeId,
      eventType,
      payload,
    );
  }

  /**
   * Execution 단위 outbound 라우팅 컨텍스트 등록 — `WebsocketService` 위임.
   * [Spec Chat Channel §3.1 CCH-AD-05]: 트리거 발화로 시작된 execution 의
   * `triggerId` / `chatChannel` 을 등록하면, 이후 모든 emit 의 fanout
   * envelope 에 자동 첨부되어 `ChatChannelDispatcher` / `NotificationFanout`
   * 가 trigger 식별을 통과할 수 있다. 엔진의 execute() 진입 시점에 1회 호출.
   *
   * **Facade 범위 노트**: 본 메서드는 엄밀히는 "이벤트 발행" 추상화 범위를
   * 벗어난 routing 상태 등록 (현재로선 WebsocketService 전용). 향후 비-WS
   * 채널 (Sentry / OTel) 이 추가될 때 routing 개념이 채널마다 다를 수 있으면
   * 본 facade 가 아닌 별도 routing facade 로 분리하는 것이 자연스럽다.
   */
  registerExecutionRouting(
    executionId: string,
    context: ExecutionRoutingContext,
  ): void {
    this.websocketService.registerExecutionRouting(executionId, context);
  }

  /**
   * Routing context 명시 해제. terminal event 발송 시 자동 release 되므로
   * 일반적으로는 호출 불필요. 엔진이 setup 단계 throw 등으로 terminal event
   * 자체를 emit 하지 못한 경로의 누수 방지용. {@link registerExecutionRouting}
   * 의 facade 범위 노트 동일 적용.
   */
  releaseExecutionRouting(executionId: string): void {
    this.websocketService.releaseExecutionRouting(executionId);
  }
}
