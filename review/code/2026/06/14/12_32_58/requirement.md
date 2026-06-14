# Requirement Review — EIA MessageTooLongError → HTTP 400 매핑 (I-5)

## 발견사항

### [WARNING] plan 체크박스와 실제 코드 상태 불일치 — `be` / `be test` 태스크가 미체크인데 코드는 이미 구현됨

- 위치: `plan/in-progress/eia-message-length-error-mapping.md` 라인 24–26
- 상세: plan 파일의 다음 항목이 `[ ]` (미완료) 로 표시돼 있다.
  - `[ ] **be** interaction.service.ts dispatchContinuation ...`
  - `[ ] **be test** interaction.service.spec ...`
  - `[ ] consistency-check --spec (BLOCK 게이트)`
  그러나 리뷰 대상 파일 2(interaction.service.ts)와 파일 1(interaction.service.spec.ts)에는 해당 구현·테스트가 이미 포함돼 있다. plan 체크박스는 실제 상태를 반영해야 하는데(`memory/feedback_plan_checkbox_actual_state.md`) `be` / `be test` 항목을 `[x]` 로 갱신하지 않은 채 커밋 대상이 됐다. e2e(`[ ] **e2e** ...`)는 아직 미구현으로 정확히 `[ ]` 이나, 구현이 완료된 항목들이 미체크 상태다.
- 제안: plan 파일에서 구현 완료된 `be`, `be test` 항목을 `[x]` 로 갱신한다. `consistency-check --spec` 실행 후 통과 시 체크, `e2e` 항목은 e2e 테스트 작성 완료 시 체크.

---

### [WARNING] e2e 테스트 미구현 — plan 체크리스트 항목 `[ ] **e2e** external-interaction.e2e: submit_message 10000자 초과 → 400 + code MESSAGE_TOO_LONG`

- 위치: `plan/in-progress/eia-message-length-error-mapping.md` 라인 27; `/Volumes/project/private/clemvion/codebase/backend/test/external-interaction.e2e-spec.ts`
- 상세: plan에 명시된 e2e 항목(`submit_message 10000자 초과 → 400 + code MESSAGE_TOO_LONG`)이 `external-interaction.e2e-spec.ts` 에 존재하지 않는다. unit test(interaction.service.spec.ts)는 엔진이 `MessageTooLongError` 를 throw 할 때의 서비스 레이어 매핑을 검증하지만, e2e 는 실제 `continueAiConversation` 경로의 최대 길이 강제(10000자 초과 입력 → HTTP 400)를 검증해야 한다. plan 상 `[ ] TEST + REVIEW WORKFLOW` 게이트도 미완료 상태다.
- 제안: `external-interaction.e2e-spec.ts`에 `submit_message` 10001자 이상 body 전송 → `400 MESSAGE_TOO_LONG` 시나리오 추가 후 plan 체크.

---

### [INFO] spec §5.1 에러 표의 `MESSAGE_TOO_LONG` 조건 설명과 실제 검증 위치 일치 확인

- 위치: `spec/5-system/14-external-interaction-api.md` 라인 1337
- 상세: spec 에러 표는 `MESSAGE_TOO_LONG` 을 "publisher 측 동기 검증"으로 정확히 기술한다. 코드도 `ExecutionEngineService.continueAiConversation` 내에서 `message.length > MAX_MESSAGE_LENGTH(10_000)` 를 동기 확인 후 `MessageTooLongError` 를 throw 하며, `dispatchContinuation` 이 이를 catch → `badRequest('MESSAGE_TOO_LONG', error.message)` 로 매핑한다. spec 에 명시된 "고정 메시지만 반환" / "내부 길이 수치 미노출" 도 `error.message` = `'Message exceeds the maximum allowed length.'` (고정 문자열)로 정확히 구현돼 있고 `serverDetail` 에만 실제 수치(`length=${actualLength} max=${maxLength}`)가 들어간다. spec 과 구현이 line-level 로 일치한다.

---

### [INFO] `dispatchContinuation` 의 `MessageTooLongError` 매핑이 `submit_message` 외 명령 경로에도 적용됨 (현재 문제없음, 향후 주의)

- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/external-interaction/interaction.service.ts` — `dispatchContinuation` 메서드
- 상세: `dispatchContinuation` 은 `submit_form`, `click_button`, `submit_message`, `end_conversation` 모두에서 공유된다. 현재 `MessageTooLongError` 는 `continueAiConversation`(`submit_message` 경로)에서만 throw 되므로 오동작 없음. 향후 다른 엔진 메서드가 `MessageTooLongError` 를 throw 할 경우 의도치 않게 다른 명령도 400 으로 표면될 수 있다는 점을 인지해 두면 된다.

---

## 요약

핵심 기능 구현(spec §14 §5.1 / §4 §7.5.2 요구사항)은 완전히 충족돼 있다. `interaction.service.ts` 의 `dispatchContinuation` 이 `MessageTooLongError` 를 `400 MESSAGE_TOO_LONG` 으로 매핑하고, `error.message` (고정 client-safe 문자열)만 응답에 포함해 내부 수치를 노출하지 않으며, spec 에 추가된 에러 표 행과 line-level 로 일치한다. 단위 테스트도 status=400, code='MESSAGE_TOO_LONG', 수치 미포함 세 가지를 모두 검증하고 있다. 주된 문제는 plan 파일의 체크박스 상태가 실제 구현 상태를 반영하지 않아 `be` / `be test` 항목이 미체크인 점, 그리고 e2e 테스트가 아직 작성되지 않은 점이다.

## 위험도

LOW
