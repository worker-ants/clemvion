import { Injectable } from '@nestjs/common';
import { NodeComponentRegistry } from '../../../nodes/core/node-component.registry';
import {
  AssistantPlanRecord,
  AssistantToolCallRecord,
  WorkflowAssistantMessage,
} from '../entities/workflow-assistant-message.entity';
import { CandidateLookupService } from './candidate-lookup.service';
import { collectPendingUserConfig } from './collect-pending-user-config';
import { PendingUserConfigField } from './detect-pending-user-config';
import { ShadowSnapshot, ShadowWorkflow } from './shadow-workflow';
import { toWorkflowView, WorkflowView } from './workflow-view';
import {
  ActivePlanContext,
  findActivePlanContext,
  isPlanPendingApproval,
} from './active-plan-context';
import {
  buildReviewChecklist,
  checklistBlocks,
  ReviewChecklistItem,
} from './review-workflow';

/**
 * `evaluateFinishGuard` 의 반환 payload. `finish` tool_result 로 그대로
 * 직렬화되어 LLM 에 전달된다.
 */
export type FinishGuardError =
  | {
      ok: false;
      error: 'PLAN_NOT_COMPLETE';
      pendingSteps: Array<{ id: string; description: string }>;
      openQuestions: string[];
      message: string;
    }
  | {
      ok: false;
      error: 'WORKFLOW_REVIEW_REQUIRED';
      checklist: ReviewChecklistItem[];
      originalRequest: string;
      planTitle?: string;
      /**
       * Turn-end 시점의 권위 있는 캔버스 상태. system prompt 의 turn-start
       * snapshot 과 LLM 의 누적 tool_result 기억보다 우선한다. `get_current_workflow`
       * 와 동일한 `toWorkflowView` 직렬화 + redactConfig 정책을 공유하므로 두 표현이
       * 발산하지 않는다. LLM 이 review fix 라운드에서 추가 tool 호출 없이 곧바로
       * 최신 상태를 비교·교정할 수 있게 한다.
       */
      currentWorkflow: WorkflowView;
      message: string;
    }
  | {
      /**
       * Phase 2: checklist 의 7개 violation 패턴이 모두 통과한 경우에도, 성공
       * edit 이 `MIN_EDITS_FOR_VERIFY` 이상인 non-trivial 턴에 한해 LLM 이
       * "사용자 원 요청 ↔ 실제 캔버스" 를 1:1 로 대조한 뒤 finish 하도록
       * 한 라운드를 강제한다. 이 응답을 받은 LLM 의 액션은 둘 중 하나:
       *   1) currentWorkflow 가 originalRequest 를 충실히 반영함 → 짧은 한국어
       *      '검토 완료' 메시지 emit 후 finish 다시 호출 (두 번째 finish 통과).
       *   2) 누락/오류 발견 → edit tool 로 보강 후 finish 다시 호출.
       * 같은 `state.reviewCompleted` 플래그를 공유해 두 번째 finish 는 review/
       * verify 둘 다 다시 발동하지 않는다.
       */
      ok: false;
      error: 'WORKFLOW_VERIFY_REQUIRED';
      /**
       * blocking 항목은 비어있고 (있다면 WORKFLOW_REVIEW_REQUIRED 로 갔을
       * 것), `REQUEST_COVERAGE_LOW` 같은 non-blocking 항목만 실릴 수 있다.
       */
      checklist: ReviewChecklistItem[];
      originalRequest: string;
      planTitle?: string;
      currentWorkflow: WorkflowView;
      message: string;
    };

/**
 * Turn-scoped guard 상태. progress-aware finish guard 가 라운드를 넘나들며
 * 참조하는 카운터들을 한 곳에 모아 (a) 호출부의 시그니처를 평탄하게 유지하고
 * (b) 새 block 사이클마다 reset 누락이 발생하지 않도록 한다.
 */
