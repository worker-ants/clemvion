### 발견사항

- **[INFO]** CHANGELOG 업데이트 충실 — 신규 기능 적절히 기록됨
  - 위치: `CHANGELOG.md` (파일 1, lines 34–53)
  - 상세: `submit_form` 서버 측 field 검증 추가와 `VALIDATION_ERROR` 에러코드 도입이 Unreleased 섹션에 상세히 기록됨. 응답 shape JSON 예시, first-error 정책, waiting 상태 유지 동작, WS ack 매핑까지 외부 통합자에게 필요한 정보를 포함. 이전 리뷰 I-14 권고사항이 커밋 3a409092에서 이미 반영됨.
  - 제안: 현행 유지.

- **[INFO]** `FormValidationError` 클래스 JSDoc 충실
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/eia-form-validation-0f0d83/codebase/backend/src/modules/execution-engine/workflow-errors.ts` (파일 4)
  - 상세: spec 참조(form §4·§6.2, EIA §5.1), FIRST-error 정책, HTTP/WS 응답 shape, 보안 고려사항(client-safe 메시지, field 값 미포함), `waiting_for_input` 유지 동작 모두 명시됨.
  - 제안: 현행 유지.

- **[INFO]** `assertFormSubmissionValid` JSDoc 충실
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (파일 3, lines 286–292)
  - 상세: spec 참조, `FormValidationError` 링크, "file MIME/size/count 검증은 Planned" 의도적 scope-out 명시, 방어적 통과 동작 설명 모두 포함.
  - 제안: 현행 유지.

- **[INFO]** `coerceFormValue` JSDoc — 이전 리뷰 I-12 반영 완료
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (파일 3, lines 332–342)
  - 상세: 커밋 3a409092에서 각 타입 분기(null/undefined → '', string, number/boolean, Array, object) 변환 규칙이 JSDoc에 추가됨. 배열 콤마 join의 의미(multi-select·file 메타)까지 명시.
  - 제안: 현행 유지.

- **[INFO]** `coerceFormSubmission` JSDoc 충실
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (파일 3, lines 315–320)
  - 상세: 입력 타입과 출력 타입(Record<string,string>), 각 변환 케이스 설명 포함.
  - 제안: 현행 유지.

- **[INFO]** `dispatchContinuation` JSDoc — 이전 리뷰 W-9 반영 완료
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` (파일 9, lines 672–675)
  - 상세: `FormValidationError → 400 VALIDATION_ERROR + details[{field,message,code:'INVALID_FIELD'}]`, execution waiting 유지, FIRST 오류 정책, spec 참조가 기존 JSDoc 블록에 추가됨.
  - 제안: 현행 유지.

- **[INFO]** `@ApiBadRequestResponse` 데코레이터 — 이전 리뷰 W-10 반영 완료
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts` (파일 6, lines 534–537)
  - 상세: `continueExecution` 엔드포인트에 `@ApiBadRequestResponse` 추가. description에 VALIDATION_ERROR 코드, details 구조, first-error 정책 명시.
  - 제안: 현행 유지.

- **[INFO]** `interaction.controller.ts` `@ApiBadRequestResponse` description 정확성 업데이트
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.controller.ts` (파일 7)
  - 상세: `VALIDATION_FAILED` → `VALIDATION_ERROR`로 올바르게 수정. 응답에 `details[]` 포함됨을 명시.
  - 제안: 현행 유지.

- **[INFO]** `ErrorCode` enum 인라인 주석
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts` (파일 11, lines 793–796)
  - 상세: `VALIDATION_ERROR` 추가 시 spec 경로·용도·`FormValidationError.code` 와의 일치 요건을 주석으로 명시. 다른 에러코드 항목과 동일한 수준의 설명.
  - 제안: 현행 유지.

- **[INFO]** e2e describe 블록 커버리지 목록 — 이전 리뷰 I-13 반영 완료
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts` (파일 12, lines 819–820)
  - 상세: 케이스 G (submit_form field 검증 실패 → 400 VALIDATION_ERROR) 항목이 describe 블록 커버리지 주석에 추가됨. spec 참조 포함.
  - 제안: 현행 유지.

