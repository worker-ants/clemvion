import {
  AssistantPlanRecord,
  AssistantToolCallRecord,
} from '../entities/workflow-assistant-message.entity';
import { ShadowSnapshot } from './shadow-workflow';
import { PendingUserConfigField } from './detect-pending-user-config';

/**
 * Assistant 가 `finish` 를 시도할 때 서버가 수행하는 **2단계 finish 자체 점검**
 * 의 결과 항목. 한 턴에 실제 edit 이 있었던 경우에만 실행된다.
 *
 * 두 종류로 나뉜다:
 *  - blocking=true  → finish 를 막고 LLM 에게 복구 기회를 준다.
 *  - blocking=false → 단순 경고. 현재는 `REQUEST_COVERAGE_LOW` 만 해당.
 *
 * 항목 코드:
 *  - **UNRESOLVED_FAILED_CALLS** : 같은 턴에 실패한 tool call 이 이후 같은
 *    `arguments.label`/`arguments.id` 로 성공 호출로 회복되지 않은 채 남아
 *    있음. UI 상 빨간 배지가 남아 사용자가 혼란.
 *  - **ORPHAN_NODES** : `manual_trigger` 혹은 다른 trigger category 노드에서
 *    출발해 도달 불가한 노드가 있음 — entry-point connectivity 위반.
 *  - **PENDING_USER_CONFIG_UNMENTIONED** : integration/LLM/KB/workflow selector
 *    가 비어있는 노드가 있는데 이번 턴 한국어 마무리 메세지(`assistantText`)에
 *    해당 노드 label 이 언급되지 않음 — 사용자가 설정 필요 사실을 모름.
 *  - **FAKE_STEP_COMPLETION** : `planStepId`/`planStepIds` 가 붙은 tool call
 *    인데 결과는 `ok:false`. active-plan-context 가 이미 차단하지만 방어망.
 *  - **REQUEST_COVERAGE_LOW** : 사용자 원 요청의 의미 토큰과 현재 노드 label
 *    의 겹침이 낮음. 휴리스틱 경고이므로 blocking=false.
 */
export type ReviewChecklistCode =
  | 'UNRESOLVED_FAILED_CALLS'
  | 'ORPHAN_NODES'
  | 'PENDING_USER_CONFIG_UNMENTIONED'
  | 'FAKE_STEP_COMPLETION'
  | 'REQUEST_COVERAGE_LOW';

export interface ReviewChecklistItem {
  /** 이 항목이 가리키는 이슈 유형. 각 code 별로 data 의 shape 가 다르다. */
  code: ReviewChecklistCode;
  /**
   * true 면 `WORKFLOW_REVIEW_REQUIRED` 응답으로 finish 를 막아 LLM 에게 복구
   * 기회를 준다. false 면 경고만 싣고 finish 는 통과 (현재는 REQUEST_COVERAGE_LOW).
   */
  blocking: boolean;
  /** LLM 이 그대로 읽어 해석할 영어 설명문. 해결 지침을 포함한다. */
  details: string;
  /**
   * code 별 구조화 세부. 참고 shape:
   *  - UNRESOLVED_FAILED_CALLS → `{ id, name, label?, nodeId?, error? }[]`
   *  - ORPHAN_NODES → `{ id, label, type }[]`
   *  - FAKE_STEP_COMPLETION → `{ stepId, stepDescription, failedCallIds }[]`
   *  - PENDING_USER_CONFIG_UNMENTIONED → `{ nodeId, label, missingFields }[]`
   *  - REQUEST_COVERAGE_LOW → `{ hits, total, ratio, missed }`
   */
  data?: unknown;
}

export interface BuildReviewChecklistInput {
  shadowSnapshot: ShadowSnapshot;
  pendingToolCalls: AssistantToolCallRecord[];
  /** 이번 턴 혹은 활성 plan. null 이면 plan 없는 execution 턴. */
  plan: AssistantPlanRecord | null;
  originalRequest: string;
  /** 이번 턴까지 누적된 assistant prose. finish 호출 직전의 한국어 마무리 포함. */
  assistantText: string;
  /** stream.service 의 `collectPendingUserConfig` 를 주입. DI / 계층 분리용. */
  collectPendingUserConfig: (nodeId: string) => PendingUserConfigField[];
}

