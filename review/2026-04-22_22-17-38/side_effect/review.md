### 발견사항

- **[WARNING]** 모듈 스코프 변경 가능 캐시 변수 도입
  - 위치: `system-prompt.ts:24` — `let EXPRESSION_REFERENCE_CACHE: string | null = null`
  - 상세: `getExpressionReferenceSection()`이 모듈 수명 동안 최초 1회 캐시를 채우므로, 같은 Jest 프로세스 내에서 여러 테스트 파일이 `@workflow/expression-engine`의 `getAllFunctionNames()`를 **다르게 모킹**하면 첫 번째 호출 결과가 고착된다. `jest.resetModules()`로 모듈을 재로드하지 않는 한 이후 테스트는 stale한 함수 목록을 받는다.
  - 제안: 현재 테스트 픽스처가 단일 파일에 집중되어 있어 실제 충돌 위험은 낮다. 다만 `getAllFunctionNames`를 모킹하는 테스트가 생길 경우를 대비해 `__resetExpressionCacheForTest()` 같은 테스트 전용 export 또는 `jest.isolateModules()` 블록을 고려할 수 있다.

- **[WARNING]** `activePlanSection` 위치 이동으로 인한 렌더링 헤딩 계층 불일치
  - 위치: `system-prompt.ts:buildSystemPrompt` 반환 템플릿
  - 상세: `activePlanContext`가 `null`이면 `activePlanSection`이 빈 문자열이 되고, 템플릿에서 `${activePlanSection}### Current workflow snapshot`이 그대로 `### Current workflow snapshot`으로 출력된다. 이 `###` 헤더는 부모 `##` 섹션(`## Dynamic state — active plan & current canvas`) 아래에 있으므로 구조적으로는 올바르지만, active plan이 있는 경우에는 `## Active plan context`가 중간에 끼어 `###`의 의미론적 계층이 달라진다. LLM에 전달되는 마크다운 계층이 실행 경로에 따라 달라진다.
  - 제안: `## Current workflow snapshot`으로 헤딩 레벨을 `##`로 통일하거나, `## Dynamic state` 내 서브섹션임을 명시적으로 표현. 현재 테스트는 헤딩 레벨을 검증하지 않으므로 회귀 위험은 낮다.

- **[INFO]** 내부 함수 `renderExpressionReferenceSection` → `getExpressionReferenceSection` 이름 변경
  - 위치: `system-prompt.ts`
  - 상세: 비공개 함수이므로 외부 호출자에 영향 없음. `export function buildSystemPrompt`의 시그니처(파라미터·반환 타입)는 완전히 보존되어 있다.
  - 제안: 해당 없음.

- **[INFO]** `STATIC_BLOCK_3_EDIT_PLAYBOOK` 내 레이아웃 상수 빌드타임 인라인
  - 위치: `system-prompt.ts` — STATIC_BLOCK_3 상수 선언부
  - 상세: `LAYOUT_FALLBACK_WIDTH` 등 4개 상수가 모듈 로드 시점에 템플릿 리터럴로 평가·고정된다. 이후 상수 값을 변경해도 빌드 재실행 없이는 프롬프트에 반영되지 않는다. 이는 의도된 동작이나, 상수 변경 시 static block 문자열도 함께 바뀐다는 사실을 인지해야 한다.
  - 제안: 해당 없음 (현재 구조상 의도적 설계).

- **[INFO]** 신규 테스트의 `activePlan` 픽스처 `describe` 블록 스코프 내 공유
  - 위치: `system-prompt.spec.ts:337–361`
  - 상세: `const activePlan` 이 describe 블록 내 `const`로 선언되어 있어 불변이다. 여러 `it` 블록이 공유하지만 모두 읽기 전용 참조이므로 상태 오염 없음.
  - 제안: 해당 없음.

---

### 요약

이번 변경의 핵심 부작용 위험은 새로 도입한 모듈 스코프 `EXPRESSION_REFERENCE_CACHE` 변수 하나다. 프로덕션 환경에서는 `getAllFunctionNames()`의 반환값이 변하지 않으므로 실질적 문제가 없지만, 해당 함수를 다르게 모킹하는 테스트가 같은 프로세스에서 실행되면 캐시가 오염될 수 있다. 공개 API(`buildSystemPrompt` 시그니처)는 완전히 보존되어 있고, 정적 블록 상수(`STATIC_BLOCK_1~3`)는 빌드타임에 1회만 평가되므로 런타임 상태 변경이 없다. `renderActivePlanSection`의 `null` 경로에서 헤딩 계층이 달라지는 점은 LLM 행동에 미묘한 영향을 줄 수 있으나 기존 테스트 범위 밖이다.

### 위험도

**LOW**