- **[INFO]** e2e 케이스 G nodeId 역할 주석 — 이전 리뷰 I-16 반영 완료
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts` (파일 12, lines 864–866)
  - 상세: "nodeId body는 assertNodeId 유무 검사만 — 실제 field lookup은 node_execution row의 nodeId가 결정한다" 의도가 주석으로 명시됨. 동작 이해 없이 테스트를 수정할 경우 발생할 오해 예방.
  - 제안: 현행 유지.

- **[INFO]** 테스트 파일 내 인라인 설명 주석 충실
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (파일 2, lines 85–88, 96–98, 109–116, 195–202)
  - 상세: mock 기본값의 의미(findOneBy → null = form 검증 skip), override 방식, private static 메서드 접근 패턴의 근거, NestJS unit test 표준 패턴 등을 명시. 후발 기여자가 mock 구조를 잘못 이해할 위험을 줄임.
  - 제안: 현행 유지.

- **[WARNING]** `FormValidationError` 클래스 자체의 단위 테스트 파일 JSDoc/주석 부재 — I-15 미해결
  - 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` — 별도 spec 파일 미존재
  - 상세: `FormValidationError.code`, `FormValidationError.field`, `FormValidationError.name`, `FormValidationError.toHttpDetails()` 직접 검증 테스트가 없다. `toHttpDetails()` 메서드의 JSDoc은 반환 타입과 SoT 의도를 잘 설명하지만, 구현이 문서 약속대로 동작하는지 확인하는 테스트가 없으면 오타 regression 시 응답 매핑 전체가 조용히 깨진다. RESOLUTION.md에서 I-15는 조치 기록 없이 INFO 수준에만 머물렀음.
  - 제안: `workflow-errors.spec.ts` 신설 또는 기존 `execution-engine.service.spec.ts`에 2~3줄 추가 — `new FormValidationError('email', 'msg').toHttpDetails()` 반환값과 `code`/`field`/`name` 프로퍼티를 직접 assert.

- **[INFO]** `ValidationDetail` 인터페이스 문서화 미비 (선택적)
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` (파일 9, lines 703–708)
  - 상세: `ValidationDetail` 인터페이스가 모듈 내 파일 하단에 정의됨. JSDoc 없음. `code` 필드가 항상 `'INVALID_FIELD'` 리터럴이라는 사실이 타입에서 표현되지 않음. `badRequest()` 헬퍼 함수에도 JSDoc 없음.
  - 제안: `ValidationDetail.code` 필드에 `// 항상 'INVALID_FIELD' — EIA §5.1` 한 줄 주석 추가 고려(선택).

- **[INFO]** `details[]` first-error 정책 — Swagger description 부분 미명시 (I-9 잔여)
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts` `@ApiBadRequestResponse`, `codebase/backend/src/modules/external-interaction/interaction.controller.ts` `@ApiBadRequestResponse`
  - 상세: CHANGELOG에는 "현재 단계 FIRST 오류만, details 배열 길이 항상 1"이 명시되어 있으나, Swagger 데코레이터 description에는 미반영. 외부 클라이언트가 OpenAPI spec 기반으로 통합할 때 배열 길이 가정이 암묵적으로 남음.
  - 제안: 각 `@ApiBadRequestResponse` description에 "현재 단계 FIRST 오류만 (details 배열 길이 항상 1)" 문구 추가.

### 요약

문서화 품질이 전반적으로 높다. 이전 리뷰 사이클(20_22_14)에서 제기된 문서화 관련 WARNING(W-9, W-10)과 INFO(I-12, I-13, I-14, I-16) 항목이 커밋 3a409092에서 모두 반영되었으며, CHANGELOG·JSDoc·API 데코레이터·테스트 내 인라인 주석이 신규 기능과 일관되게 동기화되어 있다. `FormValidationError` 클래스의 JSDoc과 `coerceFormValue`의 타입 분기 문서가 충실하고, 두 API 진입점 모두 Swagger 데코레이터가 업데이트되었다. 남은 사항은 `FormValidationError` 클래스 직접 단위 테스트 부재(이전 리뷰 I-15, 이번 사이클에서도 미조치 — WARNING)와 Swagger description에서 `details[]` first-error 정책 미명시(I-9 잔여 — INFO)의 두 가지이며, 두 항목 모두 기능 안전성에 영향을 주지 않는다.

### 위험도

LOW