export interface FinishGuardState {
  /** 이 턴에서 PLAN_NOT_COMPLETE 로 finish 가 block 된 횟수. */
  finishBlockCount: number;
  /**
   * 직전 finish block 이후 성공한 edit / plan tool call 수.
   * 0 이면 LLM 이 진척 없이 finish 를 반복 시도하는 stuck 상태로 간주한다.
   */
  editsSinceLastFinishBlock: number;
  /** `clear_plan` 이 이번 턴에 호출됐는지 — 화제 전환으로 guard 비활성. */
  planClearedThisTurn: boolean;
  /**
   * "검토가 완전히 끝났음" 마크. 다음 finish 부터는 review/verify 를 다시
   * 평가하지 않고 통과시킨다. set 되는 케이스:
   *   - review 가 통과 (blocking 0 + verify 임계값 미달)
   *   - `verify_workflow` 가 ok:true 로 외부화된 검증을 마침 (Phase 3)
   * Phase 5: review_required 가 발동했을 때는 set 하지 **않는다** —
   * `reviewRoundCount` 와 stuck escape 가 추가 라운드 정책을 결정한다.
   */
  reviewCompleted: boolean;
  /** 이번 턴에 review block 이 발행된 횟수. MAX_REVIEW_ROUNDS 도달 시 통과. */
  reviewRoundCount: number;
  /**
   * Phase 5: verify_required 분기는 LLM 에게 1 라운드 의미 검증을 강제하는
   * 게 목적이라, 첫 발동 후엔 다시 발동하지 않는다 (반복 fire 시 무한 루프).
   * review_required 와 달리 blocking 항목이 없는 케이스이므로 fix 강제도
   * 의미가 약함.
   */
  verifyFiredOnce: boolean;
}

// WORKFLOW_REVIEW_REQUIRED 응답의 `originalRequest` 필드에 실을 사용자 원문의
// 최대 길이. 전체 원문은 system prompt 의 Active plan context 에 이미 XML fence
// 로 중화되어 주입되므로 review tool_result 에는 요약만 싣는다. 프롬프트 인젝션
// 표면 축소 + LLM 토큰 낭비 방지.
const REVIEW_ORIGINAL_REQUEST_MAX_LEN = 200;
/**
 * Phase 2: WORKFLOW_VERIFY_REQUIRED 발동 임계값. **non-trigger 노드 수** 가
 * 이 값 이상일 때만 verify 라운드를 강제한다. edit 호출 수가 아니라 노드 수를
 * 쓰는 이유: 회복 라운드에서 update_node 가 반복 호출되면 edit 수는 부풀지만
 * 실제 캔버스 규모는 그대로다. 노드 수가 의미 검증 비용/이득의 더 정확한
 * proxy. 3 노드 = "trigger → A → B" 같은 최소 분기 플로우 — 그 미만의 단순
 * 편집(노드 1~2개)은 verify 비용 > 정확도 이득.
 */
const MIN_NONTRIGGER_NODES_FOR_VERIFY = 3;
/**
 * 한 턴에서 `WORKFLOW_REVIEW_REQUIRED` (blocking checklist) 가 LLM 을 막을 수
 * 있는 최대 라운드 수. 변경 이력:
 *   - Phase 5: 1 → 2 로 늘리되 stuck escape (LLM 이 진척 없이 finish 만
 *     반복 호출하면 통과) 도입.
 *   - Phase 6: stuck escape 제거. 사용자가 "검증 자체가 일어나길 원함" 으로
 *     명시 — escape 가 fix 의지 없는 LLM 을 그냥 통과시켜 결함이 캔버스에
 *     남는 케이스 (carousel button dangling, configWarnings 잔존 등) 를
 *     부른다. 이제는 reviewRoundCount 가 이 상한에 도달할 때까지 LLM 이 fix
 *     했든 안 했든 계속 막는다. 추가 비용은 LLM 토큰 1~2 라운드 (사용자 대기
 *     시간 영향 미미). verify_required 는 별도 1회 정책 (`verifyFiredOnce`).
 */
const MAX_REVIEW_ROUNDS = 2;

/**
 * WORKFLOW_REVIEW_REQUIRED tool_result 에 실을 사용자 원문 요약.
 * 프롬프트 인젝션 표면 축소 + 토큰 낭비 방지를 위해 길이 상한만 적용한다
 * (제어 문자 제거는 이후 LLM 이 context 파싱 시 문제되지 않는 수준이므로 생략).
 */
function truncateReviewOriginalRequest(req: string): string {
  if (!req) return '';
  if (req.length <= REVIEW_ORIGINAL_REQUEST_MAX_LEN) return req;
  return req.slice(0, REVIEW_ORIGINAL_REQUEST_MAX_LEN - 1) + '…';
}

