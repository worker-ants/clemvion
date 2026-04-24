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
  | 'INVALID_EXPRESSION'
  | 'PORT_NOT_FOUND';

/**
 * 노드 한 개에서 해석된 유효 포트 한 개의 디스크립터. `add_node`/`update_node`
 * 성공 응답의 `result.ports` (§4.3.2) 로 LLM·프런트에 자동 노출된다.
 *  - `id`: add_edge 의 `source_port` / `target_port` 에 그대로 쓸 값.
 *  - `type`: `'data'` (기본) / `'error'`. error 포트는 `add_edge { type: 'error' }`.
 *    **정규화 규칙** (review I-7): resolver 의 backend 내부 타입 중 `'error'`
 *    만 그대로 싣고, `'data'` / `'system'` / `'control'` 은 모두 `'data'` 로
 *    매핑해 외부 계약(§4.3.2) 에 맞춘다. LLM 은 edge 생성 시 `'error'` 여부만
 *    알면 충분하고 내부 분류를 구별할 필요가 없다.
 *  - `label`: dynamic-ports 노드의 사용자 설정 label (예: carousel 버튼의 한글
 *             label). static 포트는 보통 label 없음. 사용자 자유 입력이라
 *             `sanitizeLlmProvidedString` 을 거쳐 실어진다.
 */
export interface ShadowRuntimePort {
  id: string;
  type?: 'data' | 'error';
  label?: string;
}

/**
 * 노드 한 개에서 해석된 유효 포트 목록. `PORT_NOT_FOUND` 검사를 위해
 * ShadowWorkflow 가 stream.service 로부터 주입받는 resolver 의 반환 shape.
 * `resolveEffectiveOutputPorts` (config-aware) 를 기반으로 outputs 를, 정적
 * `NodePorts.inputs` 를 기반으로 inputs 를 채운다. 여기서 나온 동일 배열이
 * `add_node`/`update_node` 성공 응답의 `result.ports` 로도 노출된다 (ED-AI-40).
 */
