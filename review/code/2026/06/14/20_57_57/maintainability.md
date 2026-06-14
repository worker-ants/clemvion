# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `assertFormSubmissionValid` 내 Early-return guard 체인 가독성
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `assertFormSubmissionValid`
- 상세: `if (!nodeExec) return`, `if (!node) return`, `if (fields.length === 0) return` 의 3단계 guard 패턴은 의도가 명확하고 중첩 깊이를 낮게 유지한다. 함수 길이(~20줄)도 적절하다.
- 제안: 현행 유지.

### [INFO] `coerceFormValue` — 배열 분기 내 인라인 중첩 삼항 가독성 경계
- 위치: `execution-engine.service.ts` `coerceFormValue` 배열 분기
- 상세: `v.length === 0 ? '' : v.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(',')` 는 한 표현식에 중첩 삼항이 포함된다. JSDoc 이 각 케이스를 설명하므로 즉각적 혼란은 없으나, 향후 배열 처리 규칙이 복잡해지면 별도 헬퍼 추출을 권장한다.
- 제안: 현행 유지; 추가 케이스 발생 시 `coerceArrayValue` 헬퍼 분리 고려.

### [INFO] `coerceFormSubmission` — 변수명 `out` 축약
- 위치: `execution-engine.service.ts` `coerceFormSubmission`
- 상세: 반환 값 누적 변수 이름이 `out`으로 되어 있다. `result` 또는 `coerced` 같은 이름이 의도를 더 명시적으로 전달한다. 함수 길이가 짧아 맥락 추적 부담이 없어 LOW 우선순위다.
- 제안: `result` 또는 `coerced`로 변경 고려.

### [WARNING] `ValidationDetail` 타입 정의 중복
- 위치: `interaction.service.ts` (로컬 `ValidationDetail` 인터페이스) vs `workflow-errors.ts` `toHttpDetails()` 반환 타입 인라인 정의
- 상세: `{ field: string; message: string; code: string }` 구조가 두 파일에 각각 선언되어 있다. 현재는 동일하게 유지되고 있으나, 향후 한 쪽만 변경될 경우 타입 불일치가 발생할 수 있다. 이전 리뷰 사이클(W-6/W-7)에서 `toHttpDetails()`가 도입되어 런타임 중복은 제거되었으나 타입 정의 자체는 두 곳에 잔존한다.
- 제안: `ValidationDetail`을 `workflow-errors.ts`에서 export 하고 `interaction.service.ts`에서 `import { ValidationDetail }` 로 참조하여 타입 정의 단일 SoT 확보.

### [INFO] `'INVALID_FIELD'` 리터럴 미통합
- 위치: `workflow-errors.ts` `toHttpDetails()` 내 `code: 'INVALID_FIELD'`
- 상세: `VALIDATION_ERROR`는 `ErrorCode` enum 으로 통일되었으나 `INVALID_FIELD`는 아직 enum 에 없고 `toHttpDetails()` 내 하드코딩 리터럴로 남아 있다. 현재 단일 사용처이므로 즉각적 위험은 낮으나, 다른 진입점에서 재사용할 경우 누락 위험이 생긴다.
- 제안: `ErrorCode.INVALID_FIELD = 'INVALID_FIELD'` 추가 또는 `FormValidationError` 내 상수로 선언.

### [INFO] e2e 테스트 내 SQL INSERT 쿼리 인라인 반복
- 위치: `codebase/backend/test/external-interaction.e2e-spec.ts` 케이스 G
- 상세: `db.query` 인자로 직접 작성된 멀티라인 INSERT 쿼리가 node/execution/node_execution 테이블에 걸쳐 반복된다. `createTriggerWithInteraction` 헬퍼 패턴이 이미 존재하므로 form 노드+execution+node_execution 세트를 생성하는 헬퍼로 추출하면 향후 유사 케이스의 설정 중복을 줄일 수 있다.
- 제안: INFO 수준. 케이스가 1개인 현 시점은 인라인 유지 허용; 추가 케이스 발생 시 헬퍼 추출.

### [INFO] `setupFormNodeMocks` mock 직접 대입 방식의 isolation 주의
- 위치: `execution-engine.service.spec.ts` `assertFormSubmissionValid / coerceFormValue (W-1)` describe 블록
- 상세: `setupFormNodeMocks`가 `mockNodeExecutionRepo.findOne = jest.fn().mockResolvedValueOnce(...)` 형태로 mock 프로퍼티를 직접 교체한다. 각 `it` 블록이 독립 실행되므로 현재는 문제없으나, 병렬 실행 환경이나 공유 mock 객체의 부작용 추적이 어려울 수 있다.
- 제안: 현행 유지; 향후 테스트 추가 시 `beforeEach` 기반 초기화 패턴 고려.

## 요약

이번 변경은 `submit_form` 서버 측 field 검증 기능(`assertFormSubmissionValid`, `coerceFormSubmission`, `coerceFormValue`, `FormValidationError`)을 추가하고 두 HTTP 진입점(EIA REST, WS ack)에 오류 매핑을 일관되게 적용했다. 이전 리뷰 사이클(W-5~W-7)에서 지적된 ErrorCode enum 하드코딩, 중복 변환 로직, details 타입 unknown 이 모두 수정되어 코드베이스 패턴 일관성이 향상되었다. 주요 잔여 유지보수 리스크는 `ValidationDetail` 타입 정의가 `workflow-errors.ts`와 `interaction.service.ts` 에 중복 선언된 점(WARNING)으로, 런타임 동작에는 영향이 없으나 타입 단일 SoT 원칙을 위반한다. `'INVALID_FIELD'` 리터럴의 enum 미통합은 INFO 수준이다. `coerceFormValue` JSDoc 확장과 `FormValidationError.toHttpDetails()` 도입으로 가독성과 책임 집중도는 이전 상태 대비 명확히 개선되었다.

## 위험도

LOW