/** 실패 tool call 의 간략 요약 한 건. */
interface UnresolvedFailureEntry {
  id: string;
  name: string;
  label?: string;
  nodeId?: string;
  error?: string;
}

const TRIGGER_CATEGORY = 'trigger';
const MAX_UNRESOLVED = 10;
const MAX_ORPHANS = 20;
const MAX_PENDING_USER_CONFIG = 10;
const REQUEST_COVERAGE_THRESHOLD = 0.3;

/**
 * 사용자 요청 토큰화 시 제외할 한국어 조사·기능어. 길이 1 한 글자는 "종류"
 * 같은 의미어와 충돌하지 않도록 정확히 stop-word 만 열거.
 */
const KOREAN_STOP_WORDS: ReadonlySet<string> = new Set([
  '을',
  '를',
  '이',
  '가',
  '은',
  '는',
  '에',
  '의',
  '도',
  '와',
  '과',
  '만',
  '로',
  '으로',
  '에서',
  '에게',
  '부터',
  '까지',
  '께',
  '처럼',
  '보다',
  '다',
  '네',
  '요',
  '해',
  '해줘',
  '해주세요',
  '줘',
  '주세요',
  '그리고',
  '또한',
  '하지만',
  '그러나',
  '또',
  '좀',
  '이런',
  '저런',
  '그런',
  '이것',
  '저것',
  '그것',
  '것',
  '수',
  '등',
  '각',
  '모든',
  '있는',
  '없는',
  '있다',
  '없다',
  '되다',
  '하다',
  '합니다',
  '입니다',
  '해서',
  '돼',
]);

const ENGLISH_STOP_WORDS: ReadonlySet<string> = new Set([
  'the',
  'a',
  'an',
  'of',
  'for',
  'to',
  'and',
  'or',
  'but',
  'if',
  'when',
  'with',
  'from',
  'as',
  'at',
  'in',
  'on',
  'is',
  'are',
  'be',
  'was',
  'were',
  'do',
  'does',
  'did',
  'this',
  'that',
  'these',
  'those',
  'not',
  'no',
  'yes',
  'please',
  'me',
  'i',
  'you',
  'your',
  'we',
  'our',
  'it',
  'its',
  'they',
  'their',
  'them',
  'can',
  'will',
  'should',
  'could',
  'would',
]);

/**
 * 체크리스트에 blocking 항목이 하나라도 있는지. 없으면 finish 를 그대로 통과.
 */
export function checklistBlocks(items: ReviewChecklistItem[]): boolean {
  return items.some((i) => i.blocking);
}

/**
 * 메인 진입점. 다섯 개 점검을 순차 실행하고 결과 배열을 돌려준다.
 * 순서는 UI 가독성을 고려해 "가장 즉각적인 이슈 → 넓은 범위" 순:
 *  1) UNRESOLVED_FAILED_CALLS, 2) ORPHAN_NODES, 3) FAKE_STEP_COMPLETION,
 *  4) PENDING_USER_CONFIG_UNMENTIONED, 5) REQUEST_COVERAGE_LOW.
 */
export function buildReviewChecklist(
  input: BuildReviewChecklistInput,
): ReviewChecklistItem[] {
  const items: ReviewChecklistItem[] = [];

  const unresolved = collectUnresolvedFailures(input.pendingToolCalls);
  if (unresolved.length > 0) {
    items.push({
      code: 'UNRESOLVED_FAILED_CALLS',
      blocking: true,
      details: `${unresolved.length} failed tool call(s) this turn were never resolved. Either retry each with corrected arguments (e.g. a different label, the suggested node type, a valid node id) or call get_current_workflow to confirm they did not quietly succeed.`,
      data: unresolved,
    });
  }

  const orphans = collectOrphans(input.shadowSnapshot);
  if (orphans.length > 0) {
    items.push({
      code: 'ORPHAN_NODES',
      blocking: true,
      details: `${orphans.length} node(s) have no path back to a trigger. Every node must be reachable from manual_trigger (or another trigger). Add an add_edge from an already-connected upstream node, or remove_node if the node should not exist.`,
      data: orphans,
    });
  }

  const fakeCompletion = collectFakeStepCompletion(
    input.pendingToolCalls,
    input.plan,
  );
  if (fakeCompletion.length > 0) {
    items.push({
      code: 'FAKE_STEP_COMPLETION',
      blocking: true,
      details: `${fakeCompletion.length} plan step(s) have only failing tool calls attached — they are NOT actually done. Retry the underlying edit successfully before finishing.`,
      data: fakeCompletion,
    });
  }

  const pending = collectUnmentionedPendingUserConfig(input);
  if (pending.length > 0) {
    items.push({
      code: 'PENDING_USER_CONFIG_UNMENTIONED',
      blocking: true,
      details: `${pending.length} node(s) have required user-picked fields (Integration / LLM Config / Knowledge Base / Sub-workflow) that are still empty AND were NOT mentioned in your Korean closing message. Mention each node's label + which selector the user must fill, then call finish.`,
      data: pending,
    });
  }

  const coverageWarning = checkRequestCoverage(
    input.originalRequest,
    input.shadowSnapshot,
  );
  if (coverageWarning) {
    items.push({
      code: 'REQUEST_COVERAGE_LOW',
      blocking: false,
      details: coverageWarning.details,
      data: coverageWarning.data,
    });
  }

  return items;
}

