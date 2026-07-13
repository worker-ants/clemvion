import { getNodeDefinition } from "@/lib/node-definitions";
import { resolveDynamicPorts } from "@/lib/node-definitions/resolve-dynamic-ports";
import type { Node, Edge } from "@xyflow/react";

/**
 * Port type classification for edge coloring.
 * Matches the handle color scheme in custom-node.tsx:
 *   data → green, system → blue, error → red, container → purple
 */
export type EdgePortType = "data" | "error" | "system" | "container";

export const PORT_TYPE_COLORS: Record<EdgePortType, string> = {
  data: "#22c55e",
  system: "#3b82f6",
  error: "#ef4444",
  container: "#a855f7",
};

/**
 * Resolve the port type for an edge based on the source handle name and source
 * node type. This mirrors the handle color logic in custom-node.tsx so edges
 * match the color of their source port.
 */
export function resolvePortType(
  sourceHandle: string | null | undefined,
  sourceNodeType: string,
): EdgePortType {
  if (!sourceHandle) return "data";

  // Container body output
  if (sourceHandle === "body") return "container";

  // Error port
  if (sourceHandle === "error") return "error";

  // AI Agent system ports
  if (sourceNodeType === "ai_agent") {
    if (sourceHandle === "out" || sourceHandle === "user_ended" || sourceHandle === "max_turns") {
      return "system";
    }
    // Custom condition ports are data
    return "data";
  }

  // Container "done" port is a system flow port
  const def = getNodeDefinition(sourceNodeType);
  if (def?.isContainer && sourceHandle === "done") return "system";

  // Check static definition for error ports
  if (def) {
    const port = def.outputs.find((p) => p.id === sourceHandle);
    if (port?.type === "error") return "error";
  }

  return "data";
}

/**
 * Get the color string for an edge based on its port type.
 */
export function getEdgeColor(portType: EdgePortType): string {
  return PORT_TYPE_COLORS[portType];
}

/**
 * Build edge data with port type information for a new edge.
 */
export function buildEdgeData(
  sourceHandle: string | null | undefined,
  sourceNodeType: string,
): Record<string, unknown> {
  const portType = resolvePortType(sourceHandle, sourceNodeType);
  return {
    sourcePort: sourceHandle ?? "out",
    portType,
    portColor: PORT_TYPE_COLORS[portType],
  };
}

/**
 * 자기 자신으로의 연결 여부 (source === target). §2.2 — 항상 금지(never valid).
 * `isValidConnection` 이 드래그 중 커서 🚫 로 차단한다.
 */
export function isSelfConnection(connection: {
  source?: string | null;
  target?: string | null;
}): boolean {
  return (
    connection.source != null && connection.source === connection.target
  );
}

/**
 * 동일 연결 중복 여부 (§2.2). 같은 (source, sourceHandle, target, targetHandle)
 * 조합이 이미 존재하면 true. React Flow `addEdge` 도 동일 조합을 dedupe 하지만,
 * 명시 검사로 "already connected" 토스트를 띄우기 위해 별도 판정한다.
 */
export function isDuplicateConnection(
  edges: Edge[],
  connection: {
    source?: string | null;
    target?: string | null;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  },
): boolean {
  return edges.some(
    (e) =>
      e.source === connection.source &&
      e.target === connection.target &&
      (e.sourceHandle ?? null) === (connection.sourceHandle ?? null) &&
      (e.targetHandle ?? null) === (connection.targetHandle ?? null),
  );
}

/**
 * onConnectEnd 의 connectionState 로 "출력 포트 드래그가 유효 target 없이 빈 영역(pane)에
 * 드롭됐는가" 판정 (§1.2). React Flow 는 유효 핸들에 연결되면 `isValid=true` 를 준다 —
 * pane 드롭·무효 target 은 `isValid` 가 `false`/`null` 이므로 `true` 가 아님으로 판정한다.
 */
export function isConnectionDroppedOnPane(
  connectionState: { isValid?: boolean | null } | null | undefined,
): boolean {
  return !!connectionState && connectionState.isValid !== true;
}

/**
 * 컨테이너 loopback 수집용 예약 입력 포트 id. 자식이 조상 컨테이너의 이 포트로 돌아간다
 * (SoT: backend `shadow-workflow.ts` `CONTAINER_LOOPBACK_PORTS = {'emit'}`). 자동 연결의
 * 기본 target 에서 제외한다 — 예약 포트로 연결하면 `detectContainerConflict` 가 거부한다.
 */
const RESERVED_INPUT_HANDLE_IDS = new Set(["emit"]);

/**
 * 노드 정의의 첫 **일반** 입력 포트 핸들 id (§1.2 자동 엣지 연결의 targetHandle). 예약 입력
 * 포트(컨테이너 `emit`)는 건너뛴다 — 컨테이너 노드의 첫 입력이 `emit` 이면 그 포트로 자동
 * 연결 시 `detectContainerConflict` 가 거부해 엣지 없는 orphan 노드가 남기 때문. 일반 입력
 * 포트가 없으면(트리거 노드, 또는 예약 포트만 있는 경우) null — 이 경우 자동 연결을 생략한다.
 * 신규 생성 노드는 기본 config 라 static `inputs` 로 충분하다(동적 포트 해석 불필요).
 */
