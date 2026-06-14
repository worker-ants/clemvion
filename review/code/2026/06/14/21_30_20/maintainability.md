# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `executions.controller.ts` — `FormValidationError → BadRequestException` 변환 로직 인라인 중복 (interaction.service.ts 와 패턴 불일치)
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts` lines 177–191
  - 상세: `interaction.service.ts`는 `badRequest()` 헬퍼 함수를 통해 `FormValidationError → BadRequestException` 변환을 캡슐화하고 `error.toHttpDetails()`를 활용한다. 반면 `executions.controller.ts`는 동일한 변환을 컨트롤러 핸들러 내부에서 인라인으로 구성한다 (`throw new BadRequestException({ error: { code: ErrorCode.VALIDATION_ERROR, message: error.message, details: error.toHttpDetails() } })`). 두 진입점 중 한쪽은 헬퍼를 사용하고 다른 한쪽은 인라인 구성이어서 일관성이 없다. `toHttpDetails()`가 SoT 역할을 하더라도 이를 호출하는 상위 패턴이 불일치하면 미래에 응답 shape(`error.code`, `details` 포함 여부 등)가 바뀔 때 두 곳을 각기 다른 방식으로 찾아 수정해야 한다. W-6 RESOLUTION이 `toHttpDetails()`를 SoT로 도입했지만 컨트롤러 측 호출 패턴은 여전히 수동 인라인이다.
  - 제안: 공유 유틸(`workflow-errors.ts` 또는 별도 shared 파일)에 `formValidationToBadRequest(err: FormValidationError): BadRequestException` 같은 함수를 추출하거나, `executions.controller.ts`에서도 `badRequest()` 헬퍼(또는 동등한 것)를 사용하도록 통일한다. 이렇게 하면 두 진입점의 변환 방식이 일원화되어 응답 shape 변경 시 단일 지점만 수정하면 된다.

- **[INFO]** `workflow-errors.ts` — `ValidationDetail` 인터페이스와 `FormValidationError` 클래스 선언 순서 및 가독성
  - 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` lines 228–278
  - 상세: 현재 파일은 `ValidationDetail` JSDoc + interface(228–238) → `FormValidationError` JSDoc + class(240–278) 순으로 올바르게 정렬되어 있다 (scope.md 및 convention_compliance.md 리뷰의 JSDoc 순서 불일치는 diff 기반 분석 오류로, 실제 파일은 정상 순서다). 의존 관계 순서("detail item 타입 먼저, 그것을 사용하는 error 클래스 나중")도 자연스럽다. 단, `FormValidationError` 클래스 JSDoc이 4개 단락에 걸쳐 상세한 운영 정보를 담고 있어 클래스 자체의 핵심 계약과 운영 세부 사항이 혼재되어 있다. 독자가 첫눈에 클래스 목적을 파악하기 위해 전체 JSDoc을 읽어야 한다.
  - 제안: JSDoc 첫 줄을 간결한 한 문장 요약으로 유지하고 상세 내용을 `@remarks`나 하위 단락으로 분리하면 가독성이 향상된다. 현재 규모에서 기능 영향은 없으므로 선택 사항.

- **[INFO]** `assertFormSubmissionValid` 메서드 — 두 개의 순차 DB 조회가 한 메서드 내에 있어 데이터 수집과 검증의 책임이 혼재
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `assertFormSubmissionValid` 메서드
  - 상세: 메서드가 (1) nodeExecution 조회, (2) node 조회, (3) fields 추출, (4) 검증 실행의 4단계를 한 메서드에 담는다. 길이(약 20줄)와 JSDoc은 적절하지만, nodeExecution/node 조회는 "데이터 수집"이고 `validateFormSubmission` 호출은 "검증"으로 두 가지 관심사가 혼재한다. 성능 리뷰(W-11 BACKLOG)에서 이미 이 구조를 지적했으며, 미래에 시그니처를 `assertFormSubmissionValid(nodeId, formData)` 로 변경하거나 JOIN 쿼리로 통합할 때 메서드 전체를 재작성해야 한다.
  - 제안: W-11 BACKLOG 처리 시 자연스럽게 리팩터 가능. 단기적으로 현재 구조 유지 수용 가능.

