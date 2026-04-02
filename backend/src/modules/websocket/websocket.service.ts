import { Injectable } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';

export enum ExecutionEventType {
  EXECUTION_STARTED = 'execution.started',
  EXECUTION_COMPLETED = 'execution.completed',
  EXECUTION_FAILED = 'execution.failed',
  EXECUTION_CANCELLED = 'execution.cancelled',
  EXECUTION_WAITING_FOR_INPUT = 'execution.waiting_for_input',
}

export enum NodeEventType {
  NODE_STARTED = 'execution.node.started',
  NODE_COMPLETED = 'execution.node.completed',
  NODE_FAILED = 'execution.node.failed',
  NODE_SKIPPED = 'execution.node.skipped',
}

@Injectable()
export class WebsocketService {
  constructor(private readonly gateway: WebsocketGateway) {}

  emitExecutionEvent(
    executionId: string,
    eventType: ExecutionEventType,
    payload: unknown,
  ): void {
    const channel = `execution:${executionId}`;
    this.gateway.broadcastToChannel(channel, eventType, {
      executionId,
      ...((payload && typeof payload === 'object'
        ? payload
        : { data: payload }) as Record<string, unknown>),
      timestamp: new Date().toISOString(),
    });
  }

  emitNodeEvent(
    executionId: string,
    nodeId: string,
    eventType: NodeEventType,
    payload: unknown,
  ): void {
    const channel = `execution:${executionId}`;
    this.gateway.broadcastToChannel(channel, eventType, {
      executionId,
      nodeId,
      ...((payload && typeof payload === 'object'
        ? payload
        : { data: payload }) as Record<string, unknown>),
      timestamp: new Date().toISOString(),
    });
  }
}
