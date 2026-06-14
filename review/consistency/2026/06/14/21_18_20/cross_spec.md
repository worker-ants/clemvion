# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done`
검토 대상 구현: `spec/4-nodes/6-presentation/4-form.md` §4·§6.2 — form 제출 field 검증 (publisher 측 `assertFormSubmissionValid`, `FormValidationError`, EIA·WS·REST 매핑)

---

## 발견사항

### [WARNING] WS spec 에러 코드 표에 `VALIDATION_ERROR` 미등재

- **target 위치**: 구현 diff — `websocket.gateway.spec.ts` W-12 테스트 + `workflow-errors.ts` `FormValidationError.code = ErrorCode.VALIDATION_ERROR`
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4.2` "버튼 클릭 에러 코드" 표 (WS `submit_form` ack 에러 코드 목록)
- **상세**: WS spec §4.2 에 등재된 `submit_form` ack 에러 코드는 `INVALID_EXECUTION_STATE` / `INTERACTION_TIMEOUT` / `EXECUTION_MESSAGE_TOO_LONG` / `EXECUTION_INTERNAL_ERROR` / `RESUME_*` 이다. 구현은 `FormValidationError`(`code = VALIDATION_ERROR`)가 typed `ExecutionError` 계층에 해당하므로 `errorCode = 'VALIDATION_ERROR'`로 ack 에 표면되지만, WS spec 표에 이 코드가 없다. 클라이언트나 채널 어댑터가 WS spec 표를 기준으로 ack 에러 코드를 핸들링할 경우 `VALIDATION_ERROR`를 unknown 코드로 처리하거나 `EXECUTION_INTERNAL_ERROR`로 오해할 수 있다.
- **제안**: `spec/5-system/6-websocket-protocol.md §4.2` 에러 코드 표에 `VALIDATION_ERROR` 항목 추가 — `submit_form` field 검증 실패 시 발행, execution `waiting_for_input` 유지(재제출 가능). 아울러 `spec/5-system/3-error-handling.md §1.5` WS 코드 공용 카탈로그에도 동일 행 추가.

---

### [WARNING] `chat-channel-adapter.md` 및 `slack.md` 가 `VALIDATION_FAILED` 를 사용 — 구현·EIA spec 은 `VALIDATION_ERROR`

- **target 위치**: 구현 diff — `interaction.service.ts`, `executions.controller.ts`, `workflow-errors.ts` 전반 (`VALIDATION_ERROR` 코드 사용)
- **충돌 대상**:
  - `spec/conventions/chat-channel-adapter.md §4.1 step 5` ("400 VALIDATION_FAILED + fieldErrors")
  - `spec/conventions/chat-channel-adapter.md §4.2 step 5` ("400 VALIDATION_FAILED + fieldErrors")
  - `spec/4-nodes/7-trigger/providers/slack.md` 116행 ("EIA 400 VALIDATION_FAILED")
- **상세**: chat-channel-adapter spec 과 slack.md 는 form 제출 server-side 검증 실패 응답 코드를 `VALIDATION_FAILED`라고 기술한다. 그러나 EIA spec (`spec/5-system/14-external-interaction-api.md §5.1`, EIA-IN-10)과 구현(`FormValidationError.code`, `ErrorCode.VALIDATION_ERROR`, `interaction.service`, `executions.controller`)은 모두 `VALIDATION_ERROR` 를 사용한다. 두 문자열은 다르므로, 채널 어댑터 구현이 chat-channel-adapter.md 를 SoT 로 삼아 응답 코드를 파싱하면 `VALIDATION_FAILED` 를 기대하다 `VALIDATION_ERROR` 를 수신해 분기를 놓친다.
- **제안**: `spec/conventions/chat-channel-adapter.md §4.1·§4.2` 와 `spec/4-nodes/7-trigger/providers/slack.md` 의 `VALIDATION_FAILED` 를 `VALIDATION_ERROR`(+`details[]`)로 정정. EIA spec `§5.1`·`EIA-IN-10` 이 이미 `VALIDATION_ERROR` 를 쓰므로 해당 spec 들을 그것에 맞추면 된다.

---

### [INFO] EIA spec §5.1 주석이 "일부 Planned" 로 남아 있어 구현 완료 시점과 불일치

- **target 위치**: 구현 diff — `assertFormSubmissionValid`, `validateFormSubmission` 재사용으로 field-level 검증 구현 완료
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §5.1` `VALIDATION_ERROR` 항목 설명 괄호: "(현재 form field-level 검증 자체는 일부 Planned — `interaction.service` 는 `data` 객체 형식만 확인)"
- **상세**: 구현 diff 에서 `interaction.service` 가 `continueExecution` → `assertFormSubmissionValid` 경로를 통해 필수/type/length 검증을 수행하도록 완료됐으므로, 위 괄호 내 Planned 주석은 outdated 이다. 참고로 `type: 'file'` MIME/size/count 검증은 여전히 Planned 이므로 이 부분은 유지해야 한다.
- **제안**: EIA spec §5.1 `VALIDATION_ERROR` 행의 Planned 주석을 "field-level 검증(필수/type/length/선택지)은 구현 완료; `type: 'file'` MIME/크기/개수 검증만 Planned" 로 업데이트.

---

## 요약

본 구현(`FormValidationError` 신설, `assertFormSubmissionValid` publisher 측 동기 검증, EIA·WS·REST 3 경로 매핑)은 `spec/4-nodes/6-presentation/4-form.md §4·§6.2` 및 `spec/5-system/14-external-interaction-api.md EIA-IN-10·§5.1`과 정합하며 직접적 모순은 없다. 그러나 WS spec 에러 코드 표에 `VALIDATION_ERROR` 미등재(WARNING)와 chat-channel-adapter·slack provider spec 이 다른 에러 코드 문자열(`VALIDATION_FAILED`)을 사용(WARNING)하는 두 가지 명시적 우선순위 결정이 필요한 불일치가 발견됐다. 채널 어댑터 구현이 두 spec 중 하나를 SoT 로 삼으면 다른 쪽과 정합을 잃는 구조이므로, 해당 spec 들을 `VALIDATION_ERROR`로 통일하는 것이 필요하다.

---

## 위험도

MEDIUM