/**
 * 2단계 finish 가드 — plan 완결성(`evaluateFinishGuard`) + 워크플로우 품질
 * self-review(`evaluateReviewGuard`) 를 캡슐화한다. spec 3-workflow-editor
 * §10 의 가드 상태기계(progress-aware finish 재발동·review 최대 2회·verify
 * 턴당 1회)를 `WorkflowAssistantStreamService.streamMessage` 에서 분리해 단위
 * 테스트 가능한 무상태 collaborator 로 추출 (M-3 2단계). 턴 횡단 카운터
 * (`FinishGuardState`)는 호출부가 소유·변이하고 가드는 판정만 수행한다.
 */
@Injectable()
export class AssistantFinishGuard {
  constructor(
    private readonly nodeRegistry: NodeComponentRegistry,
    private readonly candidateLookup: CandidateLookupService,
  ) {}

  /**
   * 2단계 finish 의 self-review. `evaluateFinishGuard` 가 통과한 상태에서만
   * 호출된다 — 즉 plan 체크박스·openQuestions 수준의 완결성은 이미 OK.
   * 여기서는 한 단계 더 들어가 **워크플로우 품질** 을 감사한다:
   *  - 이번 턴에 실패한 tool call 이 회복되지 않은 채 남아있지 않은지
   *  - 어떤 노드도 trigger 에서 도달 불가능하지 않은지
   *  - pendingUserConfig 이 있는 노드를 마무리 한국어 메세지에 모두 언급했는지
   *  - plan step 에 ok:false 호출만 연결된 "허위 완료" 가 있지 않은지
   *  - 사용자 원 요청 토큰이 현재 노드 label 들과 거의 안 겹치면 soft warn
   *
   * 발동 조건 (비활성 상태):
   *  - `state.reviewCompleted` 가 이미 true (이번 턴에 한 번 했거나 skip 됨)
   *  - `state.reviewRoundCount >= 2` (상한)
   *  - 이번 턴에 성공한 edit 이 하나도 없음 (질문 전용·plan-only 턴)
   *  - 체크리스트가 비었거나 blocking 항목 없음
   */
  async evaluateReviewGuard(
    history: WorkflowAssistantMessage[],
    planForTurn: AssistantPlanRecord | null,
    pendingToolCalls: AssistantToolCallRecord[],
    state: FinishGuardState,
    originalRequest: string,
    assistantText: string,
    shadow: ShadowWorkflow,
    workspaceId: string,
    currentWorkflowId: string,
  ): Promise<FinishGuardError | null> {
    // shadow.snapshot() 은 nodes/edges 전체를 shallow clone 하므로 한 번만 찍고
    // skip 판정과 체크리스트에 공유한다.
    const snapshot = shadow.snapshot();
    if (this.shouldSkipReview(state, pendingToolCalls, snapshot)) return null;

    // review 대상 plan: 이번 턴에 새로 propose 된 plan 우선, 없으면 history
    // 에서 활성 plan 을 derive.
    const planCtx = findActivePlanContext(
      history,
      planForTurn,
      pendingToolCalls,
      originalRequest,
    );
    const plan = planForTurn ?? planCtx?.plan ?? null;

    // ED-AI-39: `PENDING_USER_CONFIG_UNMENTIONED` 는 candidate 가 0 인 항목에
    // 대해서만 발동해야 한다 (후보가 1+ 면 picker 가 UX 를 완결). review
    // 내부 콜백이 sync 이므로 **모든 노드에 대해** 미리 pending 을 계산한
    // Map 을 만들어 전달한다.
    //
    // review W-2 최적화: 매 self-review 라운드마다 모든 노드×모든 selector
    // field 에 대해 DB 조회를 돌리면 N×M burst 가 발생한다. 우선 sync
    // `collectPendingUserConfig` 로 pending 필드가 실제 있는 노드만 추린
    // 뒤에만 async `fillCandidates` 를 호출해 불필요한 쿼리를 차단.
    // pending 이 없는 노드는 빈 배열로 직행. 결과 Map 은 `Promise.all`
    // 로 모은 entries 배열에서 new Map 으로 불변 생성 (review W-13).
    const detectOnly = snapshot.nodes.map((n) => {
      const pending = collectPendingUserConfig(shadow, n.id, this.nodeRegistry);
      return { nodeId: n.id, pending };
    });
    const filled = await Promise.all(
      detectOnly.map(async ({ nodeId, pending }) => {
        if (pending.length === 0) {
          return [nodeId, [] as PendingUserConfigField[]] as const;
        }
        const withCandidates = await this.candidateLookup.fillCandidates(
          workspaceId,
          currentWorkflowId,
          pending,
        );
        return [nodeId, withCandidates] as const;
      }),
    );
    const pendingByNode = new Map<string, PendingUserConfigField[]>(filled);

    const checklist = buildReviewChecklist({
      shadowSnapshot: snapshot,
      pendingToolCalls,
      plan,
      originalRequest,
      assistantText,
      collectPendingUserConfig: (nodeId) => pendingByNode.get(nodeId) ?? [],
      nodeDefs: this.nodeRegistry.listDefinitions(),
    });
    if (!checklistBlocks(checklist)) {
      // Phase 2: 7개 violation 패턴이 모두 통과해도 non-trivial 워크플로우
      // (non-trigger 노드 ≥ MIN_NONTRIGGER_NODES_FOR_VERIFY) 에는 LLM 이
      // currentWorkflow ↔ originalRequest 를 1:1 로 대조한 뒤 finish 하도록 한
      // 라운드를 강제한다. checklist 휴리스틱이 못 잡는 "사용자 의도 vs 빌드
      // 결과" 의 의미적 격차를 LLM 자신의 추론으로 메우게 하는 단계.
      //
      // Phase 5: verify 는 1회 정책 — 한 번 fire 했으면 같은 턴에 다시 fire
      // 하지 않는다 (review_required 와 달리 blocking 이 없는 상태이므로 fix
      // 강제 의미가 약함). reviewRoundCount 만으로는 review_required 가 1회
      // fire 한 뒤 verify 가 추가로 fire 하는 잘못된 시나리오를 막을 수 없어
      // 별도 플래그가 필요.
      if (state.verifyFiredOnce) return null;
      const nonTriggerNodeCount = snapshot.nodes.filter(
        (n) => n.category !== 'trigger',
      ).length;
      if (nonTriggerNodeCount < MIN_NONTRIGGER_NODES_FOR_VERIFY) return null;
      return {
        ok: false,
        error: 'WORKFLOW_VERIFY_REQUIRED',
        // blocking 은 비어있고 (있으면 위 분기로 갔을 것) REQUEST_COVERAGE_LOW
        // 같은 non-blocking 항목만 남는다 — LLM 이 참고 정도로 활용.
        checklist,
        originalRequest: truncateReviewOriginalRequest(originalRequest),
        planTitle: plan?.title,
        currentWorkflow: toWorkflowView(snapshot),
        message:
          "Before finishing: cross-check the built workflow against the user's original request one last time. The `currentWorkflow` field below is the AUTHORITATIVE turn-end state — trust it over the turn-start snapshot in the system prompt and over your own memory of prior tool results. 1) Walk every node in `currentWorkflow.nodes` and every edge in `currentWorkflow.edges` and confirm each was intended. 2) Compare against `originalRequest` — every concrete noun phrase or action the user mentioned should map to a node label or a config field. If something is missing, add it with edit tools (and re-call finish — the next finish will pass through). If everything checks out, emit a short Korean '검토 완료' summary describing what you verified and call finish again immediately.",
      };
    }

    return {
      ok: false,
      error: 'WORKFLOW_REVIEW_REQUIRED',
      checklist,
      // 사용자 원문은 LLM 에게 tool_result 로 재주입되므로 프롬프트 인젝션
      // 표면이 된다. 여기서는 요약 목적이라 첫 `REVIEW_ORIGINAL_REQUEST_MAX_LEN`
      // 자만 잘라 싣는다. 전체 원문은 활성 plan 컨텍스트(system prompt) 에
      // 이미 XML fence 로 중화되어 주입되므로 중복 노출도 방지.
      originalRequest: truncateReviewOriginalRequest(originalRequest),
      planTitle: plan?.title,
      // turn-end 권위 snapshot. LLM 이 자기 누적 tool_result 기억이나 system
      // prompt 의 turn-start snapshot 으로 fix 를 시도하면 같은 턴 내 다른 round
      // 의 부수효과(예: 이전 update_node 의 configWarnings, dynamic port 의
      // 실제 id) 를 놓쳐 회복 라운드가 추가로 든다. 같은 메서드 진입부에서
      // 이미 한 번 찍은 `snapshot` 을 그대로 재사용해 직렬화 비용은 1회.
      currentWorkflow: toWorkflowView(snapshot),
      message:
        "Before finishing: audit the built workflow against the user's original request. The `currentWorkflow` field below is the AUTHORITATIVE turn-end state — trust it over the turn-start snapshot in the system prompt and over your own memory of prior tool results. 1) Walk every node in `currentWorkflow.nodes` and every edge in `currentWorkflow.edges` once and verify each was intended. 2) Read each blocking checklist item and fix it with edit tools — unresolved failures, orphan nodes, dangling output ports, unmentioned pendingUserConfig, fake step completion, or unaddressed configWarnings. 3) Re-call `get_current_workflow` ONLY after issuing NEW edit tool calls in this review round. 4) Emit a short Korean '검토 완료' summary covering what you fixed, then call finish again. The second finish will pass through without re-running this review.",
    };
  }

