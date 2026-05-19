# 유지보수성(Maintainability) 리뷰 결과

대상 파일: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`

---

## 발견사항

### 1. [WARNING] `sanitizeLastErrorMessage` 를 엉뚱한 모듈에서 import

- 위치: diff +35번째 줄 (파일 상단 import 섹션)
- 상세: `sanitizeLastErrorMessage` 가 `integration-oauth.service` 에서 import 된다. 이름 그대로 OAuth 통합 전용 로직에서 꺼내 온 함수인데, execution-engine 의 AI 턴 에러 sanitize 에 재활용하고 있다. 이는 모듈 경계 위반이며, `integration-oauth.service` 에 불필요한 의존성을 추가한다. 향후 OAuth 모듈 리팩터링 시 숨겨진 파괴적 변경이 발생할 수 있다.
- 제안: `sanitizeLastErrorMessage` 를 `shared/` 하위 util 파일(예: `shared/utils/sanitize.ts`)로 이동하거나, execution-engine 전용 에러 sanitize 유틸을 별도로 작성한다.

---

### 2. [WARNING] `extractAiTurnErrorPayload` 의 rawMessage 추출 로직 복잡도 과잉

- 위치: diff +206~229번째 줄 (`extractAiTurnErrorPayload` static 메서드 내)
- 상세: `err` 의 타입을 수동으로 분기하는 코드(instanceof, typeof string, null/undefined, number/boolean/bigint, 기타 JSON.stringify)가 단일 함수 안에 6개 조건으로 나열된다. 이 패턴은 `unknown` → `string` 변환의 관용구이나, 순환 참조를 가진 객체에서 `JSON.stringify` 가 throw 할 수 있어 안전하지 않다. 또한 이 변환 로직이 추후 재사용될 가능성이 높아 별도 함수로 분리되어야 한다.
- 제안: `stringifyUnknownError(err: unknown): string` 유틸 함수로 추출하고, `JSON.stringify` 에 try/catch 또는 `safe-stringify` 래퍼를 적용한다.

---

### 3. [WARNING] `handleAiTurnError` 에서 `_stripped` 변수를 `void` 로 억제하는 코드

- 위치: diff +183~186번째 줄 (`handleAiTurnError` private 메서드 내)
- 상세:
  ```typescript
  const { _resumeState: _stripped, ...safe } = adapted as ...;
  void _stripped;
  ```
  `void _stripped` 는 ESLint `no-unused-vars` 경고를 억제하기 위한 관용구이나, 코드 의도가 즉시 드러나지 않는다. 이 패턴이 `finalizeAiNode` 에서도 동일하게 쓰이고 있어 중복이다.
- 제안: 공통 헬퍼 `stripResumeState(output: Record<string, unknown>): Record<string, unknown>` 함수로 추출해 두 곳에서 재사용한다.

---

### 4. [WARNING] `finalizeAiNode` FAILED 분기 내에서 에러 메시지를 두 번 추출

- 위치: diff +291~298번째 줄 및 +319~328번째 줄
- 상세: `isFailed` 분기에서 `nodeExec.error.message` 를 설정하는 코드(첫 번째)와, 이후 `emitNode` 페이로드를 위해 `fromOutputMessage ?? fromExecError ?? 'AI Agent turn failed'` 를 재조합하는 코드(두 번째)가 중복으로 존재한다. 동일 fallback 문자열 `'AI Agent turn failed'` 가 세 곳에 하드코딩되어 있다.
- 제안: `const AI_AGENT_TURN_FAILED_MESSAGE = 'AI Agent turn failed'` 상수를 모듈 상단에 선언하고, 에러 메시지 추출을 단일 지점에서 수행한 뒤 재사용한다.

---

### 5. [INFO] `finalStatus` 가 `'COMPLETED' | 'FAILED'` 리터럴 유니온인데, 반환 타입에서는 `finalStatus?: 'FAILED'` (optional)

- 위치: diff +91번째 줄 (`handleAiMessageTurn` 반환 타입)
- 상세: 정상 경로에서는 `finalStatus` 가 `undefined` 이고, 실패 경로에서만 `'FAILED'` 가 set 된다. 한편 `waitForAiConversation` 의 로컬 변수는 `'COMPLETED' | 'FAILED'` 로 선언(diff +54번째 줄)되어 타입 표현이 일관적이지 않다. 향후 `'CANCELLED'` 등 상태가 추가될 때 두 표현 방식 중 어느 쪽을 따라야 할지 모호해진다.
- 제안: 반환 타입의 `finalStatus` 를 `'FAILED' | undefined` 가 아니라 별도 타입 앨리어스(`type AiTurnFinalStatus = 'COMPLETED' | 'FAILED'`)로 정의해 두 곳에서 같은 타입을 참조한다.

---

### 6. [INFO] 인라인 날짜 코멘트(`2026-05-19`)가 여러 곳에 반복

- 위치: diff +51~53번째 줄, +129번째 줄, +263번째 줄 등
- 상세: 날짜 기반 작업 메모 코멘트가 코드에 산재해 있다. 이 스타일이 기존 코드베이스 패턴(`WARN #N`, `INFO #N`)과는 이질적이며, git blame/log 로 이미 추적 가능한 정보를 코드 내에 중복 저장한다.
- 제안: 날짜 코멘트는 제거하고 WARN/INFO 번호 기반 코멘트 관용구(기존 패턴)로 통일하거나, 기여 컨텍스트는 커밋 메시지에만 남긴다.

---

### 7. [INFO] `handleAiTurnError` 가 동기 함수이지만 `handleAiMessageTurn` 의 반환 Promise 와 혼용

- 위치: diff +151~193번째 줄
- 상세: `handleAiTurnError` 의 시그니처가 `Promise` 없이 동기 반환(`{ resumeState, ended: true, finalStatus: 'FAILED' }`)인데, 호출자 `handleAiMessageTurn` 는 `Promise<{...}>` 를 반환한다. TypeScript 는 이를 자동 처리하지만, JSDoc 반환 타입 코멘트가 길어 가독성이 떨어지고, 혼합 동기/비동기 패턴이 향후 비동기 부작용 추가 시 실수 유발 가능성이 있다.
- 제안: `handleAiTurnError` 를 `async` 로 선언하거나, 명시적 `Promise.resolve(...)` 래핑은 불필요하므로 현행 유지하되 JSDoc 에 `@returns` 동기 명시를 추가한다.

---

## 요약

이번 변경은 AI Agent 노드의 turn 처리 중 handler throw 를 잡아 `FAILED` 상태로 올바르게 마무리하는 회귀 수정이며, 핵심 로직은 명확하고 spec 참조 코멘트도 풍부하게 작성되어 있다. 그러나 `sanitizeLastErrorMessage` 를 OAuth 전용 모듈에서 import 하는 것이 모듈 경계를 위반하고, `'AI Agent turn failed'` 등 매직 문자열이 3곳에 분산되어 있으며, `_resumeState` strip 패턴이 `handleAiTurnError` 와 `finalizeAiNode` 에 중복된다. `extractAiTurnErrorPayload` 의 unknown 타입 분기 로직은 추출되어야 할 재사용 가능 유틸이며, `JSON.stringify` 가 순환 참조 시 throw 하는 잠재적 런타임 위험도 존재한다. 전반적으로 기능적 완성도는 충분하나, 중복 제거와 모듈 경계 정리가 이루어지면 장기 유지보수 부담이 줄어들 것이다.

## 위험도

MEDIUM

---

STATUS: SUCCESS
