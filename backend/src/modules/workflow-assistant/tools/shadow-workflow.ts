import { randomUUID } from 'node:crypto';

export interface ShadowNode {
  id: string;
  type: string;
  category: string;
  label: string;
  positionX: number;
  positionY: number;
  config: Record<string, unknown>;
  isDisabled?: boolean;
  description?: string | null;
  containerId?: string | null;
  toolOwnerId?: string | null;
}

export interface ShadowEdge {
  id: string;
  sourceNodeId: string;
  sourcePort: string;
  targetNodeId: string;
  targetPort: string;
  type: 'data' | 'error';
}

export interface ShadowSnapshot {
  nodes: ShadowNode[];
  edges: ShadowEdge[];
}

export type ShadowToolName =
  | 'add_node'
  | 'update_node'
  | 'remove_node'
  | 'add_edge'
  | 'remove_edge';

export interface ShadowToolCall {
  name: ShadowToolName;
  arguments: Record<string, unknown>;
}

export type ShadowErrorCode =
  | 'UNKNOWN_TOOL'
  | 'UNKNOWN_NODE_TYPE'
  | 'LABEL_CONFLICT'
  | 'NODE_NOT_FOUND'
  | 'EDGE_NOT_FOUND'
  | 'MANUAL_TRIGGER_PROTECTED'
  | 'CONTAINER_INVALID_CHILD'
  | 'CYCLE_DETECTED'
  | 'INVALID_ARGUMENTS';

export interface ShadowResult {
  ok: boolean;
  id?: string;
  removedEdgeIds?: string[];
  error?: ShadowErrorCode;
  suggested?: string;
  message?: string;
}

const MANUAL_TRIGGER = 'manual_trigger';
const DEFAULT_CATEGORY_BY_KNOWN_TYPES: Record<string, string> = {
  manual_trigger: 'trigger',
};

/**
 * In-memory replica of the editor's workflow state used by the AI Assistant
 * to validate and sequence tool calls before they are emitted to the client.
 *
 * Policy: never touches the database. The editor-store on the frontend applies
 * each successful call optimistically; persistence happens only via the user's
 * Save (manual or auto-save debounce), exactly as with hand-edited changes.
 */
export class ShadowWorkflow {
  private nodes: Map<string, ShadowNode>;
  private edges: Map<string, ShadowEdge>;

  constructor(
    snapshot: ShadowSnapshot,
    private readonly knownNodeTypes: Set<string>,
    private readonly categoryByType: Record<string, string> = {},
  ) {
    this.nodes = new Map(snapshot.nodes.map((n) => [n.id, { ...n }]));
    this.edges = new Map(snapshot.edges.map((e) => [e.id, { ...e }]));
  }

  snapshot(): ShadowSnapshot {
    return {
      nodes: [...this.nodes.values()].map((n) => ({ ...n })),
      edges: [...this.edges.values()].map((e) => ({ ...e })),
    };
  }

  apply(call: ShadowToolCall): ShadowResult {
    switch (call.name) {
      case 'add_node':
        return this.addNode(call.arguments);
      case 'update_node':
        return this.updateNode(call.arguments);
      case 'remove_node':
        return this.removeNode(call.arguments);
      case 'add_edge':
        return this.addEdge(call.arguments);
      case 'remove_edge':
        return this.removeEdge(call.arguments);
      default:
        return { ok: false, error: 'UNKNOWN_TOOL' };
    }
  }

  private addNode(args: Record<string, unknown>): ShadowResult {
    const type = typeof args.type === 'string' ? args.type : '';
    const label = typeof args.label === 'string' ? args.label : '';
    const position = args.position as { x?: number; y?: number } | undefined;
    const config = (args.config as Record<string, unknown>) ?? {};
    const containerId =
      typeof args.containerId === 'string' ? args.containerId : null;

    if (!type || !label) {
      return { ok: false, error: 'INVALID_ARGUMENTS' };
    }
    if (type !== MANUAL_TRIGGER && !this.knownNodeTypes.has(type)) {
      return { ok: false, error: 'UNKNOWN_NODE_TYPE' };
    }
    const conflict = this.findByLabel(label);
    if (conflict) {
      return {
        ok: false,
        error: 'LABEL_CONFLICT',
        suggested: this.suggestLabel(label),
      };
    }
    if (containerId) {
      const container = this.nodes.get(containerId);
      if (!container) return { ok: false, error: 'NODE_NOT_FOUND' };
      if (this.isTriggerCategory(type)) {
        return { ok: false, error: 'CONTAINER_INVALID_CHILD' };
      }
    }

    const id = randomUUID();
    this.nodes.set(id, {
      id,
      type,
      category: this.resolveCategory(type),
      label,
      positionX: Number(position?.x ?? 0),
      positionY: Number(position?.y ?? 0),
      config,
      isDisabled: false,
      containerId,
    });
    return { ok: true, id };
  }

