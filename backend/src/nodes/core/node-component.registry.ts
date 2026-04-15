import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { NodeHandlerRegistry } from '../../modules/execution-engine/handlers/node-handler.registry';
import {
  HandlerDependencies,
  NodeComponent,
  NodeComponentMetadata,
  NodePorts,
} from './node-component.interface';

export interface NodeDefinitionView {
  metadata: NodeComponentMetadata;
  ports: NodePorts;
  configSchema: unknown;
  inputSchema?: unknown;
  outputSchema?: unknown;
}

/**
 * Central registry for node components. Bootstraps all components,
 * registers their handlers with the existing handler registry, and
 * exposes metadata/definition views for the frontend.
 */
@Injectable()
export class NodeComponentRegistry {
  private readonly logger = new Logger(NodeComponentRegistry.name);
  private readonly components = new Map<string, NodeComponent>();

  constructor(private readonly handlerRegistry: NodeHandlerRegistry) {}

  bootstrap(components: NodeComponent[], deps: HandlerDependencies): void {
    for (const component of components) {
      const type = component.metadata.type;
      if (this.components.has(type)) {
        throw new Error(`Duplicate node component registration: ${type}`);
      }
      this.components.set(type, component);
      this.handlerRegistry.register(type, component.createHandler(deps));
    }
    this.logger.log(`Registered ${components.length} node components`);
  }

  getComponent(type: string): NodeComponent | undefined {
    return this.components.get(type);
  }

  listMetadata(): NodeComponentMetadata[] {
    return [...this.components.values()].map((c) => c.metadata);
  }

  listDefinitions(): NodeDefinitionView[] {
    return [...this.components.values()].map((c) => ({
      metadata: c.metadata,
      ports: c.ports,
      configSchema: z.toJSONSchema(c.configSchema),
      inputSchema: c.inputSchema ? z.toJSONSchema(c.inputSchema) : undefined,
      outputSchema: c.outputSchema ? z.toJSONSchema(c.outputSchema) : undefined,
    }));
  }
}