export function firstInputHandleId(
  definition: { inputs?: Array<{ id: string }> } | null | undefined,
): string | null {
  const inputs = definition?.inputs;
  if (!inputs) return null;
  return inputs.find((p) => !RESERVED_INPUT_HANDLE_IDS.has(p.id))?.id ?? null;
}

/**
 * §1.2 — onConnectEnd 의 connectionState 에서 "빈 영역 드롭 + 출력 포트 시작" 인 연결원을
 * 추출한다. 유효 연결(onConnect 가 처리)이거나 입력 포트(target 타입)에서 시작한 역방향
 * 드래그면 null — 후자는 §1.3 소관이라 여기서 배제한다. React Flow v12 는 fromNode/fromHandle
 * 로 연결원을 제공한다. onConnectEnd 배선 로직을 단위 테스트 가능한 순수 함수로 분리한다.
 */
export function connectionDragSource(
  connectionState:
    | {
        isValid?: boolean | null;
        fromNode?: { id: string } | null;
        fromHandle?: { id?: string | null; type?: string } | null;
      }
    | null
    | undefined,
): { nodeId: string; handleId: string | null } | null {
  if (!isConnectionDroppedOnPane(connectionState)) return null;
  const fromNode = connectionState?.fromNode;
  const fromHandle = connectionState?.fromHandle;
  if (!fromNode || fromHandle?.type !== "source") return null;
  return { nodeId: fromNode.id, handleId: fromHandle.id ?? null };
}

/**
 * 마우스/터치 이벤트에서 clientX/clientY 를 추출한다. React Flow 의 onConnectEnd 는 네이티브
 * `MouseEvent | TouchEvent` 를 넘기므로 터치는 `changedTouches[0]` 에서 좌표를 읽는다. 좌표를
 * 얻을 수 없으면(빈 터치 리스트) null.
 */
export function pointerClientPosition(
  event: MouseEvent | TouchEvent,
): { clientX: number; clientY: number } | null {
  if ("changedTouches" in event) {
    const t = event.changedTouches[0];
    return t ? { clientX: t.clientX, clientY: t.clientY } : null;
  }
  return { clientX: event.clientX, clientY: event.clientY };
}

/**
 * §1.2 자동 엣지 연결의 Connection 을 조립한다. 대상 노드에 입력 포트가 없으면(예: 트리거)
 * `firstInputHandleId` 가 null 이라 연결을 생략(null 반환)한다. source→새 노드 조합은
 * 자기연결·중복이 아니므로 `onConnect` 의 그 두 검증은 항상 통과한다(컨테이너 충돌은 현재
 * 노드 정의상 첫 입력이 데이터 포트라 발생하지 않는다).
 */
export function buildAutoConnectConnection(
  source: { nodeId: string; handleId: string | null },
  newNodeId: string,
  definition: { inputs?: Array<{ id: string }> } | null | undefined,
): {
  source: string;
  sourceHandle: string | null;
  target: string;
  targetHandle: string;
} | null {
  const targetHandle = firstInputHandleId(definition);
  if (!targetHandle) return null;
  return {
    source: source.nodeId,
    sourceHandle: source.handleId,
    target: newNodeId,
    targetHandle,
  };
}

/**
 * Get connected edge IDs for a given node.
 */
export function getConnectedEdgeIds(nodeId: string, edges: Edge[]): Set<string> {
  const ids = new Set<string>();
  for (const edge of edges) {
    if (edge.source === nodeId || edge.target === nodeId) {
      ids.add(edge.id);
    }
  }
  return ids;
}

/**
 * Drop edges that reference a handle which no longer exists on the current
 * node — typically happens when a node's dynamic-port config has changed
 * since the workflow was saved (e.g. AI Agent switched single_turn → multi_turn,
 * Info Extractor mode flip, Switch/Classifier case removal). React Flow logs
 * a `Couldn't create edge for source handle id: "..."` warning for each such
 * edge, and the edge is rendered as a disconnected stub.
 *
 * Returns both the kept edges and the ones dropped — callers can surface the
 * drop to the user (e.g. a toast) so the implicit deletion isn't silent.
 *
 * Called at load time, before edges enter the store.
 */