// ============================================================================
// 점검 1) UNRESOLVED_FAILED_CALLS
// ============================================================================

/**
 * 실패한 tool call 중, 이후 같은 "자원 식별자" (add_node 는 label, update/
 * remove 는 id, add_edge 는 source+target+port 튜플) 로 성공한 흔적이 없는
 * 것을 모은다. 최대 10건.
 *
 * 다음 kind 는 대상에서 제외:
 *  - `finish` — `WORKFLOW_REVIEW_REQUIRED` / `PLAN_NOT_COMPLETE` 는 설계상
 *    실패가 아니라 가드 feedback.
 *  - `explore` — `REDUNDANT_SCHEMA_LOOKUP` 같은 낭비 차단 응답이 "미해결 실패"
 *    로 오탐되지 않도록 제외 (본래 edit 실패 회복 가드가 목적).
 */
function collectUnresolvedFailures(
  calls: AssistantToolCallRecord[],
): UnresolvedFailureEntry[] {
  const failures: UnresolvedFailureEntry[] = [];
  for (let i = 0; i < calls.length; i++) {
    const tc = calls[i];
    if (tc.kind === 'finish' || tc.kind === 'explore') continue;
    const result = tc.result as { ok?: boolean; id?: string } | undefined;
    if (result?.ok !== false) continue;
    if (isRecoveredLater(calls, i)) continue;
    const args = tc.arguments;
    const entry: UnresolvedFailureEntry = {
      id: tc.id,
      name: tc.name,
      error:
        typeof (result as { error?: unknown })?.error === 'string'
          ? (result as { error: string }).error
          : undefined,
    };
    if (typeof args.label === 'string') entry.label = args.label;
    if (typeof args.id === 'string') entry.nodeId = args.id;
    failures.push(entry);
    if (failures.length >= MAX_UNRESOLVED) break;
  }
  return failures;
}

/**
 * index 뒤쪽에서 "같은 목적의 성공 호출" 이 있는지 확인. 매칭 규칙은 tool
 * 이름별로 다르다.
 *  - add_node: args.label 이 같고 result.ok===true → 회복.
 *  - update_node / remove_node / remove_edge: args.id 가 같고 ok===true.
 *  - add_edge: source/target/port 튜플이 같고 ok===true.
 * 그 외: 회복 여부 판정 불가 → false (비관적으로 미해결 취급).
 */
