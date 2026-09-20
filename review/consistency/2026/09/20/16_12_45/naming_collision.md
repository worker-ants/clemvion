# 신규 식별자 충돌 검토 — spec-draft-integration-error-facts

## 발견사항

없음.

target 문서(`plan/in-progress/spec-draft-integration-error-facts.md`)는 스스로 명시하듯("새 코드·새 규약 — 없다. 넷
다 이미 도는 동작의 기록이다") 새 요구사항 ID·엔티티·API endpoint·이벤트명·환경변수·파일을 하나도 도입하지 않는다.
넷 다 이미 구현·테스트에 존재하는 식별자를 spec 문서 표/카탈로그에 **뒤늦게 반영**하는 사실 정정이다. 6개 관점별로
실제 코드베이스와 대조해 확인한 결과는 다음과 같다.

1. **요구사항 ID 충돌** — 새 ID 부여 없음 (해당 없음).

2. **엔티티/타입명 충돌** — 새 타입 없음. draft 가 언급하는 `IntegrationTestResult`, `IntegrationTestResultCode`,
   `HttpCredentialsResult` 는 전부 기존 타입(`codebase/backend/src/modules/integrations/connection-test-codes.ts`,
   `codebase/backend/src/nodes/integration/http-request/http-credentials.ts:22`)이며 draft 는 이를 신설하지 않는다.

3. **API endpoint 충돌** — 새 endpoint 없음. `POST /api/integrations/:id/test` 등은 기존 정의
   (`spec/2-navigation/4-integration.md:814`) 그대로다.

4. **이벤트/메시지명 충돌** — 새 이벤트 없음. 언급되는 결과 코드(`INTEGRATION_CALL_FAILED`, `HTTP_TRANSPORT_FAILED`,
   `HTTP_BLOCKED`, `DB_HOST_BLOCKED`, `INTEGRATION_INCOMPLETE`, `INTEGRATION_AUTH_UNSUPPORTED`, `HTTP_CONNECT_FAILED`,
   `MAKESHOP_AUTH_FAILED`, `CAFE24_INSUFFICIENT_SCOPE`)는 전부 grep 으로 코드베이스에 이미 존재함을 확인했다
   (`http-connection-tester.ts`, `connection-test-codes.ts`, `http-credentials.ts`, `database-query.handler.ts`,
   `http-request.handler.ts`, `makeshop-api.client.ts` 등) — 새 코드가 아니라 기존 코드의 트리거 조건을 표에
   추가하는 것뿐이다. 각 코드의 의미도 draft 의 서술과 실제 구현이 일치한다:
   - `HTTP_CONNECT_FAILED`: `http-connection-tester.ts:117-153` 의 `try` 블록이 preflight(SSRF 가드)까지 감싸므로,
     가드가 판정이 아닌 오류를 던져도 바깥 `catch` 로 떨어져 `HTTP_CONNECT_FAILED` 가 된다(TimeoutError/AbortError 가
     아닌 한 line 148-152 의 기본 분기). draft ③ INFO 1 이 적으려는 문장과 정확히 일치 — 기존 §5.3/§14.1 서술("네트워크
     · 타임아웃 · TLS")의 의미를 넓히는 것이지 다른 의미로 재사용하는 게 아니다.
   - `spec/2-navigation/4-integration.md` §14.1(약 1104~1122행)·Rationale "코드 이름"(약 1165행)에 이미
     `INTEGRATION_INCOMPLETE`/`INTEGRATION_AUTH_UNSUPPORTED`/`HTTP_CONNECT_FAILED` 행이 존재하며, draft ③ 이 고치려는
     "닫힌 다섯" 문장도 바로 이 위치(§14.1 근처 Rationale)에서 실제로 확인된다 — 존재하지 않는 자리를 겨눈 게 아니다.

5. **환경변수·설정키 충돌** — 새 ENV 없음. `ALLOW_PRIVATE_HOST_TARGETS` 는 기존 변수를 참조만 한다.

6. **파일 경로 충돌** — 새 spec 파일 생성 없음(대상 4개 파일 모두 기존 파일 수정). frontmatter `code:` 에 추가되는
   두 경로(`http-redirect.ts`, `http-credentials.ts`)는 실재하고 (`ls` 확인) 각각 유일한 목적의 파일이며 다른
   spec 의 `code:` 목록과 겹치지 않는다. draft ④가 추가하는 상호참조 링크
   `5-makeshop.md#95-별도-승인restricted-scope-미도입` 도 대상 heading(`### 9.5 별도 승인(restricted) scope 미도입`,
   `5-makeshop.md:236`)과 slug 가 정확히 일치해 앵커 충돌이 없다.

## 요약

target draft 는 새 식별자를 전혀 도입하지 않는 순수 사실 정정이다. 넷 다 이미 코드에 존재하는 에러 코드·함수·파일을
spec 표/카탈로그에 뒤늦게 반영하는 것이며, grep 으로 대조한 결과 draft 가 서술하는 트리거 조건(가드 고장 시
`INTEGRATION_CALL_FAILED`/`HTTP_CONNECT_FAILED`, HTTP 연결 테스트의 `INTEGRATION_INCOMPLETE`/`INTEGRATION_AUTH_UNSUPPORTED`,
MakeShop 403 의 `MAKESHOP_AUTH_FAILED` vs Cafe24 `CAFE24_INSUFFICIENT_SCOPE`)은 실제 구현과 정확히 일치했다. 새
엔티티·endpoint·이벤트·ENV·파일 경로도 없어 신규 식별자 충돌 관점에서 지적할 사항이 없다.

## 위험도

NONE