export interface ResolvedNodePorts {
  outputs: ShadowRuntimePort[];
  inputs: ShadowRuntimePort[];
}
export type NodePortResolver = (node: ShadowNode) => ResolvedNodePorts | null;

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
  /**
   * `UNKNOWN_NODE_TYPE` 응답 시: 현재 등록된 노드 타입 중 최대 `KNOWN_TYPES_MAX`
   * 개를 정렬해 싣는다. LLM 이 다음 라운드에서 올바른 타입을 고를 수 있도록.
   */
  knownTypes?: string[];
  /**
   * `UNKNOWN_NODE_TYPE` 응답 시: Levenshtein 거리 ≤ 3 이거나 `NODE_TYPE_ALIASES`
   * 매핑에 해당하면 "가장 근접한" 한 개 제안. 예: `error_message` → `template`.
   * 없으면 undefined.
   */
  suggestedType?: string;
  /**
   * `PORT_NOT_FOUND` 응답에 실리는 구조화 세부 정보.
   *  - `side`: 에러가 발생한 쪽 ('source' | 'target')
   *  - `attemptedPort`: LLM 이 지정한 포트 id (sanitized)
   *  - `nodeLabel` / `nodeType`: 대상 노드의 식별 정보
   *  - `knownPorts`: 해당 쪽에서 실제로 존재하는 포트 id 목록. 사용자 설정
   *    기반 동적 포트 (carousel.buttons / switch.cases 등) 가 config 미완
   *    상태라 아직 생성되지 않았다면 여기에 빠져있음.
   */
  portInfo?: {
    side: 'source' | 'target';
    attemptedPort: string;
    nodeLabel: string;
    nodeType: string;
    knownPorts: string[];
  };
  /**
   * `LABEL_CONFLICT` 가 같은 label 로 **반복 발생**한 누적 횟수. 2 이상이면
   * `hint` 도 함께 실려 "suggested 값을 그대로 쓰라" 는 강한 신호를 준다.
   */
  repeatCount?: number;
  /**
   * `add_node` / `update_node` 성공 응답에 동봉되는 런타임 포트 목록
   * (spec ED-AI-40 §4.3.2). LLM 이 곧바로 `add_edge` 의 `source_port` /
   * `target_port` 를 정확한 값으로 채울 수 있도록 static + dynamic 포트를
   * 같은 shape 으로 제공. 상한은 한 쪽당 50개.
   *
   * 운영 경로(portResolver 주입) 에서는 **항상 present** 다 (review I-8).
   * portResolver 가 주입되지 않은 legacy/test 경로에서만 필드가 생략된다.
   * 상한에 걸려 절단된 경우 `portsTruncated: true` 가 함께 실려 "서버가 일부
   * 포트를 생략했음" 을 신호한다 (review W-5).
   */
  ports?: ResolvedNodePorts;
  /**
   * `ports.outputs` 또는 `ports.inputs` 가 `RUNTIME_PORTS_MAX_PER_SIDE` (50)
   * 상한에 걸려 잘린 경우 `true`. 필드 생략 시 `false` 로 간주한다. LLM 은
   * 이 플래그가 켜졌을 때 `ports` 에 없는 port id 를 추측하지 말고
   * `get_node_schema` 로 전체 목록을 조회해야 한다.
   */
  portsTruncated?: boolean;
  /**
   * 복구 지침 한-문장. 여러 에러 케이스에서 설정될 수 있다:
   *  - `UNKNOWN_NODE_TYPE` — suggestedType 사용 안내 (alias 케이스는 특별 문구).
   *  - `LABEL_CONFLICT` (repeatCount ≥ 2) — 재시도 멈춤 안내.
   *  - `NODE_NOT_FOUND` (`add_edge`, 최근 실패한 `add_node` 가 있을 때) —
   *    cascading 실패 안내 ("앞서 실패한 노드를 먼저 고치세요").
   *  - `NODE_NOT_FOUND` (`update_node` / `remove_node`) — id 자리에 넣은 값이
   *    shadow 내 어떤 노드의 label 과 일치하면 "이건 label 이고 실제 id 는
   *    <uuid> 이다" 형태의 label-lookalike 안내.
   *  - `NODE_NOT_FOUND` (`add_edge`, cascading FIFO 가 비어있을 때) — source
   *    또는 target 값이 노드 label 과 매치되면 label-lookalike 안내 (source
   *    우선). cascading 힌트가 먼저 실렸다면 label-lookalike 는 싣지 않는다.
   * 힌트 문자열은 LLM 제공 자유 텍스트(label/type) 를 그대로 embed 하지 않고
   * `sanitizeLlmProvidedString` 을 거쳐 개행/제어 문자를 제거해 프롬프트
   * 인젝션 표면을 좁힌다. label-lookalike 계열은 추가로 `[hint] ... [/hint]`
   * 마커로 감싸 LLM 이 hint 범위를 자연어 instruction 으로 오인하지 않게 한다.
   */
  hint?: string;
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
 * LLM 이 자주 만들어내는 "카탈로그에 없는" 노드 타입 → 실제 존재하는 최적
 * 대안으로 라우팅하기 위한 별칭 맵. Levenshtein 검색보다 먼저 확인되며 hit 이
 * 있으면 그 suggestedType 을 사용한다.
 *
 * 가장 흔한 오탐은 "ErrorMessage / Notification / Alert" 처럼 UI 메세지를 띄우기
 * 위한 전용 노드가 있을 거라 가정하는 것. 실제로는 `template` 노드로 임의의
 * 텍스트/HTML 을 렌더한다.
 */
const NODE_TYPE_ALIASES: Record<string, string> = {
  // "UI 메세지 출력용 전용 노드" 가 있을 거라고 가정하는 패턴. 실제로는
  // template 노드로 해결한다.
  error_message: 'template',
  error: 'template',
  alert: 'template',
  notification: 'template',
  message: 'template',
  text: 'template',
  display: 'template',
  show: 'template',
  render: 'template',
  result: 'template',
  output: 'template',
  // "사용자 입력 받는 전용 노드" 라고 가정하는 패턴. 실제로는 form 노드.
  user_input: 'form',
  input: 'form',
  question: 'form',
  prompt: 'form',
  text_input: 'form',
  survey: 'form',
  // "선택지 / 버튼 묶음" 전용 노드라고 가정하는 패턴. 실제로는 carousel.
  choice: 'carousel',
  choices: 'carousel',
  options: 'carousel',
  selection: 'carousel',
  selector: 'carousel',
  button_group: 'carousel',
  buttons: 'carousel',
  category: 'carousel',
  // "흐름 분기" 전용 노드라고 가정하는 패턴. 실제로는 switch.
  router: 'switch',
  route: 'switch',
  branch: 'switch',
  conditional: 'switch',
  condition: 'if_else',
  // "이메일 발송" 흔한 오명칭.
  email: 'send_email',
  send_mail: 'send_email',
  mail: 'send_email',
};

