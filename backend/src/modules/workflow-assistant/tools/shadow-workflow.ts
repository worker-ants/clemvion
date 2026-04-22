import { randomUUID } from 'node:crypto';
import {
  validateConfigExpressions,
  ExpressionValidationIssue,
} from './validate-expressions';

export interface ShadowNode {
  id: string;
  type: string;
  category: string;
  label: string;
  positionX: number;
  positionY: number;
  /**
   * React Flow 가 렌더 후 측정한 노드 폭 (px). 초기 렌더 중이거나 Assistant
   * 가 새로 추가한 노드는 아직 측정 전이라 undefined 일 수 있다. 있으면
   * 레이아웃 계산에 사용, 없으면 250px 폴백.
   */
  width?: number;
  /**
   * 노드 높이 (px). width 와 동일한 정책으로, 없으면 80px 폴백.
   */
  height?: number;
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
  | 'INVALID_ARGUMENTS'
  | 'INVALID_EXPRESSION';

export interface ShadowResult {
  ok: boolean;
  id?: string;
  removedEdgeIds?: string[];
  error?: ShadowErrorCode;
  suggested?: string;
  message?: string;
  /**
   * `INVALID_EXPRESSION` 케이스에서 어떤 필드가 어떤 사유로 실패했는지
   * 구조화된 세부 정보. LLM 이 해당 필드만 고쳐서 재시도할 수 있도록
   * 최대 5개까지 싣는다.
   */
  invalidExpressions?: ExpressionValidationIssue[];
}

const MANUAL_TRIGGER = 'manual_trigger';

/**
 * cycle 검사에서 예외로 허용할 container input 포트. `emit` 은 Loop·Foreach·
 * Map 등 컨테이너가 자식 노드의 iteration back-edge 를 받기 위해 선언하는
 * 입력 포트 (nodes/logic/loop/loop.schema.ts 참고). 다른 포트(`in` 등) 로
 * 돌아오는 에지는 정상 iteration 이 아니라 실수·악의적 조작 가능성이 있으니
 * 기존 cycle 판정을 유지한다.
 */
const CONTAINER_LOOPBACK_PORTS: ReadonlySet<string> = new Set(['emit']);

/** containerId 체인 순회 상한 — 데이터 손상 방어용. */
const MAX_CONTAINER_DEPTH = 64;
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