function isRecoveredLater(
  calls: AssistantToolCallRecord[],
  failedIndex: number,
): boolean {
  const target = calls[failedIndex];
  const args = target.arguments;
  for (let j = failedIndex + 1; j < calls.length; j++) {
    const later = calls[j];
    if (later.name !== target.name) continue;
    const laterResult = later.result as { ok?: boolean } | undefined;
    if (laterResult?.ok !== true) continue;
    const laterArgs = later.arguments;
    if (target.name === 'add_node') {
      if (typeof args.label === 'string' && laterArgs.label === args.label)
        return true;
    } else if (
      target.name === 'update_node' ||
      target.name === 'remove_node' ||
      target.name === 'remove_edge'
    ) {
      if (typeof args.id === 'string' && laterArgs.id === args.id) return true;
    } else if (target.name === 'add_edge') {
      // add_edge 의 인자 키는 snake_case 표준이지만 LLM / 일부 클라이언트가
      // camelCase (sourceId/targetId/sourcePort/targetPort) 로 보내기도 하므로
      // 양쪽 표기를 모두 비교해 false positive 를 줄인다.
      const targetSrc = args.source_id ?? args.sourceId;
      const targetDst = args.target_id ?? args.targetId;
      const laterSrc = laterArgs.source_id ?? laterArgs.sourceId;
      const laterDst = laterArgs.target_id ?? laterArgs.targetId;
      const targetSrcPort = args.source_port ?? args.sourcePort ?? 'out';
      const targetDstPort = args.target_port ?? args.targetPort ?? 'in';
      const laterSrcPort =
        laterArgs.source_port ?? laterArgs.sourcePort ?? 'out';
      const laterDstPort =
        laterArgs.target_port ?? laterArgs.targetPort ?? 'in';
      if (
        laterSrc === targetSrc &&
        laterDst === targetDst &&
        laterSrcPort === targetSrcPort &&
        laterDstPort === targetDstPort
      ) {
        return true;
      }
    }
  }
  return false;
}

// ============================================================================
// 점검 2) ORPHAN_NODES
// ============================================================================

interface OrphanEntry {
  id: string;
  label: string;
  type: string;
}

/**
 * Trigger category 노드에서 BFS 를 돌려 도달 가능한 노드 집합을 구하고,
 * 그 외 노드를 orphan 으로 리턴. Container iteration loopback (자식 → 조상
 * 컨테이너의 `emit` 포트) 은 cycle 검사를 건너뛰므로 여기서도 정상 흐름으로
 * 포함한다. manual_trigger 자체는 항상 reachable 로 간주.
 */
function collectOrphans(snapshot: ShadowSnapshot): OrphanEntry[] {
  const triggers = snapshot.nodes.filter(
    (n) => n.category === TRIGGER_CATEGORY,
  );
  if (triggers.length === 0) return []; // trigger 없는 워크플로우는 판정 불가.
  const adjacency = new Map<string, string[]>();
  for (const edge of snapshot.edges) {
    const arr = adjacency.get(edge.sourceNodeId) ?? [];
    arr.push(edge.targetNodeId);
    adjacency.set(edge.sourceNodeId, arr);
  }
  const reachable = new Set<string>();
  const queue: string[] = [];
  for (const t of triggers) {
    reachable.add(t.id);
    queue.push(t.id);
  }
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const next of adjacency.get(cur) ?? []) {
      if (!reachable.has(next)) {
        reachable.add(next);
        queue.push(next);
      }
    }
  }
  const orphans: OrphanEntry[] = [];
  // id → node Map 을 한 번만 만들고 재사용한다. 이전 구조는 각 orphan 후보마다
  // 이 Map 을 재생성해 O(N × total_nodes) 로 퇴화했다.
  const byId = new Map(snapshot.nodes.map((n) => [n.id, n]));
  for (const node of snapshot.nodes) {
    if (reachable.has(node.id)) continue;
    // 컨테이너 자식이 부모 컨테이너의 emit 포트로 돌아가는 back-edge 는 graph
    // traversal 에서 누락되므로, containerId 체인을 타고 올라가 조상 중에
    // reachable 이 있으면 orphan 판정에서 제외.
    if (hasReachableAncestorContainer(node.id, byId, reachable)) {
      continue;
    }
    orphans.push({
      id: node.id,
      label: node.label,
      type: node.type,
    });
    if (orphans.length >= MAX_ORPHANS) break;
  }
  return orphans;
}

/**
 * `descendantId` 의 containerId 체인을 타고 올라가면서 `reachable` 집합에
 * 속한 조상이 있는지 확인. 데이터 손상 시의 무한 순회를 방어하려 visited Set
 * 으로 guard.
 */
function hasReachableAncestorContainer(
  nodeId: string,
  byId: Map<string, ShadowSnapshot['nodes'][number]>,
  reachable: Set<string>,
): boolean {
  const visited = new Set<string>();
  let current = byId.get(nodeId)?.containerId ?? null;
  while (current && !visited.has(current)) {
    if (reachable.has(current)) return true;
    visited.add(current);
    current = byId.get(current)?.containerId ?? null;
  }
  return false;
}

