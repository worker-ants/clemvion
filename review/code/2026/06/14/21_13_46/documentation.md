# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] FormValidationError 클래스 레벨 JSDoc — 이중 블록 구조 귀속 오류
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` — `FormValidationError` 클래스 상단
- 상세: diff 상으로 `FormValidationError` 클래스 직전에 두 개의 별도 JSDoc 블록이 연속 작성되어 있다. 첫 번째 블록은 `FormValidationError` 동작(FIRST 오류, client-safe message, EIA/WS surface 경로, 보안 정책)을 설명하고, 두 번째 블록은 `ValidationDetail` 인터페이스를 설명한다. 코드 순서가 "FormValidationError 설명 JSDoc → ValidationDetail 인터페이스 → FormValidationError 클래스" 구조이므로, TS/JSDoc 관례상 첫 번째 JSDoc 이 `ValidationDetail` 인터페이스에 귀속되고 `FormValidationError` 클래스 자체에는 직접 연결된 클래스 레벨 JSDoc 이 없는 상태가 된다.
- 제안: `ValidationDetail` 인터페이스를 `FormValidationError` 설명 JSDoc 앞으로 이동하거나, `FormValidationError` 클래스 설명 JSDoc 을 클래스 선언 바로 위로 이동해 JSDoc 귀속 순서를 정정한다.

### [INFO] ValidationDetail 인터페이스 — `code` 필드 허용값 미문서화
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` — `ValidationDetail` 인터페이스
- 상세: `ValidationDetail.code` 필드가 `string` 으로만 선언되어 있고 실제 허용값(`'INVALID_FIELD'`)이 타입 수준 또는 JSDoc 으로 문서화되지 않았다. 현재 단계에서 `'INVALID_FIELD'` 이외의 코드가 사용되지 않으므로 타입을 리터럴 또는 별도 유니온으로 좁히거나 JSDoc 에 허용값을 명시하면 사용자가 인터페이스를 확장할 때 혼선을 줄일 수 있다.
- 제안: `code: 'INVALID_FIELD' | string` 또는 JSDoc `/** 현재 'INVALID_FIELD' 고정 */` 형태로 허용값을 명시한다.

### [INFO] `assertFormSubmissionValid` JSDoc — "Planned" 계획 추적 메모 코드 주석에 잔존
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `assertFormSubmissionValid` JSDoc
- 상세: JSDoc 에 "file MIME/size/count 검증은 Planned — 본 단계 미적용" 이라는 메모가 포함되어 있다. 향후 file 검증이 구현되었을 때 JSDoc 이 갱신되지 않으면 구현과 맞지 않는 오래된 주석이 될 위험이 있다. 계획 추적은 `plan/in-progress/spec-sync-form-gaps.md` 에 이미 반영되어 있으므로 코드 주석에서는 구현 범위 설명에 집중하는 것이 혼선을 줄인다.
- 제안: "Planned" 메모를 "file 검증(MIME/크기/개수)은 이 메서드 미포함" 등 범위 설명으로 한정하거나, 계획 ID/링크를 명시해 추적 가능하게 한다.

### [INFO] CHANGELOG 항목 — 내부 파일 경로 직접 참조
- 위치: `CHANGELOG.md` — 신규 `## Unreleased — EIA submit_form 서버 측 field 검증` 섹션, 항목 2
- 상세: CHANGELOG 항목 2번에 `(codebase/backend/src/nodes/core/error-codes.ts)` 파일 경로가 직접 언급된다. CHANGELOG 는 내부 파일 경로보다는 기능·계약 변경을 서술하는 것이 관례다. 경로 변경·리팩터 시 CHANGELOG 도 갱신해야 하는 불필요한 결합이 생긴다.
- 제안: 파일 경로 참조를 제거하고 "에러 코드 열거형(`ErrorCode`)에 `VALIDATION_ERROR` 추가 — 단일 SoT 관리" 수준의 기능 중심 서술로 변경한다.

### [INFO] `interaction.controller.ts` Swagger 설명 — `executions.controller.ts` 대비 상세 shape 미기재
- 위치: `codebase/backend/src/modules/external-interaction/interaction.controller.ts` — `@ApiBadRequestResponse`
- 상세: `VALIDATION_FAILED` → `VALIDATION_ERROR` 에러코드명 수정은 완료됐으나, `details[{field, message, code:'INVALID_FIELD'}]` 등 응답 shape 의 구체적 필드 구조가 설명 문자열에 없다. `executions.controller.ts` 의 `@ApiBadRequestResponse` 설명에는 해당 shape 가 명시되어 있어 두 컨트롤러 간 문서 수준 차이가 존재한다.
- 제안: `interaction.controller.ts` 의 Swagger 설명도 `details[{field, message, code:'INVALID_FIELD'}]` 및 "FIRST 오류만" 정책을 추가해 `executions.controller.ts` 수준으로 맞춘다.

### [INFO] `coerceFormValue` JSDoc — 내부 리뷰 아이템 번호 `(I-12)` 잔존
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `coerceFormValue` JSDoc
- 상세: `(I-12)` 라는 내부 리뷰 아이템 번호 참조가 코드 JSDoc 에 직접 포함되어 있다. 이 표기는 코드 리뷰 내부 추적용이므로 최종 코드에 노출되면 외부 기여자 또는 향후 유지보수자에게 의미 없는 노이즈가 된다.
- 제안: `(I-12)` 레퍼런스를 JSDoc 에서 제거하고 변환 규칙 설명만 유지한다.

### [INFO] `external-interaction.e2e-spec.ts` 커버리지 주석 및 nodeId 역할 주석 — 적절히 추가됨
- 위치: `codebase/backend/test/external-interaction.e2e-spec.ts`
- 상세: diff 상단 커버리지 설명(`G. submit_form field 검증 실패...`)이 추가되어 테스트 파일의 의도 문서화가 충실하다. e2e 케이스 G 내부의 nodeId body 역할 주석도 추가되었다.
- 제안: 추가 개선 불필요.

### [INFO] `plan/in-progress/spec-sync-form-gaps.md` — 진척 메모 및 체크박스 정확히 반영됨
- 위치: `plan/in-progress/spec-sync-form-gaps.md`
- 상세: eia-form-validation PR 진척 메모가 추가되고, §4 step5 / §6.2 field-level 검증 항목이 `[x]` 로 완료 처리되었으며, file 검증 항목이 별도 미완료 항목으로 분리되어 계획 문서와 코드 변경이 일치한다.
- 제안: 추가 개선 불필요.

## 요약

이번 변경은 전반적으로 문서화 수준이 양호하다. `FormValidationError`, `assertFormSubmissionValid`, `coerceFormSubmission`, `coerceFormValue` 모두 JSDoc 이 작성되어 있고 CHANGELOG 및 plan 문서도 업데이트됐으며 Swagger 데코레이터도 추가됐다. 다만 두 개의 JSDoc 블록이 연속 작성되어 `FormValidationError` 클래스 레벨 문서가 실제로는 `ValidationDetail` 인터페이스에 귀속되는 구조적 오류, 두 컨트롤러 간 Swagger 설명 수준 불일치, 내부 리뷰 아이템 번호 `(I-12)` 가 코드 JSDoc 에 잔존하는 점, `ValidationDetail.code` 허용값 미문서화 등 개선 여지가 있다. 모든 발견사항은 정보성(INFO) 수준이며 기능·계약·보안에 영향을 주지 않는다.

## 위험도

LOW
