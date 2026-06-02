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
