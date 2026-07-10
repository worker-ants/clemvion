/**
 * `context.variables` 의 `__`(double-underscore) 예약 네임스페이스 가드.
 *
 * SoT: `spec/conventions/execution-context.md` 원칙 5. 엔진이 실행 시작 시
 * `__workspaceId` / `__workspaceName` / `__workspaceTimezone` / `__dryRun` 를
 * 이 맵에 주입하므로, 사용자 변수는 `__` 를 쓸 수 없다.
 *
 * 강제는 3계층이다 — 어느 하나도 단독으로는 충분하지 않다:
 *
 *  - **L0 저장 시점** (`WorkflowsService.saveCanvas` / `importWorkflow`):
 *    리터럴 이름을 400 으로 거부해 사용자가 즉시 알게 한다.
 *  - **L1 pre-flight** (`validateConfig` → 엔진의 `INVALID_NODE_CONFIG`):
 *    저장 게이트를 우회해 들어온 리터럴 이름을 실행 직전 차단한다.
 *  - **L2 런타임** (핸들러 `execute`): `variables[i].name` 은 `{{ }}` 표현식
 *    대상이므로(두 노드는 `EXPRESSION_EXCLUSIONS` 에 없다) L0·L1 은 **해석 전**
 *    원본만 본다. `{{ $input.x }}` 가 `__workspaceId` 로 평가되는 경우는 오직
 *    해석 후 검사만 잡을 수 있다.
 *
 * `_`(단일 underscore) 는 예약이 아니다 — 원칙 4 의 `_` 는 `ExecutionContext`
 * **최상위** 필드(`_resumeState` 등) 이고, 본 가드는 `variables` **맵 내부**의
 * 이름을 다룬다. 스코프가 겹치지 않는다.
 */

/** 예약 prefix. 시스템 주입 키는 전부 이것으로 시작한다. */
export const RESERVED_VARIABLE_PREFIX = '__';

/**
 * 저장 시점(L0) 400 응답 및 런타임(L2) throw 에 쓰는 에러 코드.
 * SoT 카탈로그: `spec/5-system/3-error-handling.md` §1.3.
 */
export const RESERVED_VARIABLE_NAME_CODE = 'RESERVED_VARIABLE_NAME';

export function isReservedVariableName(name: unknown): boolean {
  return typeof name === 'string' && name.startsWith(RESERVED_VARIABLE_PREFIX);
}

/** `validateConfig` (L1) / 저장 게이트 (L0) 가 쓰는 영문 SoT 메시지. */
export function reservedVariableNameError(path: string): string {
  return `${path} must not start with reserved prefix "${RESERVED_VARIABLE_PREFIX}"`;
}

/**
 * L2 런타임 throw. 엔진은 thrown Error 를 message-only 로 기록하므로
 * (`execution-engine.service.ts` 의 error-policy switch), 엔진 자신의
 * `INVALID_NODE_CONFIG:` prefix 관례를 미러해 코드를 message 앞에 싣는다.
 */
export function reservedVariableNameRuntimeError(
  path: string,
  resolvedName: string,
): Error {
  return new Error(
    `${RESERVED_VARIABLE_NAME_CODE}: ${path} resolved to "${resolvedName}", ` +
      `which starts with the reserved prefix "${RESERVED_VARIABLE_PREFIX}"`,
  );
}
