# Testing Review — EIA MessageTooLongError → HTTP 400 매핑

## 발견사항

### [INFO] 신규 테스트 I-5 — 핵심 케이스 커버 완비
- 위치: `interaction.service.spec.ts` lines 247–273 (신규 추가 블록)
- 상세: `submit_message` 에서 `MessageTooLongError` 가 발생했을 때 `400 MESSAGE_TOO_LONG` 으로 매핑되는 지 검증하며, 가장 중요한 보안 요건인 "내부 길이 수치(10000, 123456) 미노출" 단언도 포함한다. 테스트 명칭(I-5)이 plan 항목·spec 코드·구현 주석과 1:1 연동되어 추적성이 높다.
- 제안: 없음.

### [WARNING] try/catch 패턴 — 기존 rejects.toMatchObject 스타일과 불일치
- 위치: `interaction.service.spec.ts` lines 253–272
- 상세: 같은 파일의 `InvalidExecutionStateError` 케이스들(lines 198–244)은 모두 `await expect(...).rejects.toMatchObject({...})` 패턴을 사용한다. 신규 I-5 테스트만 `try/catch + let caught: unknown` 패턴을 쓰는 이유는 `response.error` 내부 필드 두 개와 `status` 를 동시에 단언하기 위해서인데, 사실 아래처럼 단일 `rejects.toMatchObject` 로도 동일하게 표현 가능하다.

  ```typescript
  await expect(service.interact(...)).rejects.toMatchObject({
    status: 400,
    response: { error: { code: 'MESSAGE_TOO_LONG', message: 'Message exceeds the maximum allowed length.' } },
  });
  ```

  `not.toContain` 두 개는 별도 `let caught` 블록 없이도 `message` 필드를 이미 하드코딩된 상수로 단언하므로 실질적으로 충분히 커버된다. (고정 문자열 `'Message exceeds the maximum allowed length.'` 가 숫자를 포함하지 않으므로 `not.toContain('10000')` / `not.toContain('123456')` 은 현재 구현에서 redundant 하지만 회귀 방어용으로 존재함 — 이 점은 긍정적이나 패턴 불일치는 코드베이스 일관성 관점에서 주의.)
- 제안: 기존 `rejects.toMatchObject` 패턴으로 통일하고, `not.toContain` 단언은 `caught` 변수 없이 `toMatchObject` 검증 후 별도 `expect(body.message).not.toContain(...)` 블록으로 분리하거나, 혹은 comment 로 의도를 명시하여 코드베이스 관용구와의 괴리를 줄인다.

### [INFO] e2e 테스트 항목 미완료 (plan 체크박스 미체크)
- 위치: `plan/in-progress/eia-message-length-error-mapping.md` lines 950–951
- 상세: plan 항목 중 `be`(interaction.service.ts 구현)와 `be test`(interaction.service.spec.ts)는 이번 diff 로 구현됐으나 체크박스가 여전히 `[ ]` 로 남아 있다. 또한 `e2e` 항목(`external-interaction.e2e: submit_message 10000자 초과 → 400 + code MESSAGE_TOO_LONG`)도 체크되지 않았고 실제로 e2e 파일 변경이 이번 diff 에 없다. e2e 커버리지가 실제 누락 상태.
- 제안: unit 테스트는 완료됐으므로 plan 체크박스를 갱신하고, e2e 테스트(`external-interaction.e2e.ts` 또는 동등 파일)에 10000자 초과 시나리오를 추가해야 한다.

### [INFO] MessageTooLongError 생성자 인수 의미 검증 부재
- 위치: `interaction.service.spec.ts` line 251: `new MessageTooLongError(10_000, 123_456)`
- 상세: 테스트가 `MessageTooLongError(maxLength, actualLength)` 형태로 인스턴스를 생성하지만, 생성자의 두 인수 순서(maxLength vs actualLength)가 `error.message` 에 어떻게 반영되는지는 이 파일에서 검증하지 않는다. 구현 측 `badRequest('MESSAGE_TOO_LONG', error.message)` 가 `error.message` 를 그대로 사용하므로 `MessageTooLongError` 의 `message` 프로퍼티가 "고정 client-safe 문자열"인지 여부는 `workflow-errors.ts` 구현에 달려 있다. 테스트에서 `error.message` 의 실제 값을 직접 확인하는 단언이 없어, `MessageTooLongError` 가 내부 수치를 `message` 에 포함하도록 변경되었을 때 이 테스트만으로는 감지되지 않는다.
- 제안: `expect(body.message).toBe('Message exceeds the maximum allowed length.')` 가 이미 있어 고정 문자열을 강제하므로 실질적 회귀 방어는 되어 있다. 추가로 `workflow-errors.spec.ts` (또는 동등 파일)에서 `MessageTooLongError.message` 가 수치를 포함하지 않음을 직접 검증하면 계층 분리가 명확해진다.

### [INFO] dispatchContinuation 에서 submit_form·click_button 경로의 MessageTooLongError 처리
- 위치: `interaction.service.ts` `dispatchContinuation` 메서드
- 상세: `MessageTooLongError` catch 는 `dispatchContinuation` 전체에 적용되므로 `submit_form`·`click_button` 경로에서도 잡힌다. 현실적으로 이 에러는 `continueAiConversation` 에서만 발생하지만, 이론적으로 다른 명령에서도 발생할 경우 동일하게 400 으로 매핑된다. 이에 대한 테스트가 없다. 현 아키텍처(facade)에서는 엔진이 해당 에러를 `submit_form` 경로에서 던지지 않을 것이므로 INFO 수준이다.
- 제안: 테스트 추가 필요성은 낮으나, 주석에 "이 catch 는 continueAiConversation 경로 전용" 이라는 의도를 명시하거나, 향후 `submit_message` 분기 내에서만 `MessageTooLongError` 를 처리하도록 리팩터하면 커버리지 명확성이 높아진다.

### [INFO] 테스트 격리 및 makeMocks 패턴 — 양호
- 위치: 전체 spec 파일
- 상세: `makeMocks()`가 매 테스트마다 새 인스턴스를 생성하고, `mockResolvedValueOnce`·`mockRejectedValueOnce` 를 사용하여 테스트 간 상태 유출이 없다. `describe` 블록 간 공유 변수도 없다. 테스트 격리 관점에서 문제 없음.

## 요약

이번 변경의 핵심인 `MessageTooLongError → 400 MESSAGE_TOO_LONG` 매핑에 대한 unit 테스트(I-5)는 status 코드·에러 코드·고정 메시지·내부 수치 미노출까지 네 가지 요건을 모두 단언하여 테스트 커버리지 측면에서 충분하다. 다만 기존 파일의 `rejects.toMatchObject` 관용구와 달리 `try/catch + let caught` 패턴을 사용해 스타일 불일치가 발생하며, plan 항목에 명시된 e2e 테스트(`submit_message 10000자 초과`)가 이번 diff 에 포함되지 않아 통합 경로 커버리지가 남아 있다. `MessageTooLongError.message` 가 실제로 수치를 포함하지 않는지에 대한 단위 검증도 `workflow-errors.spec.ts` 수준에서 보강하면 계층적 방어가 강화된다.

## 위험도

LOW
