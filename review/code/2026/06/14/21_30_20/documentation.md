# 문서화(Documentation) 리뷰

## 발견사항

### **[WARNING]** `error-codes.ts` — `VALIDATION_ERROR` JSDoc이 "form 전용"으로 한정되어 기존 광범위 사용과 불일치
- 위치: `codebase/backend/src/nodes/core/error-codes.ts` lines 94–98
- 상세: `VALIDATION_ERROR`의 인라인 주석은 "API 공통 400 검증 실패 코드"라고 명시하나, naming_collision 리뷰에서 확인된 바와 같이 `validation.pipe.ts:36`, `auth.service.ts`, `triggers.service.ts` 등 광범위한 위치에서 동일 문자열이 직접 리터럴로 사용 중이다. 주석 내 "API 공통 400" 범주 표기는 의도에 부합하나, `spec/conventions/error-codes.md §1`의 "시스템 전역 공용 분류" 근거가 명시되지 않아 후속 개발자가 prefix 누락을 규약 위반으로 오탐할 가능성이 있다.
- 제안: 인라인 주석에 `// 시스템 전역 공용 코드 — prefix 없음 (spec/conventions/error-codes.md §1)` 한 줄 추가해 의도적 분류임을 명확히 한다.

### **[WARNING]** `spec/5-system/14-external-interaction-api.md §5.1` — Planned 주석이 구현 완료 시점과 불일치 (오래된 주석)
- 위치: `spec/5-system/14-external-interaction-api.md §5.1` `VALIDATION_ERROR` 항목
- 상세: EIA spec §5.1의 VALIDATION_ERROR 항목에 "(현재 form field-level 검증 자체는 일부 Planned — `interaction.service` 는 `data` 객체 형식만 확인)"이라는 괄호 설명이 잔존한다. 이번 PR에서 `interaction.service`가 `continueExecution` → `assertFormSubmissionValid` 경로를 통해 필수/type/length/선택지 검증을 완료했으므로 해당 주석은 outdated 상태다. API 문서를 참조하는 개발자가 검증이 아직 미구현인 것으로 오해할 수 있다.
- 제안: EIA spec §5.1 `VALIDATION_ERROR` 행의 Planned 주석을 "field-level 검증(필수/type/length/선택지)은 구현 완료; `type: 'file'` MIME/크기/개수 검증만 Planned"로 업데이트한다. (spec 수정은 project-planner 권한 작업)

### **[WARNING]** `spec/conventions/chat-channel-adapter.md` 및 `spec/4-nodes/7-trigger/providers/slack.md` — `VALIDATION_FAILED` 구 코드명 잔존 (API 문서 불일치)
- 위치: `spec/conventions/chat-channel-adapter.md §4.1·§4.2`, `spec/4-nodes/7-trigger/providers/slack.md` line 116
- 상세: 이 spec 문서들이 form 제출 검증 실패 응답 코드를 `VALIDATION_FAILED`로 기술하고 있으나, EIA spec(`spec/5-system/14-external-interaction-api.md §5.1 EIA-IN-10`)과 구현 모두 `VALIDATION_ERROR`를 사용한다. 채널 어댑터 구현자가 이 spec을 SoT로 삼으면 잘못된 에러 코드를 파싱할 수 있어 분기 로직 오류로 이어질 수 있다.
- 제안: 해당 spec 문서들의 `VALIDATION_FAILED`를 `VALIDATION_ERROR(+details[])`로 정정한다. (project-planner 권한 작업)

