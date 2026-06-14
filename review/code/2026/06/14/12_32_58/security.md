# Security Review — EIA MessageTooLongError → HTTP 400 매핑

## 발견사항

### 에러 처리 / 정보 노출

- **[INFO]** `MessageTooLongError` 의 내부 수치(한도·실제 길이)가 클라이언트 응답에 노출되지 않음 — 양호
  - 위치: `workflow-errors.ts` L217-225, `interaction.service.ts` L587-589
  - 상세: `ExecutionError` 계층의 `serverDetail` 분리 설계를 올바르게 따른다. `error.message` 는 고정 문자열 `"Message exceeds the maximum allowed length."` 만 반환하고, 실제 길이(`actualLength`)와 한도(`maxLength`)는 `serverDetail` 에만 담겨 서버 로그 전용으로 남는다.
  - 제안: 현행 유지. 테스트(spec.ts L71-72)에서 수치 미포함을 명시적으로 assert 하고 있어 회귀 방어가 잘 돼 있다.

- **[INFO]** `badRequest()` 헬퍼가 `code` 와 `message` 를 `{ error: { code, message } }` shape 으로 감싸 NestJS `BadRequestException` 에 전달 — 내부 스택트레이스·서버 상세가 HTTP 응답 body 에 포함되지 않음
  - 위치: `interaction.service.ts` L905-907
  - 상세: NestJS 의 기본 예외 필터는 `BadRequestException` 의 `response` 객체를 그대로 직렬화한다. 이 shape 에는 `serverDetail` 이 포함되지 않으므로 안전하다.

### 입력 검증

- **[INFO]** `submit_message` 의 빈 메시지 검증(`message.length === 0`)은 이미 서비스 레이어에서 처리되고 있으며, 최대 길이 초과는 엔진 레이어(`MessageTooLongError`)에서 typed 에러로 처리됨 — 중복 검증이 아닌 계층 분리 의도 적절
  - 위치: `interaction.service.ts` L700-705

### 인증/인가

- **[INFO]** 이번 변경은 `dispatchContinuation` 내 에러 매핑만 추가하며 인증/인가 경로를 건드리지 않음. 인증은 `InteractionGuard` 가 `dispatchContinuation` 호출 이전에 이미 통과한 상태 — 변경 범위 외.

### 기타

- **[INFO]** 테스트에서 사용하는 `MessageTooLongError(10_000, 123_456)` 는 실제 내부 수치 예시이며, 이 값이 응답에 노출되지 않음을 `expect(body.message).not.toContain('123456')` 와 `not.toContain('10000')` 로 명시 검증 — 보안 회귀 테스트로서 적절함.

---

## 요약

이번 변경은 `MessageTooLongError` 를 generic 500 대신 의미적으로 정확한 400 `MESSAGE_TOO_LONG` 으로 매핑하는 좁은 범위의 에러 처리 개선이다. 보안 관점에서 가장 중요한 고려사항인 내부 수치(메시지 길이, 한도 값) 노출 차단이 `ExecutionError.serverDetail` 분리 설계로 구조적으로 보장되며, 테스트 레벨에서도 명시적으로 검증되고 있다. 새로 도입된 코드 경로에서 인젝션·인증 우회·하드코딩 시크릿·암호화 관련 취약점은 발견되지 않는다. 스펙(`14-external-interaction-api.md §5.1`)의 "내부 길이 수치 미노출" 요건과 구현이 일치한다.

---

## 위험도

NONE
