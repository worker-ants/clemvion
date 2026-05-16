import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { NodeHandlerRegistry } from './node-handler.registry';
import {
  HandlerDependencies,
  NodeComponent,
  NodeComponentMetadata,
  NodePorts,
} from './node-component.interface';
import { NODE_CATEGORIES, NodeCategoryMeta } from './categories';

export interface NodeDefinitionView {
  metadata: NodeComponentMetadata;
  ports: NodePorts;
  configSchema: unknown;
  /**
   * Resolved default config. Prefers explicit `metadata.defaultConfig`; falls
   * back to `configSchema.parse({})` which populates fields declared with
   * `.default(...)` in the zod schema.
   */
  defaultConfig: Record<string, unknown>;
  inputSchema?: unknown;
  outputSchema?: unknown;
  /**
   * Optional component-specific extras shipped to the frontend (see
   * `NodeComponent.extras` JSDoc). Currently used only by the cafe24 node
   * to deliver the operations-by-resource catalog so the dynamic form can
   * render Operation select + typed Fields without an extra round trip.
   */
  extras?: unknown;
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
      // PR-G — `executionMetadata` 를 함께 등록해 엔진의 dispatch 가
      // hard-coded 문자열 분기 대신 metadata flag 를 보도록 한다.
      this.handlerRegistry.register(
        type,
        component.createHandler(deps),
        component.metadata.executionMetadata,
      );
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
      metadata: this.serializeMetadata(c.metadata),
      ports: c.ports,
      configSchema: z.toJSONSchema(c.configSchema),
      defaultConfig: this.resolveDefaultConfig(c),
      inputSchema: c.inputSchema ? z.toJSONSchema(c.inputSchema) : undefined,
      outputSchema: c.outputSchema ? z.toJSONSchema(c.outputSchema) : undefined,
      extras: c.extras?.(),
    }));
  }

  /**
   * Strip backend-only fields from metadata before shipping it to the
   * frontend through `GET /nodes/definitions`. `validateConfig` is a
   * function (not JSON-serializable) and represents imperative checks that
   * only the backend `handler.validate()` runs. The frontend gets the
   * declarative {@link WarningRule}[] in `warningRules` instead — that is
   * the SSOT for the canvas badge.
   */
  private serializeMetadata(
    metadata: NodeComponentMetadata,
  ): NodeComponentMetadata {
    const { validateConfig: _validateConfig, ...rest } = metadata;
    void _validateConfig;
    return rest as NodeComponentMetadata;
  }

  listCategories(): NodeCategoryMeta[] {
    return [...NODE_CATEGORIES].sort((a, b) => a.order - b.order);
  }

  private resolveDefaultConfig(c: NodeComponent): Record<string, unknown> {
    if (c.metadata.defaultConfig) return c.metadata.defaultConfig;
    const parsed = c.configSchema.safeParse({});
    return parsed.success ? parsed.data : {};
  }

  /**
   * Run a raw config object through the node's zod schema so `.default(...)`
   * values get populated. Used by workflow import to match the canvas-creation
   * default behavior.
   *
   * - Unknown nodeType: returns rawConfig unchanged (forward-compat).
   * - Parse failure (hand-edited JSON, type mismatch): warns and returns
   *   rawConfig unchanged so import stays permissive — user can fix in editor.
   */
  applyConfigDefaults(
    nodeType: string,
    rawConfig: Record<string, unknown>,
  ): Record<string, unknown> {
    const component = this.getComponent(nodeType);
    if (!component) return rawConfig;
    const parsed = component.configSchema.safeParse(rawConfig);
    if (!parsed.success) {
      this.logger.warn(
        `applyConfigDefaults: parse failed for "${nodeType}", returning raw config (issues=${JSON.stringify(parsed.error.issues)})`,
      );
      return rawConfig;
    }
    return parsed.data;
  }
}