### **[INFO]** `assertFormSubmissionValid` JSDoc — `min/max/pattern` 미구현이 명시되지 않음
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` lines 4314–4321 (assertFormSubmissionValid JSDoc)
- 상세: JSDoc에 "file MIME/size/count 검증은 Planned — 본 단계 미적용"이 명시되어 있어 의도적 미구현을 잘 문서화했다. 그러나 requirement 리뷰에서 [WARNING]으로 지적된 `validation.min`/`max`/`pattern` 미구현(spec §6.2 범위)이 JSDoc에 언급되어 있지 않아, 숫자 범위·정규식 검증이 이미 구현된 것으로 오해할 수 있다.
- 제안: JSDoc에 "validation.min/max(숫자 범위) · pattern(정규식) 검증은 미적용 — extractFormFields·FormModalField 수준에서 미지원"을 추가해 현재 구현 범위를 명확히 한다.

### **[INFO]** `idempotency.interceptor.ts` 주석에 구 코드명 `VALIDATION_FAILED` 3건 잔존
- 위치: `codebase/backend/src/modules/idempotency/idempotency.interceptor.ts` lines 27, 39, 130
- 상세: 코드 내 주석에 `VALIDATION_FAILED`가 3건 잔존한다. 실제 wire-format 코드는 `VALIDATION_ERROR`이므로 동작 충돌은 없으나, 주석 내 구 명칭이 코드 독자에게 혼동을 유발한다.
- 제안: 해당 주석 3건을 `VALIDATION_ERROR`로 통일한다.

### **[INFO]** `spec/5-system/6-websocket-protocol.md §4.2` — `VALIDATION_ERROR` 에러 코드 표 미등재 (API 문서 누락)
- 위치: `spec/5-system/6-websocket-protocol.md §4.2` WS 에러 코드 표
- 상세: WS spec §4.2의 `submit_form` ack 에러 코드 목록에 `VALIDATION_ERROR`가 없다. 구현은 `FormValidationError`를 WS ack에 `errorCode='VALIDATION_ERROR'`로 표면하므로 spec 문서와 실제 동작이 불일치한다. WS 클라이언트 개발자가 이 코드를 unknown으로 처리하거나 `EXECUTION_INTERNAL_ERROR`로 오해할 수 있다.
- 제안: WS spec §4.2 에러 코드 표에 `VALIDATION_ERROR` 항목을 추가하고, `spec/5-system/3-error-handling.md §1.5` WS 코드 공용 카탈로그에도 동일 행을 추가한다. (project-planner 권한 작업)

### **[INFO]** `workflow-errors.ts` `ValidationDetail.code` — JSDoc과 타입 범위 미세 불일치
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` lines 228–238
- 상세: `ValidationDetail` 인터페이스의 `code` 필드는 `string`으로 선언되어 있으나, JSDoc은 "현재 단계 `'INVALID_FIELD'` 단일 값"이라고 설명한다. 타입이 더 넓게 선언되어 있어 JSDoc 설명과 실제 허용 범위 사이에 미세한 불일치가 있다. 또한 `validation.pipe.ts`에 동명의 module-private `interface ValidationDetail { code: 'INVALID_FIELD' }`(리터럴 타입)이 이미 존재하는데, 두 타입의 `code` 범위가 달라 향후 통합 시 혼선이 발생할 수 있다.
- 제안: JSDoc에 `code` 필드의 현재 값과 허용 범위를 명시하거나, 단일 exported 타입으로 통합 후 양쪽에서 import 하는 방안을 고려한다.

### **[INFO]** CHANGELOG.md — 변경 이력 기록 적절
- 위치: `CHANGELOG.md` lines 3–21
- 상세: "Unreleased — EIA submit_form 서버 측 field 검증" 섹션이 추가되어 응답 shape, first-error 정책, waiting 상태 유지, WS ack 매핑까지 기술하고 있다. 주요 변경 사항의 CHANGELOG 문서화가 충실하게 이루어졌다.
- 제안: 없음.

### **[INFO]** `spec/4-nodes/6-presentation/4-form.md` — `## Rationale` 섹션 부재
- 위치: `spec/4-nodes/6-presentation/4-form.md` 전체 문서
- 상세: spec 문서 3섹션 구성(Overview / 본문 / Rationale) 규약에 따르면 `## Rationale` 섹션이 있어야 한다. 현재 `(Planned)` 표기와 `⚠` 주석으로 설계 이유를 인라인에 흩어두고 있어 독자가 찾기 어렵다. spec이 `status: partial`이므로 즉각 차단 불필요.
- 제안: spec 완성 시점에 `## Rationale` 섹션 추가 — metadata-only file 전송 결정, MIME 기본값 목록 선택 이유, `preset` 미구현 결정 등 포함.

## 요약

이번 변경의 문서화 품질은 전반적으로 양호하다. `FormValidationError`와 `ValidationDetail`에 JSDoc이 충실하게 작성되었고, `coerceFormSubmission`/`coerceFormValue`의 변환 규칙이 JSDoc에 명확히 기술되어 있으며, CHANGELOG에 기능 변경이 적절히 기록되어 있다. 그러나 세 가지 구조적 문서화 격차가 존재한다: (1) `spec/conventions/chat-channel-adapter.md`·`slack.md`의 에러 코드가 `VALIDATION_FAILED`로 잘못 기술되어 구현(`VALIDATION_ERROR`)과 불일치하고, (2) `spec/5-system/6-websocket-protocol.md §4.2` WS 에러 코드 표에 `VALIDATION_ERROR`가 누락되어 WS 클라이언트 개발자에게 혼동을 줄 수 있으며, (3) `spec/5-system/14-external-interaction-api.md §5.1`의 Planned 주석이 구현 완료 후에도 갱신되지 않은 채로 남아 있다. 코드 수준에서는 `assertFormSubmissionValid` JSDoc에 `min/max/pattern` 미구현이 명시되지 않은 점과 `idempotency.interceptor.ts` 주석의 구 코드명 잔존이 보완이 필요한 항목이다. 세 개의 WARNING 중 두 개는 spec 문서 정정이 필요해 project-planner 권한 작업이다.

## 위험도

MEDIUM

STATUS=success ISSUES=3
