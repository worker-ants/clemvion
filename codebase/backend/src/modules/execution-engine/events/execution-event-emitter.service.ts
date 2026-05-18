import { Injectable } from '@nestjs/common';
import {
  ExecutionEventType,
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
}
