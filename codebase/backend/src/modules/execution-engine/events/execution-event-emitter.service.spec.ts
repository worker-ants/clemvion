import {
  ExecutionEventEmitter,
  type TerminalEventPayload,
} from './execution-event-emitter.service';
import { WebsocketService } from '../../websocket/websocket.service';
import {
  ExecutionEventType,
  type ExecutionRoutingContext,
  NodeEventType,
} from '../../websocket/websocket-events.types';

describe('ExecutionEventEmitter', () => {
  let websocket: {
    emitExecutionEvent: jest.Mock;
    emitNodeEvent: jest.Mock;
    registerExecutionRouting: jest.Mock;
    releaseExecutionRouting: jest.Mock;
  };
  let emitter: ExecutionEventEmitter;

  beforeEach(() => {
    websocket = {
      emitExecutionEvent: jest.fn(),
      emitNodeEvent: jest.fn(),
      registerExecutionRouting: jest.fn(),
      releaseExecutionRouting: jest.fn(),
    };
    emitter = new ExecutionEventEmitter(
      websocket as unknown as WebsocketService,
    );
  });

  // 이 파사드의 **존재 이유**를 회귀로 박제한다 — 필수 필드가 실제로 컴파일을 막는가.
  //
  // ⚠️ **강제하는 것은 jest 가 아니라 `tsc` 다.** 이 저장소의 jest 는 타입을 strip 하므로
  // 아래 `it` 은 런타임에 사실상 no-op 이다(실측: `cancelledBy` 를 optional 로 완화해도
  // jest 는 9/9 GREEN). 실제 가드는 **타입 래칫 게이트**(`scripts/check-backend-typecheck-
  // ratchet.py`)다 — 같은 뮤턴트에서 `tsc` 진단이 199 → 204 로 늘어 게이트가 깨진다
  // (미사용 `@ts-expect-error` 5건). 처음엔 "ts-jest 가 타입체크한다" 고 적었는데
  // **틀렸고, 뮤테이션이 반증했다**.
  //
  // 손으로 확인한 뮤테이션은 그 순간에만 참이다. 저장소에 남는 건 이 선언들이다.
  describe('TerminalEventPayload — 필수 필드가 컴파일을 막는다', () => {
    it('타입 수준 계약 (런타임 no-op)', () => {
      const reject: unknown[] = [
        // durationMs 누락 — #1171 이 겪은 결함
        // @ts-expect-error durationMs 는 3종 모두 필수다
        { type: 'completed' } satisfies TerminalEventPayload,
        // error 누락 — #1170 이 겪은 결함
        // @ts-expect-error failed 는 error 가 필수다
        { type: 'failed', durationMs: 1 } satisfies TerminalEventPayload,
        // cancelledBy 누락 — retry-turn 이 겪던 결함
        // @ts-expect-error cancelled 는 cancelledBy 가 필수다
        { type: 'cancelled', durationMs: 1 } satisfies TerminalEventPayload,
        // 닫힌 3값 union 을 넓히지 않는다 (§6.5).
        // **지시문은 위반 속성 바로 위에** — 여러 줄 리터럴은 에러가 객체 시작 줄이 아니라
        // 속성 줄에 보고된다(처음엔 객체 위에 뒀다가 `Unused '@ts-expect-error'` 로 반증).
        {
          type: 'cancelled',
          durationMs: 1,
          // @ts-expect-error cancelledBy 는 user|system|timeout 뿐이다
          cancelledBy: 'admin',
        } satisfies TerminalEventPayload,
        // completed 에는 error 를 실을 수 없다 — 형태별 필드가 섞이지 않는다
        {
          type: 'completed',
          durationMs: 1,
          // @ts-expect-error completed variant 에 error 는 없다
          error: null,
        } satisfies TerminalEventPayload,
      ];
      expect(reject).toHaveLength(5);
    });
  });

  // 종결 payload 의 **wire 형태**를 여기서 고정한다. 호출부는 `type` 만 고르고 이 파일이
  // `status`·이벤트명·중첩을 만든다 — 종전엔 그 조립이 11 호출부에 흩어져 있었고, 한 곳을
  // 빠뜨려도 아무도 안 잡았다.
  describe('emitTerminalExecution — 종결 payload wire 형태', () => {
    it('completed — status 를 type 에서 파생하고 durationMs 를 싣는다', async () => {
      await emitter.emitTerminalExecution('e1', {
        type: 'completed',
        durationMs: 4242,
      });
      expect(websocket.emitExecutionEvent).toHaveBeenCalledWith(
        'e1',
        ExecutionEventType.EXECUTION_COMPLETED,
        { status: 'completed', durationMs: 4242 },
      );
    });

    it('failed — error 객체를 그대로 싣는다 (§6.4)', async () => {
      const error = { code: 'NODE_FAILED', message: 'boom', nodeId: null };
      await emitter.emitTerminalExecution('e2', {
        type: 'failed',
        durationMs: null,
        error,
      });
      expect(websocket.emitExecutionEvent).toHaveBeenCalledWith(
        'e2',
        ExecutionEventType.EXECUTION_FAILED,
        { status: 'failed', durationMs: null, error },
      );
    });

    it('failed — error 가 null 이어도 **키는 유지**한다 (§6.4 명시적 null)', async () => {
      await emitter.emitTerminalExecution('e5', {
        type: 'failed',
        durationMs: 1,
        error: null,
      });
      const wire = websocket.emitExecutionEvent.mock.calls[0][2] as object;
      // 조건부 대입으로 잘못 리팩터되면 키가 사라진다 — `null` 과 부재는 다르다.
      expect('error' in wire).toBe(true);
      expect((wire as { error: unknown }).error).toBeNull();
    });

    it('cancelled — cancelledBy 는 result 안에 온다 (§6.5, 중첩을 펴지 않는다)', async () => {
      await emitter.emitTerminalExecution('e3', {
        type: 'cancelled',
        durationMs: 7200000,
        cancelledBy: 'timeout',
        error: { code: 'WEBCHAT_IDLE_TIMEOUT', message: 'idle' },
      });
      expect(websocket.emitExecutionEvent).toHaveBeenCalledWith(
        'e3',
        ExecutionEventType.EXECUTION_CANCELLED,
        {
          status: 'cancelled',
          durationMs: 7200000,
          result: { cancelledBy: 'timeout' },
          error: { code: 'WEBCHAT_IDLE_TIMEOUT', message: 'idle' },
        },
      );
    });

    it('cancelled — user cancel 은 error **키 자체가 없다** (`null` 이 아니라 부재, §6.5)', async () => {
      await emitter.emitTerminalExecution('e4', {
        type: 'cancelled',
        durationMs: 100,
        cancelledBy: 'user',
      });
      const wire = websocket.emitExecutionEvent.mock.calls[0][2] as object;
      // `toHaveBeenCalledWith` 는 `{error: undefined}` 도 통과시킨다 — 키 부재를
      // 직접 물어야 이 계약이 실제로 잠긴다.
      expect(Object.keys(wire).sort()).toEqual([
        'durationMs',
        'result',
        'status',
      ]);
      expect('error' in wire).toBe(false);
    });
  });

  it('emitExecution delegates to WebsocketService.emitExecutionEvent verbatim', async () => {
    const payload = { foo: 'bar' };
    await emitter.emitExecution(
      'exec-1',
      ExecutionEventType.EXECUTION_STARTED,
      payload,
    );
    expect(websocket.emitExecutionEvent).toHaveBeenCalledTimes(1);
    expect(websocket.emitExecutionEvent).toHaveBeenCalledWith(
      'exec-1',
      ExecutionEventType.EXECUTION_STARTED,
      payload,
    );
  });

  it('emitNode delegates to WebsocketService.emitNodeEvent verbatim', async () => {
    const payload = { status: 'ok' };
    await emitter.emitNode(
      'exec-1',
      'node-9',
      NodeEventType.NODE_COMPLETED,
      payload,
    );
    expect(websocket.emitNodeEvent).toHaveBeenCalledTimes(1);
    expect(websocket.emitNodeEvent).toHaveBeenCalledWith(
      'exec-1',
      'node-9',
      NodeEventType.NODE_COMPLETED,
      payload,
    );
  });

  it('registerExecutionRouting delegates to WebsocketService.registerExecutionRouting', () => {
    const context: ExecutionRoutingContext = {
      triggerId: 'trg-1',
      workflowId: 'wf-1',
    };
    emitter.registerExecutionRouting('exec-1', context);
    expect(websocket.registerExecutionRouting).toHaveBeenCalledTimes(1);
    expect(websocket.registerExecutionRouting).toHaveBeenCalledWith(
      'exec-1',
      context,
    );
  });

  it('releaseExecutionRouting delegates to WebsocketService.releaseExecutionRouting', () => {
    emitter.releaseExecutionRouting('exec-1');
    expect(websocket.releaseExecutionRouting).toHaveBeenCalledTimes(1);
    expect(websocket.releaseExecutionRouting).toHaveBeenCalledWith('exec-1');
  });
});