export function dropStaleEdges(
  edges: Edge[],
  nodes: Node[],
): { edges: Edge[]; dropped: Edge[] } {
  const nodeMap = new Map<string, Node>();
  for (const n of nodes) nodeMap.set(n.id, n);

  // `null` means "definition not available — skip validation". This keeps
  // permissive behaviour distinct from "this node has zero valid ports".
  const outputsByNode = new Map<string, Set<string> | null>();
  const inputsByNode = new Map<string, Set<string> | null>();

  function validOutputs(node: Node): Set<string> | null {
    if (outputsByNode.has(node.id)) return outputsByNode.get(node.id) ?? null;
    const data = node.data as { type?: string; config?: Record<string, unknown> };
    const def = data.type ? getNodeDefinition(data.type) : undefined;
    if (!def) {
      outputsByNode.set(node.id, null);
      return null;
    }
    const ports = resolveDynamicPorts(data.type ?? "", data.config ?? {}, def);
    const set = new Set(ports.map((p) => p.id));
    outputsByNode.set(node.id, set);
    return set;
  }

  function validInputs(node: Node): Set<string> | null {
    if (inputsByNode.has(node.id)) return inputsByNode.get(node.id) ?? null;
    const data = node.data as { type?: string };
    const def = data.type ? getNodeDefinition(data.type) : undefined;
    if (!def) {
      inputsByNode.set(node.id, null);
      return null;
    }
    const set = new Set(def.inputs.map((p) => p.id));
    inputsByNode.set(node.id, set);
    return set;
  }

  const kept: Edge[] = [];
  const dropped: Edge[] = [];
  for (const edge of edges) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) {
      dropped.push(edge);
      continue;
    }

    const sourceOutputs = validOutputs(source);
    if (sourceOutputs && edge.sourceHandle && !sourceOutputs.has(edge.sourceHandle)) {
      dropped.push(edge);
      continue;
    }

    const targetInputs = validInputs(target);
    if (targetInputs && edge.targetHandle && !targetInputs.has(edge.targetHandle)) {
      dropped.push(edge);
      continue;
    }

    kept.push(edge);
  }
  return { edges: kept, dropped };
}

/**
 * Enrich edges with port type data from the nodes array.
 * Used during workflow load.
 */
export function enrichEdgesWithPortData(edges: Edge[], nodes: Node[]): Edge[] {
  const nodeTypeMap = new Map<string, string>();
  for (const node of nodes) {
    const type = (node.data as { type?: string })?.type;
    if (type) nodeTypeMap.set(node.id, type);
  }

  return edges.map((edge) => {
    const sourceNodeType = nodeTypeMap.get(edge.source) ?? "";
    const portData = buildEdgeData(edge.sourceHandle, sourceNodeType);
    return { ...edge, data: { ...(edge.data as Record<string, unknown> ?? {}), ...portData } };
  });
}

/**
 * §3.2 — 엣지의 실행 상태별 스타일 플래그. 상호배타적 우선순위: inactive > flowing/completed.
 *  - `inactive`  : 비활성(disabled) 노드에 연결된 엣지 → 반투명 점선(정적, 실행과 무관)
 *  - `flowing`   : 실행 중 데이터가 지나는 엣지(source 완료 + target 실행 중) → 애니메이션 점선
 *  - `completed` : source·target 둘 다 완료된 엣지 → 초록 flash(1회) 후 복귀
 */
export interface EdgeExecutionState {
  inactive: boolean;
  flowing: boolean;
  completed: boolean;
}

/**
 * §3.2 — 실행 상태 스타일을 트리거하는 엣지 wrapper className. React Flow `edge.className` 으로
 * 부여하고 globals.css 가 소비한다. `useEdgeHighlighting` 이 className 을 Set 병합(하이라이트만
 * add/remove)하므로 hover/선택 하이라이트와 안전하게 공존한다.
 *  - flowing  : 마칭 점선 애니메이션(기존 `edge-flow` keyframe 재사용)
 *  - completed: 1회성 초록 flash 후 원래 포트색으로 복귀(`wc-edge-complete-flash`)
 * flowing 과 completed 는 상호배타(target 이 running vs completed)라 둘 중 하나만 부여된다.
 */
export const FLOWING_EDGE_CLASS = "wc-edge-flowing";
export const COMPLETED_EDGE_CLASS = "wc-edge-completed";

/**
 * §3.2 판정 순수 함수 — 엣지 1개와 실행 컨텍스트로 상태 플래그를 계산한다. 비활성(disabled)
 * 노드는 실행에 참여하지 않으므로 flowing/completed 를 배제한다(inactive 우선). React Flow /
 * store 에 의존하지 않아 단위 테스트가 쉽다.
 */
export function resolveEdgeExecutionState(
  edge: { source: string; target: string },
  ctx: {
    disabledNodeIds: ReadonlySet<string>;
    nodeStatusById: ReadonlyMap<string, string>;
    executing: boolean;
  },
): EdgeExecutionState {
  if (ctx.disabledNodeIds.has(edge.source) || ctx.disabledNodeIds.has(edge.target)) {
    return { inactive: true, flowing: false, completed: false };
  }
  const sourceStatus = ctx.nodeStatusById.get(edge.source);
  const targetStatus = ctx.nodeStatusById.get(edge.target);
  const flowing =
    ctx.executing && sourceStatus === "completed" && targetStatus === "running";
  const completed = sourceStatus === "completed" && targetStatus === "completed";
  return { inactive: false, flowing, completed };
}
