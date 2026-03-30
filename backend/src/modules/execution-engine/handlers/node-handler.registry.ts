import { Injectable } from '@nestjs/common';
import { NodeHandler } from './node-handler.interface';

@Injectable()
export class NodeHandlerRegistry {
  private readonly handlers = new Map<string, NodeHandler>();

  register(type: string, handler: NodeHandler): void {
    this.handlers.set(type, handler);
  }

  get(type: string): NodeHandler {
    const handler = this.handlers.get(type);
    if (!handler) {
      throw new Error(`UNKNOWN_NODE_TYPE: No handler registered for node type "${type}"`);
    }
    return handler;
  }

  has(type: string): boolean {
    return this.handlers.has(type);
  }
}