// ============================================================================
// 점검 3) FAKE_STEP_COMPLETION
// ============================================================================

interface FakeCompletionEntry {
  stepId: string;
  stepDescription: string;
  failedCallIds: string[];
}

/**
 * plan step 마다 연결된 tool call 들을 모아 "전부 ok:false 인 step" 을 찾는다.
 * step 에 연결된 tool call 이 하나도 없으면 plan 체크리스트가 그냥 미완인
 * 상태 — `PLAN_NOT_COMPLETE` 가드가 이미 처리하므로 여기서는 flag 하지 않는다.
 */
function collectFakeStepCompletion(
  calls: AssistantToolCallRecord[],
  plan: AssistantPlanRecord | null,
): FakeCompletionEntry[] {
  if (!plan) return [];
  const result: FakeCompletionEntry[] = [];
  for (const step of plan.steps) {
    if (step.action === 'note') continue;
    const linked = calls.filter(
      (tc) =>
        tc.planStepId === step.id ||
        (Array.isArray(tc.planStepIds) && tc.planStepIds.includes(step.id)),
    );
    if (linked.length === 0) continue;
    const anySuccess = linked.some(
      (tc) => (tc.result as { ok?: boolean } | undefined)?.ok === true,
    );
    if (anySuccess) continue;
    result.push({
      stepId: step.id,
      stepDescription: step.description,
      failedCallIds: linked.map((l) => l.id),
    });
  }
  return result;
}

// ============================================================================
// 점검 4) PENDING_USER_CONFIG_UNMENTIONED
// ============================================================================

interface UnmentionedPendingEntry {
  nodeId: string;
  label: string;
  missingFields: PendingUserConfigField[];
}

function collectUnmentionedPendingUserConfig(
  input: BuildReviewChecklistInput,
): UnmentionedPendingEntry[] {
  const text = input.assistantText ?? '';
  const out: UnmentionedPendingEntry[] = [];
  for (const node of input.shadowSnapshot.nodes) {
    if (node.category === TRIGGER_CATEGORY) continue;
    const missing = input.collectPendingUserConfig(node.id);
    if (missing.length === 0) continue;
    if (text && text.includes(node.label)) continue;
    out.push({
      nodeId: node.id,
      label: node.label,
      missingFields: missing,
    });
    if (out.length >= MAX_PENDING_USER_CONFIG) break;
  }
  return out;
}

// ============================================================================
// 점검 5) REQUEST_COVERAGE_LOW (non-blocking warn)
// ============================================================================

function checkRequestCoverage(
  request: string,
  snapshot: ShadowSnapshot,
): { details: string; data: unknown } | null {
  const reqTokens = tokenize(request);
  if (reqTokens.size < 3) return null; // 너무 짧은 요청은 커버리지 판정 불가.
  const labelCorpus = snapshot.nodes
    .filter((n) => n.category !== TRIGGER_CATEGORY)
    .map((n) => n.label.toLowerCase())
    .join(' ');
  let hits = 0;
  const missed: string[] = [];
  for (const t of reqTokens) {
    if (labelCorpus.includes(t)) {
      hits += 1;
    } else {
      missed.push(t);
    }
  }
  const ratio = hits / reqTokens.size;
  if (ratio >= REQUEST_COVERAGE_THRESHOLD) return null;
  return {
    details: `Only ${hits}/${reqTokens.size} significant tokens from the user's request match any node label. Consider whether your workflow covers every intent in the request (this is a soft warning; it does not block finish).`,
    data: { hits, total: reqTokens.size, ratio, missed: missed.slice(0, 10) },
  };
}

/**
 * 길이 ≥ 2 의 의미 토큰 집합. 한국어 stop-word 와 영어 stop-word 를 제거하고
 * 숫자는 그대로 유지. 토큰화는 단순 regex 기반 — 한글·영문·숫자·하이픈만
 * 단어 경계로 인식.
 */
function tokenize(text: string): Set<string> {
  const lowered = text.toLowerCase();
  const tokens = lowered.match(/[a-z0-9가-힣]+/gu) ?? [];
  const out = new Set<string>();
  for (const t of tokens) {
    if (t.length < 2) continue;
    if (KOREAN_STOP_WORDS.has(t)) continue;
    if (ENGLISH_STOP_WORDS.has(t)) continue;
    out.add(t);
  }
  return out;
}
