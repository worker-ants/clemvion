import { validate } from '@workflow/expression-engine';

/**
 * 노드 config 안에 섞여 들어갈 수 있는 표현식 문자열(`{{ ... }}`)이
 * expression-engine 이 파싱 가능한 구문만 쓰도록 커밋 전에 검사한다.
 *
 * Assistant 는 LLM 이 생성하는 config 를 그대로 저장하므로 JS 만의 사투리
 * (`??`, arrow function `x => x`, template backtick, spread `...`,
 * destructuring 등)가 슬쩍 흘러들어가면 사용자가 실행 시점에 처음 알게 된다.
 * 여기서 잡아 `INVALID_EXPRESSION` 으로 되돌려 같은 턴 안에서 LLM 이 수정하게
 * 한다.
 *
 * `validate()` 는 tokenizer + parser 만 돌리므로 "$node[\"...\"] 가 런타임에
 * 실제로 존재하냐" 같은 semantic 검증은 포함되지 않는다. 문법 수준(= 런타임
 * 이전에 반드시 실패할 상태)만 차단한다.
 */
export interface ExpressionValidationIssue {
  /**
   * 실패한 필드의 점-표기 경로. 배열 인덱스는 `[0]` 형태. 예: `cases[1].label`
   */
  path: string;
  /** validate()가 돌려준 에러 메세지 */
  message: string;
  /** 문제된 원본 문자열 (필요하다면 LLM 이 수정의 기점으로 사용) */
  value: string;
}

export interface ExpressionValidationResult {
  valid: boolean;
  issues: ExpressionValidationIssue[];
}

/**
 * config 트리를 재귀 순회하며 모든 문자열 값을 validate() 로 검사.
 *
 * - `value` 가 문자열이면 `validate()` 호출. 템플릿에 `{{` 가 없으면 tokenizer
 *   는 Text 로 통과시키므로 평범한 문자열은 문제없이 valid 로 떨어진다.
 * - 배열/객체는 재귀. 순환 참조는 config가 JSON 직렬화 가능한 데이터라는
 *   가정하에 무시(실제로도 ShadowWorkflow 는 JSON-safe 한 값만 받는다).
 */
export function validateConfigExpressions(
  config: unknown,
): ExpressionValidationResult {
  const issues: ExpressionValidationIssue[] = [];
  walk(config, '', issues);
  return { valid: issues.length === 0, issues };
}

function walk(
  value: unknown,
  path: string,
  issues: ExpressionValidationIssue[],
): void {
  if (value === null || value === undefined) return;
  if (typeof value === 'string') {
    // `{{` 이 전혀 없으면 validate() 도 parse 를 건너뛰지만, 그래도 호출
    // 비용이 미미하고 특수문자 조합(예: `{{` 가 escape 로 들어간 경우)까지
    // 일관되게 커버되므로 가드 없이 호출한다.
    const result = validate(value);
    if (!result.valid) {
      issues.push({
        path: path || '<root>',
        message: result.errors[0]?.message ?? 'Invalid expression',
        value,
      });
    }
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      walk(value[i], `${path}[${i}]`, issues);
    }
    return;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const nextPath = path ? `${path}.${k}` : k;
      walk(v, nextPath, issues);
    }
  }
}