- **[INFO]** `badRequest` 함수(`interaction.service.ts`) — 조건부 spread 패턴이 의도 불분명
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` — `badRequest` 함수
  - 상세: `{ code, message, ...(details ? { details } : {}) }` 패턴은 `details`가 없으면 응답에 `details` 키 자체를 포함하지 않기 위한 조건부 spread다. 의도 자체는 타당하나, 이 패턴을 처음 보는 독자는 "왜 `details: undefined` 대신 스프레드를 쓰는가?" 를 즉시 이해하기 어렵다.
  - 제안: 짧은 인라인 주석(`// details 없는 경우 키 자체를 응답에 포함하지 않음`) 추가 또는 `if (details) { (body as Record<string, unknown>).details = details; }` 명시적 분기 패턴으로 교체하여 가독성을 높인다.

- **[INFO]** `ErrorCode` 항목 신규 추가 주석 — 기존 항목과 스타일 일관성 저하
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts` — `VALIDATION_ERROR`, `INVALID_FIELD` 항목
  - 상세: 기존 `ErrorCode` 객체의 다른 항목들은 주석 없이 `KEY: 'VALUE',` 형태다. 신규 두 항목은 각각 여러 줄 주석을 달아 스타일 일관성이 깨진다. 주석 내용 자체(spec 참조, 연관 관계 기술)는 유용하지만 객체 내에서 이 두 항목만 지나치게 길어 시각적 이질감이 있다.
  - 제안: 주석을 한 줄 요약으로 축약한다. 예: `// 시스템 전역 공용 — spec/conventions/error-codes.md §1` (VALIDATION_ERROR), `// VALIDATION_ERROR 응답 details[].code` (INVALID_FIELD).

- **[INFO]** `coerceFormValue` — 배열 처리 내 인라인 삼항 연산자와 함수 체인 중첩
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `coerceFormValue` 정적 메서드
  - 상세: `v.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(',')` 는 한 체인에 삼항 조건과 두 함수 호출을 담는다. JSDoc 주석이 보완하고 있고 길이도 과도하지 않지만, 이 `map` 콜백을 별도 함수(`coerceArrayElement`)로 추출하면 단독 테스트가 가능해지고 가독성이 향상된다.
  - 제안: W-4 BACKLOG에서 `coerceFormValue`를 독립 유틸로 추출할 때 함께 분리하면 자연스럽다. 현 단계에서는 수용 가능.

- **[INFO]** `coerceFormSubmission` / `coerceFormValue` 네이밍 — 코드베이스 기존 동사 계열과 미미한 이질감
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `coerceFormSubmission`, `coerceFormValue` 정적 메서드
  - 상세: 이 서비스 파일의 다른 메서드들(`resolve*`, `assert*`, `build*`, `extract*`)에 비해 `coerce`는 다소 이질적인 동사다. `normalizeFormData` / `normalizeFormValue` 등 더 일반적인 동사가 의도(타입 정규화)를 더 직관적으로 전달할 수 있다. 단, `coerce`가 이미 테스트 파일 describe 블록, JSDoc, RESOLUTION.md 등 다수 위치에 고착되어 있어 이름 변경 비용이 크다.
  - 제안: 현 단계에서는 이름 변경 불필요. 향후 독립 유틸로 추출(W-4)할 때 rename을 함께 고려.

## 요약

이번 변경(`FormValidationError` 신설, `assertFormSubmissionValid` + `coerceFormSubmission/Value` 추가, 두 진입점 에러 매핑)의 유지보수성은 전반적으로 양호하다. 메서드 길이와 JSDoc 커버리지가 적절하고, `toHttpDetails()` SoT 도입으로 응답 shape 이원화 위험을 방지한 설계가 명확하다. 주요 유지보수성 우려는 두 진입점(`executions.controller.ts` vs `interaction.service.ts`)의 `FormValidationError → BadRequestException` 변환 패턴이 서로 다르다는 점이다(WARNING) — 한쪽은 `badRequest()` 헬퍼 경유, 다른 한쪽은 인라인 구성 — 응답 shape이 바뀔 때 두 곳을 각기 다른 방식으로 수정해야 하는 유지보수 부담이 남는다. 나머지 항목(조건부 spread 가독성, `ErrorCode` 주석 스타일 불일치, `coerce` 네이밍, 배열 콜백 분리)은 기능적 위험 없이 스타일·일관성 수준의 INFO 사항으로, 중복 코드나 과도한 함수 복잡도는 발견되지 않는다.

## 위험도

LOW

STATUS=success ISSUES=1
