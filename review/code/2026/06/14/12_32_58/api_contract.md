# API 계약(API Contract) 리뷰 결과

## 발견사항

- **[INFO]** `MESSAGE_TOO_LONG` 에러 코드 신규 도입 — spec §5.1 에 400 에러 행 추가 및 구현 일치 확인
  - 위치: `spec/5-system/14-external-interaction-api.md` §5.1 에러 표, `interaction.service.ts` `dispatchContinuation()` 신규 catch 블록
  - 상세: `submit_message` 에서 메시지 길이 초과 시 기존 generic 500 대신 `400 MESSAGE_TOO_LONG` 으로 명확히 매핑. spec 에 에러 코드·조건·내부 수치 미노출 정책이 모두 문서화됨. 기존 EIA 입력 검증 400 관행(`INVALID_COMMAND`, `VALIDATION_FAILED`)과 일관된 HTTP 상태 코드 선택.
  - 제안: 이미 올바른 설계. 추가 조치 불필요.

- **[INFO]** `error.message` 고정 client-safe 문자열 보장 — 내부 수치 미노출
  - 위치: `workflow-errors.ts` `MessageTooLongError` 생성자, `interaction.service.spec.ts` L74-75 (`.not.toContain('123456')`, `.not.toContain('10000')` assertion)
  - 상세: `MessageTooLongError.message` 는 고정 문자열 `'Message exceeds the maximum allowed length.'` 이며, maxLength/actualLength 수치는 `serverDetail` 에만 담긴다. `badRequest('MESSAGE_TOO_LONG', error.message)` 로 연결되므로 수치 누출 경로 없음. 테스트가 이를 명시적으로 검증한다.
  - 제안: 현행 설계 유지.

- **[INFO]** 500→400 상태 코드 변경으로 인한 하위 호환성 고려
  - 위치: `interaction.service.ts` `dispatchContinuation()` catch 블록
  - 상세: 변경 전 `MessageTooLongError` 는 NestJS generic 500 으로 처리됐다. 이번 변경으로 400 반환. 500→400 은 의미상 올바른 정정이나, 기존 클라이언트가 500 핸들러에서 처리하던 경우라면 행동이 달라진다. 메시지 길이 초과는 명백한 클라이언트 입력 오류이므로 의미상 400 이 정확하다.
  - 제안: API 소비자에게 에러 코드 추가 및 상태 코드 변경을 changelog 또는 문서로 통보 권장.

- **[INFO]** 에러 응답 형식 일관성 확인
  - 위치: `interaction.service.ts` `badRequest()` helper (L908-910 전체 파일 기준), 모든 에러 응답
  - 상세: 모든 에러 응답이 `{ error: { code, message } }` 구조를 사용하며 spec §5.1 의 API 규칙 컨벤션을 준수. `MESSAGE_TOO_LONG` 도 동일 shape 로 일관성 유지.
  - 제안: 이상 없음.

## 요약

이번 변경은 `submit_message` 에서 메시지 길이 초과 시 발생하는 `MessageTooLongError` 를 generic 500 대신 `400 MESSAGE_TOO_LONG` 으로 매핑하는 내용이다. spec §5.1 에 에러 항목이 추가됐고, 구현(`dispatchContinuation` catch 블록)과 테스트(수치 미노출 assertion 포함) 모두 spec 과 일치한다. 에러 응답 형식은 기존 EIA 에러 컨벤션(`{ error: { code, message } }`)과 완전히 일관되며, 내부 길이 수치 누출 방지도 `MessageTooLongError` 설계 수준에서 확보된다. API 계약 관점에서 breaking change 에 해당하는 상태 코드 변경(500→400)이 있으나 이는 의미상 정정이며 실질적 위험은 낮다.

## 위험도

LOW