/** UNKNOWN_NODE_TYPE 응답에 실을 knownTypes 배열의 최대 길이. */
const KNOWN_TYPES_MAX = 40;
/** 반복 LABEL_CONFLICT 를 "재시도 경고" 로 escalate 하는 임계값. */
const LABEL_CONFLICT_REPEAT_THRESHOLD = 2;
/**
 * `recentFailedAddNodeLabels` 의 rolling window 크기. 실패한 add_node 의 label
 * 을 FIFO 로 모아 이후 `add_edge` 가 `NODE_NOT_FOUND` 로 떨어질 때 cascading
 * 힌트에 실어 보낸다.
 */
const FAILED_LABEL_WINDOW = 10;
/**
 * LLM 제공 문자열을 힌트 메세지에 embed 할 때 적용할 길이 상한. Levenshtein
 * 계산 비용 방어 + 힌트 프롬프트가 터무니없이 길어져 토큰을 낭비하거나 프롬프트
 * 인젝션에 악용되는 것을 막는다.
 */
const ATTEMPTED_TYPE_MAX_LEN = 64;
const LABEL_HINT_MAX_LEN = 80;
/**
 * `add_node` / `update_node` 성공 응답의 `result.ports.outputs|inputs` 한
 * 쪽당 상한 (spec §4.3.2). 현실 시나리오에서 50개를 넘는 dynamic 버튼/케이스
 * 는 사실상 없지만, 악의적·오류 config 로 응답이 폭주하는 것을 막기 위한
 * 상수. 초과 시 `.slice(0, 50)` 로 잘라낸다.
 */
