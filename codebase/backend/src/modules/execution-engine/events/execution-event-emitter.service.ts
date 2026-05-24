import { Injectable } from '@nestjs/common';
import {
  ExecutionEventType,
  ExecutionRoutingContext,
  NodeEventType,
  WebsocketService,
} from '../../websocket/websocket.service';

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
 */
@Injectable()
export class ExecutionEventEmitter {
  constructor(private readonly websocketService: WebsocketService) {}

  /**
   * Execution 단위 이벤트 발행 — `execution:<id>` 채널.
   * 옛 `websocketService.emitExecutionEvent` 와 동작·payload 동일.
   */
  emitExecution(
    executionId: string,
    eventType: ExecutionEventType,
    payload: unknown,
  ): void {
    this.websocketService.emitExecutionEvent(executionId, eventType, payload);
  }

  /**
   * Node 단위 이벤트 발행 — `execution:<id>` 채널, payload 에 nodeId 첨부.
   * 옛 `websocketService.emitNodeEvent` 와 동작·payload 동일.
   */
  emitNode(
    executionId: string,
    nodeId: string,
    eventType: NodeEventType,
    payload: unknown,
  ): void {
    this.websocketService.emitNodeEvent(
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