    const exprCheck = validateConfigExpressions(config);
    if (!exprCheck.valid) {
      return {
        ok: false,
        error: 'INVALID_EXPRESSION',
        message: expressionIssuesMessage(exprCheck.issues),
        invalidExpressions: exprCheck.issues.slice(0, 5),
      };
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
      // 패치로 들어온 값만 검사. 기존 노드 config 는 이미 커밋된 상태라
      // 이번 patch 가 유효한지 여부와 독립적이다.
      const exprCheck = validateConfigExpressions(patch.config);
      if (!exprCheck.valid) {
        return {
          ok: false,
          error: 'INVALID_EXPRESSION',
          message: expressionIssuesMessage(exprCheck.issues),
          invalidExpressions: exprCheck.issues.slice(0, 5),
        };
      }
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
    // 자식 → 조상 컨테이너의 `emit` 포트로 돌아가는 에지는 실행 엔진이
    // iteration back-edge 로 해석하는 정상 반복 제어 흐름 (spec §4.4).
    // 이 에지가 전체 그래프에서 만들 수 있는 "간접 cycle" 도 wouldCreateCycle
    // 이 내부에서 일관되게 제외 처리한다 (동일 술어 재사용).
    if (
      !this.shouldBypassCycleCheck(sourceId, targetId, targetPort) &&
      this.wouldCreateCycle(sourceId, targetId)
    ) {
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
    // targetId 에서 출발해 기존 에지들을 따라 sourceId 에 도달 가능한지
    // 검사. 도달 가능하면 `source → target` 추가 시 cycle 이 닫힌다.
    // iteration back-edge (자식 → 조상 컨테이너 emit) 는 O(V×E) 재평가를
    // 피하기 위해 미리 한 번에 계산해 제외한다.
    const bypassEdgeIds = this.collectBypassableEdgeIds();
    const visited = new Set<string>();
    const stack = [targetId];
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur === sourceId) return true;
      if (visited.has(cur)) continue;
      visited.add(cur);
      for (const edge of this.edges.values()) {
        if (edge.sourceNodeId !== cur) continue;
        if (bypassEdgeIds.has(edge.id)) continue;
        stack.push(edge.targetNodeId);
      }
    }
    return false;
  }

  /**
   * 기존 에지 중 "자식 → 조상 컨테이너의 iteration 포트" 형태인 것들의
   * id 를 모은다. DFS 순회에서는 이 집합에 속한 에지를 건너뛰어 false
   * positive 를 제거한다. cycle 판정이 자주 호출되는 hot path 가 아니므로
   * 매 호출마다 O(E × depth) 한 번 계산해도 비용이 작지만, 동일 술어를
   * pre-filter 로 풀어 DFS 내부의 재계산 폭주를 막는다.
   */
  private collectBypassableEdgeIds(): Set<string> {
    const ids = new Set<string>();
    for (const edge of this.edges.values()) {
      if (
        this.shouldBypassCycleCheck(
          edge.sourceNodeId,
          edge.targetNodeId,
          edge.targetPort,
        )
      ) {
        ids.add(edge.id);
      }
    }
    return ids;
  }

  /**
   * 단일 술어 — `addEdge` 의 사전 검사와 `wouldCreateCycle` 의 DFS 내부
   * skip 판정을 한 곳에서 일관되게 다룬다. 조건: source 노드의 조상
   * `containerId` 체인에 target 이 포함되어 있고, target 포트가 허용
   * 포트(`emit`) 중 하나.
   *
   * @param sourceId  에지의 시작 노드 id
   * @param targetId  에지의 끝 노드 id (컨테이너일 것으로 기대)
   * @param targetPort 컨테이너 측 입력 포트 id
   * @returns cycle 검사를 건너뛰어야 하면 true
   */
  private shouldBypassCycleCheck(
    sourceId: string,
    targetId: string,
    targetPort: string,
  ): boolean {
    if (!CONTAINER_LOOPBACK_PORTS.has(targetPort)) return false;
    return this.isAncestorContainer(sourceId, targetId);
  }

  /**
   * `descendantId` 노드의 containerId 체인을 타고 올라가면서
   * `candidateAncestorId` 를 찾는다. 데이터가 손상되어 체인이 스스로
   * 순환하는 케이스를 방어하기 위해 visited Set 과 절대 상한
   * (`MAX_CONTAINER_DEPTH`) 을 둔다.
   *
   * @param descendantId         자식 후보 노드 id
   * @param candidateAncestorId  조상 후보 노드 id
   * @returns `descendantId` 의 조상 체인에 `candidateAncestorId` 가 있으면 true
   */
  private isAncestorContainer(
    descendantId: string,
    candidateAncestorId: string,
  ): boolean {
    const visited = new Set<string>();
    let current = this.nodes.get(descendantId)?.containerId ?? null;
    let depth = 0;
    while (current && depth < MAX_CONTAINER_DEPTH) {
      if (current === candidateAncestorId) return true;
      if (visited.has(current)) return false;
      visited.add(current);
      current = this.nodes.get(current)?.containerId ?? null;
      depth++;
    }
    return false;
  }
}

/**
 * INVALID_EXPRESSION 결과의 message 포맷터. LLM 이 자연어로 한 번에 이해하고
 * 어느 필드를 고쳐야 할지 짚을 수 있도록 경로와 엔진 메세지를 함께 싣는다.
 */
function expressionIssuesMessage(issues: ExpressionValidationIssue[]): string {
  const shown = issues.slice(0, 3);
  const suffix =
    issues.length > shown.length
      ? ` (+${issues.length - shown.length} more)`
      : '';
  return (
    'Invalid expression(s) in config: ' +
    shown.map((i) => `${i.path}: ${i.message}`).join('; ') +
    suffix
  );
}