  /**
   * review 건너뛰기 여부 판정. 사용자의 "검증 자체가 일어나야 한다" 요구에
   * 맞춰 LLM 의 fix 의지와 무관하게 reviewRoundCount 상한까지 막는다. 다음 중
   * 하나라도 참이면 review 는 발동하지 않는다:
   *  - 이미 이번 턴에 review 가 완전히 끝났거나 (`reviewCompleted` — 통과 또는
   *    `verify_workflow` 외부화 검증 완료)
   *  - `reviewRoundCount` 가 `MAX_REVIEW_ROUNDS` 도달 — fix 강제 상한.
   *    LLM 이 그 안에 fix 못 하면 통과시켜 사용자가 다음 턴에서 직접 지시
   *    가능하게 한다 (무한 루프 방지).
   *  - 같은 턴 `clear_plan` → 화제 전환으로 "점검 대상" 이 아님
   *  - 이번 턴에 성공한 edit 이 하나도 없음 — 실행 턴 아님 (질문·plan-only·
   *    전량 실패 케이스)
   *  - non-trigger 노드 수 ≤ 1 — 단발성 trivial 편집은 audit ROI 낮음
   *
   * Phase 6 변경: 기존 stuck escape (`reviewRoundCount > 0 &&
   * editsSinceLastFinishBlock === 0`) 제거. fix 의지가 없는 LLM 도 추가
   * 라운드를 받아 검증 흔적이라도 남도록 강제. 사용자 보고 케이스
   * (configWarnings 잔존한 채 그냥 통과) 의 직접 회귀 차단.
   *
   * 주의: PLAN_NOT_COMPLETE 가 이미 fire 한 경우에도 review 는 발동한다.
   * plan 체크박스 충족 ≠ 워크플로우 품질 — 두 가드는 서로 다른 계층의
   * 검증이므로 함께 발동해야 사용자가 기대하는 "완성도 점검" 이 일어난다.
   */
  private shouldSkipReview(
    state: FinishGuardState,
    pendingToolCalls: AssistantToolCallRecord[],
    snapshot: ShadowSnapshot,
  ): boolean {
    if (state.reviewCompleted) return true;
    if (state.reviewRoundCount >= MAX_REVIEW_ROUNDS) return true;
    if (state.planClearedThisTurn) return true;
    const hadSuccessfulEdit = pendingToolCalls.some(
      (tc) =>
        tc.kind === 'edit' &&
        (tc.result as { ok?: boolean } | undefined)?.ok === true,
    );
    if (!hadSuccessfulEdit) return true;
    const nonTriggerCount = snapshot.nodes.filter(
      (n) => n.category !== 'trigger',
    ).length;
    if (nonTriggerCount <= 1) return true;
    return false;
  }

