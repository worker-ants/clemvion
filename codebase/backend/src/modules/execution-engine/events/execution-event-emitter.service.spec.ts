import { ExecutionEventEmitter } from './execution-event-emitter.service';
import {
  ExecutionEventType,
  ExecutionRoutingContext,
  NodeEventType,
  WebsocketService,
} from '../../websocket/websocket.service';

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
