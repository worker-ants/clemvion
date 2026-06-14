# Cross-Spec 일관성 검토 결과

검토 대상: `spec/4-nodes/6-presentation/4-form.md` §6.2 + 구현 diff (EIA form 검증 — FormValidationError, continueExecution publisher 검증, WS/EIA/executions.controller 매핑)

---

## 발견사항

### 1. **[WARNING]** WS 에러 코드 표(§4.2)에 `VALIDATION_ERROR` 미등재 — `FormValidationError` 신규 경로 반영 필요

- **target 위치**: 구현 diff `websocket.gateway.spec.ts` W-12 테스트 — `FormValidationError` → `errorCode: 'VALIDATION_ERROR'` WS ack 경로 추가
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md` §4.2 "버튼 클릭 에러 코드" 공통 표 (line 310–317)
- **상세**: WS spec §4.2 의 continuation ack 에러 코드 표에는 `INVALID_EXECUTION_STATE` / `INTERACTION_TIMEOUT` / `EXECUTION_MESSAGE_TOO_LONG` / `EXECUTION_INTERNAL_ERROR` / `RESUME_*` 만 등재되어 있다. 이번 구현에서 `FormValidationError` (code=`VALIDATION_ERROR`) 가 `execution.submit_form` ack 의 `errorCode` 에 표면되는 신규 경로가 추가됐으나, WS spec 에러 코드 표에는 이 코드가 없다. 실행 엔진 §7.5.2 의 typed `ExecutionError` 설명문 "선례" 목록(`InvalidExecutionStateError`·`RetryLastTurnError`·`ExecutionTimeLimitError`)에도 `FormValidationError` 가 누락되어 있다.
- **제안**: `spec/5-system/6-websocket-protocol.md` §4.2 에러 코드 표에 `VALIDATION_ERROR` 행 추가 (`submit_form` 의 field 검증 실패, 재제출 가능). `spec/5-system/4-execution-engine.md` §7.5.2 의 "선례" 목록에 `FormValidationError` 추가. 동시에 EIA R13 매핑 표에 `FormValidationError | VALIDATION_ERROR | 400 VALIDATION_ERROR` 행 추가.

---

### 2. **[WARNING]** EIA §R13 매핑 표에 `FormValidationError` 행 누락

- **target 위치**: 구현 diff `interaction.service.ts` — `FormValidationError` → `400 VALIDATION_ERROR + details[]` EIA 진입점 매핑
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md` §R13 (line 998–1003) typed error ↔ WS ack ↔ EIA REST 3단 매핑 표
- **상세**: §R13 표는 현재 2행만 있다 (`InvalidExecutionStateError` / `MessageTooLongError`). 이번 구현으로 EIA `submit_form` 경로에서 `FormValidationError` → `400 VALIDATION_ERROR + details[]` 신규 매핑이 추가됐으나, §R13 표는 갱신되지 않았다. §R13 이 "두 진입점 에러 코드 동치 관계를 cross-ref 로 고정한다"고 명시하므로 신규 typed error 가 표에 빠지면 규약의 단일 진실(SoT) 역할이 깨진다. 직접 작동 불가 충돌은 아니나 관리 위험.
- **제안**: `spec/5-system/14-external-interaction-api.md` §R13 표에 `FormValidationError | VALIDATION_ERROR (WS) | 400 VALIDATION_ERROR (EIA REST)` 행 추가. §5.1 에러 표 주석 `(현재 form field-level 검증 자체는 일부 Planned — interaction.service 는 data 객체 형식만 확인)` 은 구현 완료에 따라 제거 또는 갱신 필요.

---

### 3. **[INFO]** EIA §5.1 에러 표 주석 "일부 Planned" 구문이 구현 완료 후 stale

- **target 위치**: 구현 diff `interaction.service.ts` + `execution-engine.service.ts` — 필수·type·length·select/radio 검증 구현 완료
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md` §5.1 에러 표 line 313 주석 `(현재 form field-level 검증 자체는 일부 Planned — interaction.service 는 data 객체 형식만 확인)`
- **상세**: EIA spec 는 검증이 Planned 라고 명시했는데 구현은 이를 완료했다. 직접 모순은 아니며 spec 문구의 구현 현실 미반영.
- **제안**: `spec/5-system/14-external-interaction-api.md` §5.1 해당 주석을 "구현 완료 (필수·type(email/number)·minLength/maxLength·select/radio 선택지). file MIME/크기/개수·pattern·min/max 범위 검증은 Planned (plan/in-progress/spec-sync-form-gaps.md)" 로 갱신.

---

### 4. **[INFO]** `error-codes.ts` 신규 `VALIDATION_ERROR` / `INVALID_FIELD` 가 conventions/error-codes.md 와 일치

- **target 위치**: 구현 diff `codebase/backend/src/nodes/core/error-codes.ts`
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/conventions/error-codes.md`, `spec/5-system/3-error-handling.md` §1.3
- **상세**: `VALIDATION_ERROR`(400)는 `3-error-handling.md` §1.3 에 기정의된 시스템 전역 공용 코드이며, `INVALID_FIELD` 는 `details[].code` 슬롯 값으로 동일 spec 에서 쓰인다. `conventions/error-codes.md` 의 "전역 공용 코드" 분류와도 일치. 충돌 없음, 확인 차원 기재.

---

## 요약

이번 EIA form 검증 구현(publisher 측 `assertFormSubmissionValid` + `FormValidationError` + 3-진입점 매핑)은 EIA spec §5.1·§EIA-IN-10·§R8·API 규약 §5.3 의 `VALIDATION_ERROR + details[]` 계약과 정합하며 직접 모순은 없다. 다만 `FormValidationError` 라는 신규 typed `ExecutionError` 서브타입이 WS ack 경로에 추가됐음에도 WS spec §4.2 에러 코드 표와 실행 엔진 spec §7.5.2 의 "선례" 목록에 미등재되어 있고, EIA §R13 매핑 표에도 해당 행이 없다. 이 세 위치는 "typed error ↔ WS errorCode ↔ EIA code 3단 동치 SoT" 역할을 명시적으로 선언하므로, `FormValidationError` 행 누락은 향후 ack builder 수정 시 VALIDATION_ERROR 가 EXECUTION_INTERNAL_ERROR 로 silent regression 될 위험을 지닌다(WARNING). 직접 작동 불가 충돌은 없으며 모두 spec 갱신 누락·stale 수준이므로 위험도는 MEDIUM 이다.

## 위험도

MEDIUM
