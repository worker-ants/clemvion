# API 계약(API Contract) 리뷰

## 대상 파일

- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/integrations/integrations.service.spec.ts`
- `codebase/backend/src/modules/integrations/integrations.service.ts`
- `plan/in-progress/fix-mail-send-status.md`

---

## 발견사항

### [INFO] `IntegrationTestResult` 응답 형식 — email 실패 코드 네임스페이스 비일관성
- 위치: `integrations.service.ts` `testEmailTransport` (line ~2148)
- 상세: 실패 코드 `EMAIL_CONNECT_FAILED` 가 기존 `MCP_CONNECT_FAILED` 와 동일 레벨의 test-result code 이다. 그런데 MCP 실패 코드는 `MCP_ERROR_CODES` 상수 딕셔너리로 관리되지만, `EMAIL_CONNECT_FAILED` 는 리터럴 문자열로 하드코딩되어 있어 코드 출처 추적성이 낮다. 클라이언트 입장에서는 실패 코드가 어떤 서비스별 네임스페이스로 범주화되는지 명세가 없다.
- 제안: 단기적으로 현재 패턴을 유지해도 하위 호환성 문제는 없다. 다만 `EMAIL_ERROR_CODES` 상수나 동일 위치의 enum 으로 격리하면 향후 확장 시 중복 선언을 방지하고, `IntegrationTestResult.code` 의 가능한 값 범위를 타입 수준에서 표현하기 쉬워진다.

### [INFO] `IntegrationTestResult` 인터페이스 — `code` 필드 JSDoc 이 MCP 전용으로 기술
- 위치: `integrations.service.ts` `IntegrationTestResult` 인터페이스 선언 (~line 2228)
- 상세: `code?: string` 필드의 JSDoc 이 `"Failure code in the MCP_* vocabulary; absent on success."` 로 기술되어 있다. 이번 변경으로 `EMAIL_CONNECT_FAILED` 가 동일 필드를 사용하므로 JSDoc 이 사실과 달라졌다. API 클라이언트가 이 인터페이스를 계약으로 참조하면 MCP 외 코드를 예상치 못할 수 있다.
- 제안: JSDoc 을 `"Failure code (e.g. MCP_* or EMAIL_CONNECT_FAILED); absent on success."` 로 갱신하면 계약 기술과 구현이 일치한다.

### [INFO] `testConnection` 응답 형식 — `pending_install` 가드가 200 OK 로 실패를 반환
- 위치: `integrations.service.ts` `testConnection` (~line 2854)
- 상세: `pending_install` 상태의 통합에 대해 `{ success: false, code: 'INTEGRATION_INCOMPLETE', message: ... }` 를 HTTP 200 으로 반환한다. 기존 패턴과 일관적이고 클라이언트 측에서 success 플래그로 분기하므로 문제는 없으나, 이번 변경과 무관한 기존 설계이며 에러 응답 HTTP 코드(4xx)를 쓰지 않는 점은 REST 원칙과 다소 거리가 있다. 이번 PR 변경 범위와는 무관하다.
- 제안: 본 PR 범위가 아니므로 별도 이슈로 추적 권장.

### [INFO] `ErrorPortFallbackError` — 엔진 내부 sentinel, HTTP API 표면에는 노출되지 않음
- 위치: `execution-engine.service.ts` `ErrorPortFallbackError` 클래스 (~line 2643)
- 상세: 이 에러는 엔진 top-level catch 에서 잡혀 `Execution.error.code = 'ERROR_PORT_FALLBACK'` 으로 DB 에 저장되고, 실행 조회 API(`GET /executions/:id`) 를 통해 클라이언트에 노출된다. 새로운 에러 코드 `ERROR_PORT_FALLBACK` 이 실행 결과의 `error.code` 필드에 출현하는 것은 기존 클라이언트 계약에 없던 값이다. 기존 클라이언트가 이 필드를 열거형으로 처리하지 않는 한 breaking change 는 아니지만, 계약 문서에 신규 코드가 명시되지 않았다.
- 제안: `spec/5-system/3-error-handling.md §3.2` 또는 API 응답 스키마 문서에 `ERROR_PORT_FALLBACK` 코드를 명시하도록 후속 spec 갱신을 권장 (plan 의 "후속(선택)" 항목에 이미 언급됨).

---

## 요약

이번 변경은 주로 실행 엔진 내부의 error-port 라우팅 처리와 SMTP 연결 테스트 로직을 수정한 것으로, 외부 HTTP API 의 엔드포인트 구조·URL 설계·버전·인증 방식에는 변경이 없다. `IntegrationTestResult` 응답 형식은 기존 `success/message/code` 구조를 그대로 유지하고, `EMAIL_CONNECT_FAILED` 코드가 기존 `MCP_*` 코드와 동일한 필드를 통해 클라이언트에 전달된다. 하위 호환성을 깨는 변경은 없으나, `IntegrationTestResult.code` 필드의 JSDoc 이 MCP 한정으로 기술되어 있는 점과 `ERROR_PORT_FALLBACK` 이 실행 결과 응답에 새로 출현하는 점은 계약 문서 갱신이 필요한 낮은 위험도의 불일치이다.

## 위험도

LOW
