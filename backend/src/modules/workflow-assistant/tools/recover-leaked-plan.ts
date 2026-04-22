/**
 * propose_plan payload 가 text 채널로 leak 된 경우를 탐지·복구한다.
 *
 * 실사례: GPT-4o 가 `propose_plan` 도구를 호출하지 않고 plan JSON 을 assistant
 * text 로 그대로 뱉는 사고가 관측되었다. 시스템 프롬프트에서 막는 것이 1차
 * 방어선이지만 모델이 무시하는 경우 서버가 텍스트에서 propose_plan 시그니처
 * 를 뽑아 합성 tool call 로 변환한다.
 *
 * 설계 원칙:
 *  - **정확한 shape 검증으로 오탐 방지.** title(string) + steps(array) + 각 step
 *    이 id/action/description 을 모두 갖춰야 인정한다. 사용자가 작성한 노드
 *    config 문자열이나 다른 JSON 이 "title" 같은 키를 가져도 통과하지 않도록.
 *  - **balanced brace scanner 로 description 안의 `}` 에 깨지지 않는다.** 문자열
 *    리터럴 안쪽을 무시하고 depth=0 시점을 찾는다. JSON 전용이므로 double
 *    quote 만 경계 문자로 인정.
 *  - **O(n) 스캔.** 매칭 실패한 후보의 끝 위치로 점프해 O(n²) 재방문을 피한다.
 *  - **순수 함수.** side effect 없음. 호출자는 결과의 `matched` 로 원문에서
 *    JSON 구간을 잘라내고, `args` 로 합성 tool call 을 구성할 수 있다.
 */

import {
  PLAN_STEP_ACTIONS,
  AssistantStepAction,
} from '../entities/workflow-assistant-message.entity';

export interface RecoveredPlan {
  /** parse 된 propose_plan 인자 객체 (title, summary?, steps, openQuestions?) */
  args: Record<string, unknown>;
  /** 원문에서 매칭된 JSON substring. 호출자가 이 값을 기반으로 text 를 스크럽 */
  matched: string;
}

// entity 의 유니온 타입에서 파생 — 새 action 추가 시 자동 반영.
const VALID_STEP_ACTIONS: ReadonlySet<AssistantStepAction> = new Set(
  PLAN_STEP_ACTIONS,
);

/**
 * text 에서 propose_plan shape JSON 블록을 찾아 `args`/`matched` 로 반환한다.
 * 조건에 맞는 블록이 없으면 `null`.
 *
 * @param text - 스캔할 assistant 텍스트 (일반적으로 한 라운드 분 prose + leak)
 * @returns 발견 시 복구 payload, 없거나 shape 불일치면 `null`
 */
export function recoverLeakedPlan(text: string): RecoveredPlan | null {
  if (!text || typeof text !== 'string') return null;
  // Fast-path: propose_plan 시그니처 키가 둘 다 없으면 스캔 자체를 생략한다.
  // 평범한 prose 에서는 이 두 문자열이 동시에 등장할 확률이 극히 낮다.
  if (!text.includes('"title"') || !text.includes('"steps"')) return null;

  let i = 0;
  while (i < text.length) {
    if (text[i] !== '{') {
      i++;
      continue;
    }
    const end = findMatchingBrace(text, i);
    if (end < 0) {
      // 짝 맞는 `}` 가 끝까지 없으면 더 볼 필요가 없다.
      break;
    }
    const candidate = text.slice(i, end + 1);
    const parsed = tryParseObject(candidate);
    if (parsed && isProposePlanShape(parsed)) {
      return { args: parsed, matched: candidate };
    }
    // 이 블록 전체는 후보 아님 → 블록 끝 다음 칸으로 점프 (O(n) 보장).
    i = end + 1;
  }
  return null;
}

/**
 * `start` 가 `{` 인 위치에서 짝 맞는 `}` 인덱스를 돌려준다. 문자열 리터럴
 * 내부의 `{`/`}` 는 depth 카운팅에서 제외한다. 짝을 못 찾으면 -1.
 *
 * JSON 전용이므로 double quote 만 문자열 경계로 인정한다. Single quote 는
 * JSON 상 string 구분자가 아니므로 depth 카운팅에 영향을 주지 않는다.
 */
function findMatchingBrace(s: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function tryParseObject(s: string): Record<string, unknown> | null {
  try {
    const r: unknown = JSON.parse(s);
    if (r !== null && typeof r === 'object' && !Array.isArray(r)) {
      return r as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * `propose_plan` 인자 shape 엄격 검증. title + steps(structured) 가 최소 요건.
 * summary / openQuestions 는 선택이지만 존재하면 타입 검사.
 */
function isProposePlanShape(o: Record<string, unknown>): boolean {
  if (typeof o.title !== 'string' || o.title.length === 0) return false;

  if (!Array.isArray(o.steps)) return false;
  if (o.steps.length === 0) return false;
  for (const step of o.steps) {
    if (typeof step !== 'object' || step === null || Array.isArray(step)) {
      return false;
    }
    const s = step as Record<string, unknown>;
    if (typeof s.id !== 'string' || s.id.length === 0) return false;
    if (
      typeof s.action !== 'string' ||
      !VALID_STEP_ACTIONS.has(s.action as AssistantStepAction)
    ) {
      return false;
    }
    if (typeof s.description !== 'string') return false;
  }

  if (o.summary !== undefined && typeof o.summary !== 'string') return false;
  if (o.openQuestions !== undefined) {
    if (!Array.isArray(o.openQuestions)) return false;
    for (const q of o.openQuestions) {
      if (typeof q !== 'string') return false;
    }
  }
  return true;
}