  /**
   * `finish` 호출 시점의 plan 완결성을 평가한다. ActivePlanContext 기반으로
   * 판단하며 — `cleared` 상태거나 completed 상태면 guard 가 발동하지 않는다.
   * active 상태에서 pending step 또는 openQuestions 가 남아있을 때만
   * PLAN_NOT_COMPLETE 를 반환한다.
   *
   * 아래 조건이면 null(정상 finish):
   *   - 같은 턴에 `clear_plan` 이 호출됨 — 사용자가 화제를 바꾼 것으로 간주
   *   - 직전 block 이후 어떤 진척(edit/plan tool 성공)도 없이 또 finish 시도 —
   *     LLM 이 진짜로 stuck 된 상태이므로 무한 루프 방지로 허용. 진척이 1회라도
   *     있었다면 가드가 다시 발동해 남은 step 을 끝까지 끌고 간다.
   *   - activePlan 없음 or status !== 'active'
   *   - 이번 턴이 실행 턴도 아니고 plan 을 새로 발행한 턴도 아님
   *   - planForTurn 이 null 인데 이번 턴 편집이 active plan 과 전혀 매칭되지
   *     않으면 단발성 편집으로 간주
   *
   * @param history          DB 에서 로드된 같은 세션의 과거 메시지들
   * @param planForTurn      이번 턴에 새로 propose 된 plan (없으면 null)
   * @param pendingToolCalls 이번 턴에 지금까지 실행/시도된 tool call 들
   * @param state            turn-scoped guard 카운터
   *                         (`finishBlockCount`/`editsSinceLastFinishBlock`/`planClearedThisTurn`)
   * @param pendingUserRequest 사용자 메시지 원문 — active plan derivation 에 사용
   */
  evaluateFinishGuard(
    history: WorkflowAssistantMessage[],
    planForTurn: AssistantPlanRecord | null,
    pendingToolCalls: AssistantToolCallRecord[],
    state: FinishGuardState,
    pendingUserRequest: string,
  ): FinishGuardError | null {
    if (state.planClearedThisTurn) return null;
    // Plan-only 턴 — approve 전까지는 edit 이 어차피 PAA 로 차단되므로 finish 를
    // PLAN_NOT_COMPLETE 로 막으면 LLM 에게 "남은 step 실행" 을 잘못 신호해 재시도
    // 핑퐁을 유발한다. 가드 비활성 → finish 통과 → 다음 턴(approve 후) 에서 실행.
    if (isPlanPendingApproval(planForTurn)) return null;
    // Stuck 탈출: block 후 LLM 이 어떤 진척도 못 만들고 다시 finish 호출.
    // 진척이 있었으면 (editsSinceLastFinishBlock > 0) 다시 평가해 끝까지 끌고
    // 간다. toolCallsBudget 과 MAX_TOOL_LOOP_ROUNDS 가 절대 상한.
    if (state.finishBlockCount > 0 && state.editsSinceLastFinishBlock === 0)
      return null;
    // 성공한 edit 만 "이번 턴 실행 발생" 으로 간주한다. 실패한 edit (ok:false)
    // 은 canvas 를 바꾸지 않으므로 plan checklist 도 진행시키지 않는다 — 이를
    // 카운트하면 plan-only 턴이나 단발성 실패 후의 finish 가 잘못 막힌다.
    const editThisTurn = pendingToolCalls.some(
      (tc) =>
        tc.kind === 'edit' &&
        (tc.result as { ok?: boolean } | null | undefined)?.ok === true,
    );
    if (!editThisTurn) return null;

    const ctx: ActivePlanContext | null = findActivePlanContext(
      history,
      planForTurn,
      pendingToolCalls,
      pendingUserRequest,
    );
    if (!ctx || ctx.status !== 'active') return null;

    // planForTurn 이 null 이면서 이번 턴 편집 중 active plan 의 step id 를
    // 가진 게 하나도 없으면 무관한 편집으로 간주하고 guard 비활성.
    if (!planForTurn) {
      const activePlanStepIds = new Set(ctx.plan.steps.map((s) => s.id));
      const linked = pendingToolCalls.some(
        (tc) =>
          typeof tc.planStepId === 'string' &&
          activePlanStepIds.has(tc.planStepId),
      );
      if (!linked) return null;
    }

    const pendingSteps = ctx.plan.steps
      .filter((s) => s.action !== 'note')
      .filter((s) => !ctx.completedStepIds.has(s.id))
      .map((s) => ({ id: s.id, description: s.description }));
    const openQuestions = ctx.plan.openQuestions ?? [];
    if (pendingSteps.length === 0 && openQuestions.length === 0) return null;

    const hint =
      pendingSteps.length > 0 && openQuestions.length > 0
        ? 'The active plan has pending steps AND unanswered openQuestions. Ask the user the remaining questions in a Korean message, and execute the pending edit tools (with their planStepId) — especially add_edge calls that keep new nodes connected back to manual_trigger.'
        : pendingSteps.length > 0
          ? 'The active plan has pending steps. Execute the remaining edit tools with their matching planStepId — especially add_edge calls that keep new nodes connected back to manual_trigger — or explain why a step should be skipped. Then call finish again. If the user has moved on to unrelated work, call clear_plan first.'
          : 'The active plan still has unanswered openQuestions. Do NOT call finish. Instead, end this turn with a short Korean message asking the user the remaining questions.';
    return {
      ok: false,
      error: 'PLAN_NOT_COMPLETE',
      pendingSteps,
      openQuestions,
      message: `Finish blocked: ${hint}`,
    };
  }
}
