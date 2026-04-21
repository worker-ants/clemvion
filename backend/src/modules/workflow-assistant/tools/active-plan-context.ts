import {
  AssistantPlanRecord,
  AssistantToolCallRecord,
  WorkflowAssistantMessage,
} from '../entities/workflow-assistant-message.entity';

/**
 * 세션 전반에서 "지금 하고 있는 일" 을 나타내는 장기 컨텍스트.
 *
 * DB 컬럼으로 저장하지 않고 매 턴 history 로부터 derive 한다. 저장소 변경
 * 없이도 LLM 에게 plan 전후 step 진행과 사용자의 원 요청을 명시적으로 재노출
 * 하여 중간 턴에서 맥락을 잃지 않도록 하는 것이 목적이다.
 *
 * 상태는 두 가지:
 *  - `active`    : plan 이 아직 유효. 시스템 프롬프트에 상세히 노출하고
 *                  `finish` guard 를 발동시킨다.
 *  - `completed` : step 전부 done + openQuestions 비움 + finish 기록.
 *                  요약 한 줄만 노출해 "방금 끝난 작업" 이라는 맥락을 주되
 *                  guard 는 비활성.
 *
 * cleared(=화제 전환) 는 별도 status 가 아니라 `findActivePlanContext`가
 * `null` 을 반환하는 것으로 표현한다. `clear_plan` 이 history 에 한 번이라도
 * 호출되었거나 이번 턴의 pendingToolCalls 에 들어있으면 null 반환.
 */
export type ActivePlanStatus = 'active' | 'completed';

export interface ActivePlanContext {
  status: ActivePlanStatus;
  plan: AssistantPlanRecord;
  /**
   * plan 이 발행된 assistant turn 의 직전 user message content. plan 을
   * 촉발한 사용자의 원 의도를 매 턴 프롬프트에 다시 보여주기 위한 값.
   * clarification 답변을 이어받아 plan 이 발행된 경우에는 clarification
   * 본문이 잡힐 수 있다 — 현재 구현의 알려진 한계이며, 실제로는 그 본문도
   * plan 의 직접적 맥락이라 크게 문제되지 않는다.
   */
  userRequest: string | null;
  completedStepIds: Set<string>;
  approved: boolean;
}

const CLEAR_PLAN_TOOL_NAME = 'clear_plan';

/**
 * 이번 턴에 새로 발행된 plan(`planForTurn`)이 있으면 그것이 최우선 active plan.
 * 그렇지 않으면 history 를 **가장 최근부터** 스캔해 첫 plan 을 찾는다.
 *
 * 다음 중 하나라도 참이면 null(= 화제 전환·비활성):
 *  - 이번 턴 pendingToolCalls 에 `clear_plan` 호출이 있음. 단, 그 **이후**
 *    같은 턴에 `propose_plan` 이 다시 호출되었다면 `planForTurn` 이 세팅되어
 *    있으므로 첫 번째 분기에서 이미 새 plan 을 사용한다.
 *  - history 의 plan 메시지 **이후(= planIndex + 1 부터)** 어느 assistant
 *    메시지에서 `clear_plan` 이 호출됨.
 */
