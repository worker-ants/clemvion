# Cross-Spec 일관성 검토 결과

## 발견사항

### 1. **[WARNING]** WS §4.2 에러 코드 표에 `VALIDATION_ERROR` 미등재
- target 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` W-12 테스트 (FormValidationError → ack `errorCode: VALIDATION_ERROR`) 및 `execution-engine.service.ts` `assertFormSubmissionValid` 구현
- 충돌 대상: `/Volumes/project/private/clemvion/spec/5-system/6-websocket-protocol.md` §4.2 에러 코드 표 (line 307–316) 및 §7.1 에러 코드 표 (line 877–888)
- 상세: WS spec §4.2 의 `submit_form` 에러 코드 표에는 `INVALID_EXECUTION_STATE` / `EXECUTION_MESSAGE_TOO_LONG` / `EXECUTION_INTERNAL_ERROR` / `RESUME_*` 만 나열되어 있고 `VALIDATION_ERROR` 가 없다. 구현은 `FormValidationError extends ExecutionError` 를 추가했고 `buildContinuationErrorAck` 의 typed path 에 의해 `errorCode='VALIDATION_ERROR'` 가 ack 에 실려 나간다(W-12 테스트 검증). WS spec §4.2 표가 동기화되지 않아 외부 클라이언트(채널 어댑터 등)가 이 코드를 사전에 알 수 없다.
- 제안: `spec/5-system/6-websocket-protocol.md` §4.2 에러 코드 표에 `VALIDATION_ERROR` 행 추가 — "submit_form field 검증 실패. errorCode 평면 필드로 발행. EIA 의 400 VALIDATION_ERROR 와 동일 의미지만 WS 는 ack 평면 필드로 surface (details[] 없음 — ack 는 평면 구조)."

---

### 2. **[WARNING]** `spec/conventions/chat-channel-adapter.md` §4.1·§4.2 에 `VALIDATION_FAILED + fieldErrors` 잔존
- target 위치: 구현 diff — `idempotency.interceptor.ts` / `interaction.controller.ts` / `interaction.service.ts` 에서 `VALIDATION_FAILED` → `VALIDATION_ERROR`, `fieldErrors` → `details[]` 일괄 정정
- 충돌 대상: `/Volumes/project/private/clemvion/spec/conventions/chat-channel-adapter.md` line 428 (`400 VALIDATION_FAILED + fieldErrors`) 및 line 449 (`400 VALIDATION_FAILED + fieldErrors`)
- 상세: `chat-channel-adapter.md §4.1 step 5` 와 `§4.2 step 5` 두 곳 모두 `EIA 400 VALIDATION_FAILED + fieldErrors` 라는 구 에러 코드·구 구조를 참조한다. EIA spec §5.1 은 이미 `400 VALIDATION_ERROR + error.details[]({field, message, code:'INVALID_FIELD'})` 로 정의돼 있고 구현도 동일하게 정렬됐다. 채널 어댑터 구현자가 이 Convention 을 읽으면 잘못된 코드·구조로 처리 로직을 작성할 수 있다.
- 제안: `spec/conventions/chat-channel-adapter.md` §4.1 step 5 와 §4.2 step 5 의 `400 VALIDATION_FAILED + fieldErrors` → `400 VALIDATION_ERROR + error.details[{field, message, code}]` 로 갱신. Slack provider spec `spec/4-nodes/7-trigger/providers/slack.md` line 116 의 `EIA 400 VALIDATION_FAILED` 도 동일 갱신.

---

### 3. **[INFO]** `spec/4-nodes/7-trigger/providers/slack.md` line 116 에 `VALIDATION_FAILED` 잔존
- target 위치: (동일 구현 변경 대상)
- 충돌 대상: `/Volumes/project/private/clemvion/spec/4-nodes/7-trigger/providers/slack.md` line 116
- 상세: `검증 실패 재표시: server-side 검증 실패 (EIA 400 VALIDATION_FAILED)` 라고 명시되어 있어 위 §2 발견사항과 동일 범주의 명칭 불일치. 기능적 모순은 아니나(server 응답의 field/message 구조를 동일하게 사용할 수 있음) Convention 문서와 provider 문서 간 일관성이 깨진다.
- 제안: `VALIDATION_FAILED` → `VALIDATION_ERROR`, 구조 설명 (`details[0].field`, `details[0].message`) 로 갱신.

---

### 4. **[INFO]** `spec/4-nodes/1-logic/9-foreach.md` 의 `VALIDATION_FAILED` 는 별도 도메인 — 충돌 없음
- target 위치: — (참고 사항)
- 충돌 대상: `/Volumes/project/private/clemvion/spec/4-nodes/1-logic/9-foreach.md` line 167
- 상세: ForEach 노드의 `skipped[].error.code: 'VALIDATION_FAILED'` 는 ForEach item-level 내부 에러 코드이며, 본 구현이 추가한 `VALIDATION_ERROR` (form submit field 검증) 와 네임스페이스·레이어가 다르다. 두 코드가 동일 의미로 충돌하지는 않는다.
- 제안: 갱신 불필요. 다만 `error-codes.md §3 Historical-artifact` 에 ForEach 의 `VALIDATION_FAILED` 와 form 도메인의 `VALIDATION_ERROR` 가 별개 코드임을 주석으로 명기해 두면 향후 혼동 방지.

---

## 요약

Cross-Spec 관점에서 구현이 추가한 `FormValidationError` / `VALIDATION_ERROR` / `INVALID_FIELD` 에러 코드와 publisher-side form 검증 로직은 EIA spec §5.1·EIA-IN-10 및 form spec §4·§6.2 와 정합된다. `error-codes.md` 의 `VALIDATION_ERROR` 전역 공용 코드 정의, 그리고 `idempotency.interceptor.ts` 의 R8 캐시 제외 정책도 EIA spec §R8 과 일치한다. 단, WS spec §4.2 에러 코드 표에 `VALIDATION_ERROR` 가 아직 등재되지 않아 WS 채널을 통한 form 검증 실패 ack 의 공식 계약이 문서화돼 있지 않고(WARNING), `chat-channel-adapter.md` 와 Slack provider spec 두 곳에 구 코드 명칭 `VALIDATION_FAILED + fieldErrors` 가 잔존해 채널 어댑터 구현자에게 혼동을 줄 수 있다(WARNING). 이 두 spec 갱신이 완료되면 전체 cross-spec 일관성이 확보된다.

## 위험도

MEDIUM