  private updateNode(args: Record<string, unknown>): ShadowResult {
    const id = typeof args.id === 'string' ? args.id : '';
    const patch =
      (args.patch as
        | {
            label?: string;
            config?: Record<string, unknown>;
            position?: { x?: number; y?: number };
          }
        | undefined) ?? {};
    const node = this.nodes.get(id);
    if (!node) return { ok: false, error: 'NODE_NOT_FOUND' };

    if (patch.label && patch.label !== node.label) {
      const conflict = this.findByLabel(patch.label);
      if (conflict) {
        return {
          ok: false,
          error: 'LABEL_CONFLICT',
          suggested: this.suggestLabel(patch.label),
        };
      }
      node.label = patch.label;
    }
    if (patch.config) {
      node.config = { ...node.config, ...patch.config };
    }
    if (patch.position) {
      if (patch.position.x !== undefined)
        node.positionX = Number(patch.position.x);
      if (patch.position.y !== undefined)
        node.positionY = Number(patch.position.y);
    }
    this.nodes.set(id, node);
    return { ok: true, id };
  }

  private removeNode(args: Record<string, unknown>): ShadowResult {
    const id = typeof args.id === 'string' ? args.id : '';
    const node = this.nodes.get(id);
    if (!node) return { ok: false, error: 'NODE_NOT_FOUND' };
    if (node.type === MANUAL_TRIGGER) {
      return { ok: false, error: 'MANUAL_TRIGGER_PROTECTED' };
    }
    const removedEdgeIds: string[] = [];
    for (const [edgeId, edge] of this.edges.entries()) {
      if (edge.sourceNodeId === id || edge.targetNodeId === id) {
        this.edges.delete(edgeId);
        removedEdgeIds.push(edgeId);
      }
    }
    this.nodes.delete(id);
    return { ok: true, id, removedEdgeIds };
  }

  private addEdge(args: Record<string, unknown>): ShadowResult {
    const sourceId =
      typeof args.source_id === 'string'
        ? args.source_id
        : typeof args.sourceId === 'string'
          ? args.sourceId
          : '';
    const targetId =
      typeof args.target_id === 'string'
        ? args.target_id
        : typeof args.targetId === 'string'
          ? args.targetId
          : '';
    const sourcePort =
      (typeof args.source_port === 'string' ? args.source_port : undefined) ??
      (typeof args.sourcePort === 'string' ? args.sourcePort : undefined) ??
      'out';
    const targetPort =
      (typeof args.target_port === 'string' ? args.target_port : undefined) ??
      (typeof args.targetPort === 'string' ? args.targetPort : undefined) ??
      'in';
    const edgeType: 'data' | 'error' = args.type === 'error' ? 'error' : 'data';

    if (!sourceId || !targetId) {
      return { ok: false, error: 'INVALID_ARGUMENTS' };
    }
    if (sourceId === targetId) {
      return { ok: false, error: 'CYCLE_DETECTED' };
    }
    if (!this.nodes.has(sourceId) || !this.nodes.has(targetId)) {
      return { ok: false, error: 'NODE_NOT_FOUND' };
    }
    if (this.wouldCreateCycle(sourceId, targetId)) {
      return { ok: false, error: 'CYCLE_DETECTED' };
    }
    const id = randomUUID();
    this.edges.set(id, {
      id,
      sourceNodeId: sourceId,
      sourcePort,
      targetNodeId: targetId,
      targetPort,
      type: edgeType,
    });
    return { ok: true, id };
  }

  private removeEdge(args: Record<string, unknown>): ShadowResult {
    const id = typeof args.id === 'string' ? args.id : '';
    if (id && this.edges.has(id)) {
      this.edges.delete(id);
      return { ok: true, id };
    }
    // fallback: source/target/port tuple
    const sourceId = typeof args.source_id === 'string' ? args.source_id : '';
    const targetId = typeof args.target_id === 'string' ? args.target_id : '';
    if (sourceId && targetId) {
      for (const [edgeId, edge] of this.edges.entries()) {
        if (edge.sourceNodeId === sourceId && edge.targetNodeId === targetId) {
          this.edges.delete(edgeId);
          return { ok: true, id: edgeId };
        }
      }
    }
    return { ok: false, error: 'EDGE_NOT_FOUND' };
  }

  private findByLabel(label: string): ShadowNode | undefined {
    for (const n of this.nodes.values()) {
      if (n.label === label) return n;
    }
    return undefined;
  }

  private suggestLabel(base: string): string {
    for (let i = 2; i < 100; i++) {
      const candidate = `${base} (${i})`;
      if (!this.findByLabel(candidate)) return candidate;
    }
    return `${base} (${randomUUID().slice(0, 4)})`;
  }

  private resolveCategory(type: string): string {
    return (
      this.categoryByType[type] ??
      DEFAULT_CATEGORY_BY_KNOWN_TYPES[type] ??
      'logic'
    );
  }

  private isTriggerCategory(type: string): boolean {
    return this.resolveCategory(type) === 'trigger';
  }

  private wouldCreateCycle(sourceId: string, targetId: string): boolean {
    // Check if targetId can reach sourceId via existing edges → adding
    // source → target would close the cycle.
    const visited = new Set<string>();
    const stack = [targetId];
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur === sourceId) return true;
      if (visited.has(cur)) continue;
      visited.add(cur);
      for (const edge of this.edges.values()) {
        if (edge.sourceNodeId === cur) stack.push(edge.targetNodeId);
      }
    }
    return false;
  }
}