const RUNTIME_PORTS_MAX_PER_SIDE = 50;

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
  /**
   * 같은 label 에 대한 LABEL_CONFLICT 누적 카운트. LLM 이 서버가 돌려준
   * `suggested` 를 무시하고 같은 label 을 재시도하면 repeatCount 가 증가해
   * hint 를 추가로 실어 보낸다.
   */
  private readonly labelConflictCounts = new Map<string, number>();
  /**
   * 최근 실패한 `add_node` 의 label FIFO 큐 (최대 `FAILED_LABEL_WINDOW`).
   * 이후 `add_edge` 가 NODE_NOT_FOUND 를 뱉을 때 cascading 실패 힌트를 주기
   * 위한 자료. `readonly` 는 배열 reference 고정 의미 — 내부 mutation 은 허용.
   */
  private readonly recentFailedAddNodeLabels: string[] = [];
  /**
   * UNKNOWN_NODE_TYPE 응답에 실을 정렬된 knownTypes 캐시. `knownNodeTypes` Set
   * 은 constructor 이후 변하지 않으므로 lazy sort + 캐시로 매 호출마다의
   * sort+spread 비용을 0 회로 만든다.
   */
  private sortedKnownTypesCache: string[] | null = null;

  constructor(
    snapshot: ShadowSnapshot,
    private readonly knownNodeTypes: Set<string>,
    private readonly categoryByType: Record<string, string> = {},
    /**
     * (옵션) 노드별 유효 포트 resolver. `add_edge` 시 source/target 포트가
     * 실제 존재하는지 검사해 LLM 이 "config 미완으로 생성되지 않은 동적 포트"
     * 에 edge 를 붙이는 실수를 조기에 포착한다. null/undefined 인 resolver 나
     * 인자 (해석 불가 노드 타입) 는 skip — 검사 비활성 상태로 간주하고 기존
     * permissive 동작을 유지한다. 테스트·레거시 호출자는 생략 가능.
     */
    private readonly portResolver?: NodePortResolver,
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
      this.recordFailedAddNode(label);
      return this.buildUnknownNodeTypeResult(type);
    }
    const conflict = this.findByLabel(label);
    if (conflict) {
      const prev = this.labelConflictCounts.get(label) ?? 0;
      const next = prev + 1;
      this.labelConflictCounts.set(label, next);
      // LABEL_CONFLICT 는 "노드 타입·config 는 타당하지만 이름만 이미 존재" 인
      // 상태. cascading NODE_NOT_FOUND 힌트 대상이 아니므로 실패 FIFO 에
      // 기록하지 않는다 (기록하면 "앞서 실패한 add_node 때문" 이라는 잘못된
      // 힌트가 후속 add_edge 에 붙어 LLM 이 오인 진단한다).
      const result: ShadowResult = {
        ok: false,
        error: 'LABEL_CONFLICT',
        suggested: this.suggestLabel(label),
      };
      if (next >= LABEL_CONFLICT_REPEAT_THRESHOLD) {
        result.repeatCount = next;
        result.hint =
          'You already hit LABEL_CONFLICT for this label. Use the `suggested` value as-is — do NOT re-submit the same label. If you want a cleaner name, call get_current_workflow to see existing labels and pick a distinctly different one.';
      }
      return result;
    }
    if (containerId) {
      const container = this.nodes.get(containerId);
      if (!container) {
        this.recordFailedAddNode(label);
        return { ok: false, error: 'NODE_NOT_FOUND' };
      }
      if (this.isTriggerCategory(type)) {
        this.recordFailedAddNode(label);
        return { ok: false, error: 'CONTAINER_INVALID_CHILD' };
      }
    }

    const exprCheck = validateConfigExpressions(config);
    if (!exprCheck.valid) {
      this.recordFailedAddNode(label);
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
    // 성공한 label 은 실패 롤링 윈도우에서 제거 — 이전에 같은 label 로 실패한
    // 적이 있었다면 LLM 이 이번 라운드에서 복구한 것이므로 이후 add_edge 힌트에
    // 여전히 끌려가지 않게 한다.
    this.forgetFailedAddNode(label);
    const portsInfo = this.buildRuntimePorts(id);
    if (!portsInfo) return { ok: true, id };
    return portsInfo.truncated
      ? { ok: true, id, ports: portsInfo.ports, portsTruncated: true }
      : { ok: true, id, ports: portsInfo.ports };
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
    if (!node) {
      // "label 을 id 자리에 실수로 넣음" 실수 패턴을 자동 감지해 다음 라운드
      // 복구를 돕는다. shadow 내에 label === id-값 인 노드가 있으면 그 노드의
      // 실제 UUID 를 hint 로 알려준다.
      const hint = this.buildLabelAsIdHint(id);
      return hint
        ? { ok: false, error: 'NODE_NOT_FOUND', hint }
        : { ok: false, error: 'NODE_NOT_FOUND' };
    }

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
    const portsInfo = this.buildRuntimePorts(id);
    if (!portsInfo) return { ok: true, id };
    return portsInfo.truncated
      ? { ok: true, id, ports: portsInfo.ports, portsTruncated: true }
      : { ok: true, id, ports: portsInfo.ports };
  }

  private removeNode(args: Record<string, unknown>): ShadowResult {
    const id = typeof args.id === 'string' ? args.id : '';
    const node = this.nodes.get(id);
    if (!node) {
      // `updateNode` 와 동일 — "label 을 id 자리에 실수로 넣음" 케이스를 감지해
      // 다음 라운드 복구를 돕는다. shadow 내 label === id-값 인 노드가 있으면
      // 그 노드의 실제 UUID 를 hint 로 알려준다.
      const hint = this.buildLabelAsIdHint(id);
      return hint
        ? { ok: false, error: 'NODE_NOT_FOUND', hint }
        : { ok: false, error: 'NODE_NOT_FOUND' };
    }
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
    const sourceExists = this.nodes.has(sourceId);
    const targetExists = this.nodes.has(targetId);
    if (!sourceExists || !targetExists) {
      const result: ShadowResult = { ok: false, error: 'NODE_NOT_FOUND' };
      if (this.recentFailedAddNodeLabels.length > 0) {
        // label 은 LLM 이 자유 텍스트로 채운 값이라 JSON.stringify 로 embed
        // + 길이 상한으로 프롬프트 인젝션 방어. 최근 5건만 노출해 힌트 길이
        // 를 제어.
        const recent = this.recentFailedAddNodeLabels
          .slice(-5)
          .map((l) =>
            JSON.stringify(sanitizeLlmProvidedString(l, LABEL_HINT_MAX_LEN)),
          )
          .join(', ');
        result.hint = `A prior add_node failed in this turn (labels: [${recent}]). The UUID you are referencing does not exist because that node was never created. Fix the upstream add_node failures first, then wire the edges.`;
      } else {
        // cascading FIFO 가 비어있을 때만 "label 을 id 자리에 실수" 케이스를
        // fallback 으로 시도. source 가 실제로 missing 이고 label 매치가 있으면
        // 그 힌트 사용, 아니면 target 쪽을 시도. 두 힌트가 섞여 메시지가
        // 모호해지지 않도록 **source 우선 단일 힌트**. source/target 양쪽이
        // 모두 label 실수인 케이스도 source 힌트 하나만 내려 다음 라운드에서
        // 사용자가 source 정정 후 target 재시도하게 유도.
        let hint: string | null = null;
        if (!sourceExists) hint = this.buildLabelAsIdHint(sourceId);
        if (hint === null && !targetExists) {
          hint = this.buildLabelAsIdHint(targetId);
        }
        if (hint) result.hint = hint;
      }
      return result;
    }
    // 포트 존재성 검사. `portResolver` 가 주입된 경우에만 작동해 테스트·레거시
    // 경로의 기존 permissive 동작을 유지한다. 사용자가 설정한 동적 포트
    // (carousel 버튼 / switch case / ai_agent condition 등) 가 config 미완으로
    // 생성되지 않은 상황에서 LLM 이 그 포트 id 로 add_edge 하는 실수를 초기에
    // 포착한다 (기존에는 silent 로 edge 가 생성되어 canvas 에 dead edge 가 남았음).
    const portCheck = this.validateEdgePorts(
      sourceId,
      targetId,
      sourcePort,
      targetPort,
    );
    if (portCheck) return portCheck;
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

  /**
   * `UNKNOWN_NODE_TYPE` 응답에 suggestedType / knownTypes / hint 를 덧붙여
   * LLM 이 올바른 타입으로 재시도할 수 있게 한다. 로직 순서:
   *  1) `NODE_TYPE_ALIASES` hit → 해당 타입으로 즉시 제안 + hint.
   *  2) 별칭 없음 → Levenshtein 거리 ≤ 3 중 최단 타입 제안 (있을 때만).
   *  3) `knownTypes` 는 정렬 후 상한 `KNOWN_TYPES_MAX` 로 잘라 첨부 (모두 싣는
   *     건 프롬프트 토큰 낭비; 카탈로그는 이미 system prompt 에 있음).
   *
   * LLM 이 만든 `attemptedType` 을 메세지에 embed 할 때는 길이 상한 + 제어 문자
   * 제거를 거쳐 프롬프트 인젝션·토큰 낭비 위험을 차단한다.
   */
  private buildUnknownNodeTypeResult(attemptedType: string): ShadowResult {
    const safeAttempted = sanitizeLlmProvidedString(
      attemptedType,
      ATTEMPTED_TYPE_MAX_LEN,
    );
    const trimmedKnown = this.getSortedKnownTypes().slice(0, KNOWN_TYPES_MAX);
    const aliasHit = NODE_TYPE_ALIASES[attemptedType.toLowerCase()];
    if (aliasHit && this.knownNodeTypes.has(aliasHit)) {
      return {
        ok: false,
        error: 'UNKNOWN_NODE_TYPE',
        suggestedType: aliasHit,
        knownTypes: trimmedKnown,
        hint: `There is no "${safeAttempted}" node type. To render a message or error text, use the "${aliasHit}" node with a template string.`,
      };
    }
    const closest = this.closestKnownType(attemptedType);
    const result: ShadowResult = {
      ok: false,
      error: 'UNKNOWN_NODE_TYPE',
      knownTypes: trimmedKnown,
    };
    if (closest) {
      result.suggestedType = closest;
      result.hint = `Did you mean "${closest}"? The type "${safeAttempted}" is not in the node catalog. Retry add_node with a valid type from knownTypes below.`;
    } else {
      result.hint = `The type "${safeAttempted}" is not registered. Pick a type from knownTypes below (or review the node catalog in the system prompt).`;
    }
    return result;
  }

  /**
   * 정렬된 knownTypes 를 lazy init 으로 캐시한다. `knownNodeTypes` 는 생성자
   * 이후 변경되지 않는 불변 Set 이므로 첫 호출에서만 sort + spread 비용을
   * 지불하면 이후 UNKNOWN_NODE_TYPE 호출마다의 추가 비용이 0.
   */
  private getSortedKnownTypes(): string[] {
    if (this.sortedKnownTypesCache === null) {
      this.sortedKnownTypesCache = [...this.knownNodeTypes].sort();
    }
    return this.sortedKnownTypesCache;
  }

  /**
   * attemptedType 과 Levenshtein 거리 ≤ 3 인 knownTypes 중 가장 짧은 것을
   * 반환. 동률이면 사전순 첫 번째. 후보가 없으면 undefined.
   */
  private closestKnownType(attemptedType: string): string | undefined {
    let bestType: string | undefined;
    let bestDistance = Infinity;
    for (const candidate of this.knownNodeTypes) {
      const d = levenshtein(attemptedType, candidate);
      if (
        d < bestDistance ||
        (d === bestDistance && bestType && candidate < bestType)
      ) {
        bestDistance = d;
        bestType = candidate;
      }
    }
    return bestDistance <= 3 ? bestType : undefined;
  }

  /** 실패한 add_node label 을 FIFO 큐에 추가 (중복 제거, 상한 유지). */
  private recordFailedAddNode(label: string): void {
    const existingIdx = this.recentFailedAddNodeLabels.indexOf(label);
    if (existingIdx >= 0) this.recentFailedAddNodeLabels.splice(existingIdx, 1);
    this.recentFailedAddNodeLabels.push(label);
    while (this.recentFailedAddNodeLabels.length > FAILED_LABEL_WINDOW) {
      this.recentFailedAddNodeLabels.shift();
    }
  }

  /** 성공 또는 복구 시 label 을 실패 큐에서 제거. */
  private forgetFailedAddNode(label: string): void {
    const idx = this.recentFailedAddNodeLabels.indexOf(label);
    if (idx >= 0) this.recentFailedAddNodeLabels.splice(idx, 1);
  }

  /**
   * `add_node` / `update_node` 성공 응답에 실을 런타임 포트 목록을 만든다.
   * portResolver 가 주입되지 않은 legacy/test 경로에서는 `null` 반환 →
   * 응답에 ports 필드가 생략된다 (하위 호환). 한 쪽당 상한 50개.
   * 상한에 걸려 잘린 경우 `truncated: true` 도 함께 돌려보내 호출부가
   * `ShadowResult.portsTruncated` 를 세팅하도록 한다 (review W-5).
   * 이미 50 이하인 배열은 원본을 그대로 돌려줘 불필요한 복사를 피한다
   * (review I-1).
   * spec ED-AI-40 §4.3.2.
   */
  private buildRuntimePorts(
    nodeId: string,
  ): { ports: ResolvedNodePorts; truncated: boolean } | null {
    if (!this.portResolver) return null;
    const node = this.nodes.get(nodeId);
    if (!node) return null;
    const resolved = this.portResolver(node);
    if (!resolved) return null;
    const truncated =
      resolved.outputs.length > RUNTIME_PORTS_MAX_PER_SIDE ||
      resolved.inputs.length > RUNTIME_PORTS_MAX_PER_SIDE;
    const outputs =
      resolved.outputs.length > RUNTIME_PORTS_MAX_PER_SIDE
        ? resolved.outputs.slice(0, RUNTIME_PORTS_MAX_PER_SIDE)
        : resolved.outputs;
    const inputs =
      resolved.inputs.length > RUNTIME_PORTS_MAX_PER_SIDE
        ? resolved.inputs.slice(0, RUNTIME_PORTS_MAX_PER_SIDE)
        : resolved.inputs;
    return { ports: { outputs, inputs }, truncated };
  }

  /**
   * `update_node` / `remove_node` / `add_edge` 의 id 류 인자에 LLM 이 실수로
   * 노드 **label** 을 넣었을 때 알려주는 hint 문자열을 생성한다. shadow 에
   * label 이 정확히 일치하는 노드가 있으면 그 노드의 UUID 를 돌려줘 LLM 이
   * 다음 라운드에서 곧장 정정할 수 있게 한다. 매치 없으면 null.
   *
   * LLM 제공 자유 텍스트(value == matched label) 는
   * `sanitizeLlmProvidedString` 으로 개행·꺾쇠·제어문자를 중화해 prompt
   * injection 표면을 좁히고, `[hint] ... [/hint]` 고정 마커로 감싸 LLM 이
   * hint 범위를 다른 자연어 instruction 과 구분하도록 한다 (review W-7).
   * 노드 UUID (`node.id`) 는 `[0-9a-f-]` 문자만 포함하므로 별도 이스케이프
   * 없이 그대로 보간한다 (review I-4).
   *
   * Review W-4: label 매칭은 기존 `findByLabel` 에 위임해 순회 로직 중복을
   * 제거한다. `node.label === value` 조건 진입 시 `value === node.label` 이
   * 므로 sanitize 결과를 하나만 만들어 재사용 (review W-5).
   *
   * Review I-3: `value` 가 터무니없이 길면 (`LABEL_HINT_MAX_LEN * 4` 초과)
   * label 과 일치하지 않는 노이즈로 간주해 조기 반환 — Levenshtein 유사 방어.
   */
  private buildLabelAsIdHint(value: string): string | null {
    if (!value || value.length > LABEL_HINT_MAX_LEN * 4) return null;
    const node = this.findByLabel(value);
    if (!node) return null;
    const safeLabel = JSON.stringify(
      sanitizeLlmProvidedString(node.label, LABEL_HINT_MAX_LEN),
    );
    return `[hint] Value ${safeLabel} matches the label of an existing node (id: ${node.id}). Tool arguments use UUIDs, not labels — use the id value from a prior add_node result or from currentWorkflow.nodes[*].id. [/hint]`;
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

  /**
   * add_edge 시 source/target 포트가 실제 유효한지 검사. `portResolver` 가
   * 주입되지 않았거나 해당 노드 타입이 해석 불가면 검사 skip (permissive).
   *
   * 예외: **컨테이너 loopback** — 자식 → 조상 컨테이너의 `emit` 포트는 실행
   * 엔진이 특별 처리하므로 resolver 가 `emit` 을 포트 목록에 포함하지 않아도
   * valid 로 간주한다 (shouldBypassCycleCheck 와 동일 의미의 특별 경로).
   */
  private validateEdgePorts(
    sourceId: string,
    targetId: string,
    sourcePort: string,
    targetPort: string,
  ): ShadowResult | null {
    if (!this.portResolver) return null;
    const sourceNode = this.nodes.get(sourceId);
    const targetNode = this.nodes.get(targetId);
    if (!sourceNode || !targetNode) return null; // 앞선 NODE_NOT_FOUND 가 처리
    const sourcePorts = this.portResolver(sourceNode);
    const targetPorts = this.portResolver(targetNode);
    if (sourcePorts && !sourcePorts.outputs.some((p) => p.id === sourcePort)) {
      return this.buildPortNotFoundResult(
        'source',
        sourcePort,
        sourceNode,
        sourcePorts.outputs.map((p) => p.id),
      );
    }
    if (targetPorts && !targetPorts.inputs.some((p) => p.id === targetPort)) {
      // 컨테이너 loopback exception: 자식 → 조상 컨테이너의 `emit` 포트.
      if (
        CONTAINER_LOOPBACK_PORTS.has(targetPort) &&
        this.isAncestorContainer(sourceId, targetId)
      ) {
        return null;
      }
      return this.buildPortNotFoundResult(
        'target',
        targetPort,
        targetNode,
        targetPorts.inputs.map((p) => p.id),
      );
    }
    return null;
  }

  private buildPortNotFoundResult(
    side: 'source' | 'target',
    attempted: string,
    node: ShadowNode,
    knownPorts: string[],
  ): ShadowResult {
    const safeAttempted = sanitizeLlmProvidedString(attempted, 64);
    const safeLabel = sanitizeLlmProvidedString(node.label, 80);
    const sideText = side === 'source' ? 'output' : 'input';
    // hint: LLM 이 한 라운드에 고칠 수 있는 구체 지침. "config 미완" 이 가장
    // 흔한 원인이므로 먼저 언급.
    const hint = `Port "${safeAttempted}" does not exist as an ${sideText} port on ${safeLabel} (${node.type}). Known ${sideText} ports: [${knownPorts.join(', ')}]. If you expected a user-configured port (carousel button, switch case, ai_agent condition, etc.), verify that the earlier add_node/update_node for that node actually succeeded with the button/case in its config — a failed update_node means the port was never created.`;
    return {
      ok: false,
      error: 'PORT_NOT_FOUND',
      hint,
      portInfo: {
        side,
        attemptedPort: attempted,
        nodeLabel: node.label,
        nodeType: node.type,
        knownPorts,
      },
    };
  }
}

/**
 * LLM 이 채운 자유 텍스트(label·type 등) 를 힌트 문자열에 embed 할 때 거치는
 * 공통 sanitizer. 길이 상한 절단 + 제어 문자·개행·백틱·꺾쇠·방향 제어 중화.
 *  - 길이 절단: 프롬프트 폭주·Levenshtein 계산 비용 방어.
 *  - 개행 제거: LLM 이 힌트 안에 " ## HACK" 같은 마크다운 헤더를 끼워 넣는
 *    간접 프롬프트 인젝션을 막는다.
 *  - 백틱·꺾쇠 치환: XML fence / 코드 블록 경계 오염 방지.
 *  - C1 제어 문자(0x80–0x9F) 제거: C0 뿐 아니라 C1 도 제거해 "터미널 이스케이프
 *    시퀀스로 hint 바깥 내용을 덮어쓰는" 우회를 차단 (review I-1).
 *  - 유니코드 Bidi / 태그 / zero-width 제어 문자 제거: U+200B–U+200F (zero-width
 *    + LRE/RLE/PDF), U+202A–U+202E (LRE/RLE/PDF/LRO/RLO), U+2066–U+2069
 *    (LRI/RLI/FSI/PDI), U+2028–U+2029 (line/paragraph separator), U+FEFF
 *    (BOM/zero-width no-break space) — 보이지 않는 문자로 hint 의미를 뒤집는
 *    "Trojan source" 스타일 공격 완화 (review I-2).
 */

// Regex 리터럴 안에 C0 제어 문자를 직접 넣으면 `no-control-regex` 경고가
// 걸리므로 `new RegExp` 로 런타임 구성한다. 범위: C0 (0x00–0x1F) / DEL+C1
// (0x7F–0x9F) / zero-width + Bidi 류 (U+200B–U+200F, U+2028–U+2029,
// U+202A–U+202E, U+2066–U+2069, U+FEFF).

const SANITIZE_REMOVE_RE = new RegExp(
  // eslint-disable-next-line no-control-regex -- 의도적: C0/C1/Bidi/zero-width 스윕
  '[\\u0000-\\u001F\\u007F-\\u009F\\u200B-\\u200F\\u2028-\\u2029\\u202A-\\u202E\\u2066-\\u2069\\uFEFF]',
  'g',
);

export function sanitizeLlmProvidedString(s: string, maxLen: number): string {
  const stripped = s.replace(SANITIZE_REMOVE_RE, ' ');
  const compacted = stripped
    .replace(/`/g, "'")
    .replace(/</g, '〈')
    .replace(/>/g, '〉')
    .replace(/\s+/g, ' ')
    .trim();
  if (compacted.length <= maxLen) return compacted;
  return compacted.slice(0, Math.max(0, maxLen - 1)) + '…';
}

/**
 * 단순 Levenshtein 거리. 노드 타입 문자열은 짧고 (< 30자) 카탈로그도 수십 개
 * 수준이라 반복 매 UNKNOWN_NODE_TYPE 호출마다 돌려도 비용이 미미하다.
 * 외부 패키지 의존을 피해 로컬 구현.
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  // rolling two-row DP. 배열을 2개만 잡아 메모리 O(min(|a|,|b|)).
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  let prev: number[] = new Array<number>(short.length + 1);
  let curr: number[] = new Array<number>(short.length + 1);
  for (let j = 0; j <= short.length; j++) prev[j] = j;
  for (let i = 1; i <= long.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= short.length; j++) {
      const cost = long[i - 1] === short[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[short.length];
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