export function findActivePlanContext(
  history: WorkflowAssistantMessage[],
  planForTurn: AssistantPlanRecord | null,
  pendingToolCalls: AssistantToolCallRecord[],
  pendingUserRequest: string,
): ActivePlanContext | null {
  // 1) 이번 턴에 새 plan 이 발행됐다면 그것이 최우선. (같은 턴에서 clear →
  //    propose 가 연달아 일어난 경우도 여기서 새 plan 을 취한다.)
  if (planForTurn) {
    const completedStepIds = collectCompletedStepIds(
      history,
      Number.POSITIVE_INFINITY, // 이번 턴 plan 은 아직 history 에 없으니 상한 의미만
      pendingToolCalls,
      planForTurn,
    );
    return {
      status: deriveStatus(planForTurn, completedStepIds),
      plan: planForTurn,
      userRequest: pendingUserRequest,
      completedStepIds,
      approved: Boolean(planForTurn.approvedAt),
    };
  }

  // 2) 이번 턴 pendingToolCalls 에 clear_plan 이 있으면 그 이후 새 plan 이
  //    같은 턴에 추가되지 않았음을 뜻함 (planForTurn === null) → null.
  if (
    pendingToolCalls.some(
      (tc) => tc.name === CLEAR_PLAN_TOOL_NAME || isClearPlan(tc),
    )
  ) {
    return null;
  }

  // 3) history 에서 가장 최근 plan 을 찾는다. 역방향 스캔이므로 planIndex
  //    이후에는 정의상 더 최근 plan 이 존재할 수 없다 (= 추가 propose_plan
  //    검사 불필요).
  let planIndex = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'assistant' && history[i].plan) {
      planIndex = i;
      break;
    }
  }
  if (planIndex === -1) return null;

  const planMsg = history[planIndex];
  const plan = planMsg.plan as AssistantPlanRecord;

  // planIndex **이후** 의 메시지에서만 clear_plan 을 찾는다. plan 메시지 자체
  // (planIndex 위치) 에 같은 턴의 clear_plan 이 있더라도 plan 을 즉시 stale
  // 시키는 건 잘못 — 해당 턴의 propose_plan 이 최종 의도이기 때문.
  for (let i = planIndex + 1; i < history.length; i++) {
    const m = history[i];
    if (m.role !== 'assistant') continue;
    const calls = m.toolCalls ?? [];
    if (calls.some(isClearPlan)) {
      // 단, clear_plan 이후 같은 메시지 또는 뒤 메시지에 propose_plan 이
      // 또 있다면 그 시점의 plan 이 새 활성이어야 한다. history 를 역방향
      // 스캔 중이었다면 이미 더 최근 plan 을 planIndex 로 잡았을 것. 여기
      // 도달했다면 그 뒤로 새 propose_plan 이 없다는 뜻이므로 null 반환.
      return null;
    }
  }

  const completedStepIds = collectCompletedStepIds(
    history,
    planIndex,
    pendingToolCalls,
    plan,
  );
  const userRequest = findUserRequestForPlan(history, planIndex);
  return {
    status: deriveStatus(plan, completedStepIds),
    plan,
    userRequest,
    completedStepIds,
    approved: Boolean(plan.approvedAt),
  };
}

function isClearPlan(tc: AssistantToolCallRecord): boolean {
  return tc.name === CLEAR_PLAN_TOOL_NAME;
}

/**
 * plan step 의 완료 판정에 쓰이는 tool_call 만 집계한다.
 *
 * - `planIndex` 이후 history 의 assistant 메시지 toolCalls 만 본다 (이전
 *   plan 의 동일 step ID 와 오염되지 않도록).
 * - 이번 턴의 `pendingToolCalls` 도 함께 본다.
 * - `result` 가 명시적으로 실패 (`ok === false`) 인 tool_call 은 제외.
 */
function collectCompletedStepIds(
  history: WorkflowAssistantMessage[],
  planIndex: number,
  pendingToolCalls: AssistantToolCallRecord[],
  plan: AssistantPlanRecord,
): Set<string> {
  const planStepIdSet = new Set(plan.steps.map((s) => s.id));
  const done = new Set<string>();
  const start =
    planIndex === Number.POSITIVE_INFINITY ? history.length : planIndex;
  for (let i = start; i < history.length; i++) {
    const m = history[i];
    if (m.role !== 'assistant' || !m.toolCalls) continue;
    for (const tc of m.toolCalls) {
      markIfCompleted(tc, planStepIdSet, done);
    }
  }
  for (const tc of pendingToolCalls) {
    markIfCompleted(tc, planStepIdSet, done);
  }
  return done;
}

function markIfCompleted(
  tc: AssistantToolCallRecord,
  planStepIdSet: Set<string>,
  done: Set<string>,
): void {
  if (!tc.planStepId || !planStepIdSet.has(tc.planStepId)) return;
  if (isExplicitFailure(tc.result)) return;
  done.add(tc.planStepId);
}

/**
 * tool_call 결과가 **명시적으로 실패** 로 내려온 경우에만 true. 그 외
 * (`undefined`, 원시 값, `{ok: true}`, shape 불명) 는 legacy rehydration
 * 동작과의 호환을 위해 "성공 혹은 불명(=성공으로 간주)" 로 처리한다.
 *
 * 즉 `{ok: false, error: 'X'}` 만이 '명시적 실패' 이다.
 */
export function isExplicitFailure(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;
  return (result as { ok?: unknown }).ok === false;
}

function deriveStatus(
  plan: AssistantPlanRecord,
  completedStepIds: Set<string>,
): ActivePlanStatus {
  const remaining = plan.steps
    .filter((s) => s.action !== 'note')
    .filter((s) => !completedStepIds.has(s.id));
  const openQuestions = plan.openQuestions ?? [];
  if (remaining.length === 0 && openQuestions.length === 0) return 'completed';
  return 'active';
}

function findUserRequestForPlan(
  history: WorkflowAssistantMessage[],
  planIndex: number,
): string | null {
  for (let i = planIndex - 1; i >= 0; i--) {
    if (history[i].role === 'user') return history[i].content ?? null;
  }
  return null;
}
