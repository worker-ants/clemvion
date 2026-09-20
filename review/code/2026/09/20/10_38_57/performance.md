# 성능(Performance) 리뷰 — SSRF 가드 소비자 넷의 catch 분기 (`instanceof SsrfBlockedError`), 3라운드 누적 diff

본 라운드는 2라운드 RESOLUTION(`fff0d14bf`)이 적용된 뒤의 누적 diff를 대상으로 한다. 실제 코드 변경은 파일 1~10
(`database-connection-tester.{ts,spec.ts}`, `http-connection-tester.{ts,spec.ts}`,
`database-query.handler.{ts,spec.ts}`, `http-redirect.{ts,spec.ts}`(신설), `http-request.handler.{ts,spec.ts}`)이고,
나머지(파일 11~44)는 plan/review 산출물(`.md`/`.json`)로 성능 관점 대상이 아니다.

## 발견사항

이번 라운드에서 새로 발견된 CRITICAL/WARNING 급 성능 이슈는 없다. 1~2라운드에서 지적된 항목의 현재 반영 상태를 소스에서
직접 대조 확인했다.

- **[INFO]** (재확인, 조치 완료) `toLogError` 중복 호출 제거 — 반영 확인
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:364` (`const logError = toLogError(err);`), 같은 catch 블록 내 `error: logError` / `new IntegrationError('INTEGRATION_CALL_FAILED', logError.message)` 양쪽에서 재사용
  - 상세: 2라운드 INFO 1(`review/code/2026/09/20/10_09_56/performance.md`)에서 지적된 "같은 `err`에 대해 `sanitizeMessage` 3-regex 패스가 두 번 도는" 중복 계산이, 3라운드 커밋(`fff0d14bf`)에서 `const logError` 로 단일화됐다. 364행(preflight catch)과 560행(`toLogError(err).message`, transport catch)은 서로 다른 catch 블록의 서로 다른 `err` 이므로 중복이 아니다.
  - 제안: 없음 — 이미 반영됨.

- **[INFO]** (재확인, 조치 완료) `database-query.handler.ts` 의 `detail` 중복 표현 제거 — 반영 확인
  - 위치: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` — `assertSafeOutboundHostResolved` catch 블록의 `const detail = err instanceof Error ? err.message : String(err);`
  - 상세: 2라운드 WARNING 4에서 지적된 "같은 표현을 catch 안에서 두 번 계산" 문제가 `const detail` 한 번 계산 후 `logger.warn`·`sanitizeMessage(detail)` 양쪽이 재사용하는 형태로 고쳐졌다(형제 파일 `database-connection-tester.ts`·`http-request.handler.ts` 와 동일 관용구로 통일).
  - 제안: 없음 — 이미 반영됨.

- **[INFO]** (재확인, 설계상 유지) `sanitizeMessage` → `clampMessage` 순서 — 원문 전체에 정규식 3패스
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts` — `message: clampMessage(sanitizeMessage(detail))`
  - 상세: `sanitizeMessage`(공용 헬퍼, `integration-handler-base.ts:156-163`)의 세 정규식은 모두 중첩 정량자가 없어 선형이고, lookahead/lookbehind 사용 패턴(`(?<![...])...{32,}(?![...])`)도 backtracking 폭발 소지가 없다. 클램프 이전 원문 전체를 훑긴 하지만, 이 경로에 도달하는 `detail`은 오늘 기준 `isBlockedHostname`의 `TypeError`(고정된 짧은 문구, host/IP 미포함)뿐이라 실질적 크기 리스크는 없다. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(파일 11, "가드 «고장» 메시지에는 host/IP 마스킹이 없다")에 후속 항목으로 등재돼 있어 새로 등재할 필요는 없다.
  - 제안: 현행 유지. 가드가 향후 외부 입력을 그대로 실어 나르는 오류를 던지도록 바뀐다면(트래커가 이미 그 갈림길을 적어 뒀다) `clampMessage`를 `sanitizeMessage`보다 먼저 적용하는 순서로 재검토.

- **[정보 — 결함 아님]** `AbortSignal.timeout` 생성을 preflight 뒤로 이동 — 성능 개선으로 재확인
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts` (`try` 블록 내 `outboundBlockReason(url)` 호출 다음에 `AbortSignal.timeout(HTTP_TEST_TIMEOUT_MS)` 생성)
  - 상세: `AbortSignal.timeout`은 생성 시점부터 카운트다운을 시작하므로, 이전처럼 preflight(DNS 조회 포함, 블로킹 I/O) **전**에 신호를 만들면 가드의 DNS 조회 시간만큼 실제 `fetch` 예산이 깎여 느린 DNS 환경에서 정상 연결이 타임아웃으로 오분류될 수 있었다. 이번 순서 변경으로 그 예산 잠식이 사라진다 — 회귀가 아니라 개선.
  - 제안: 없음.

## 그 외 검토

- **알고리즘 복잡도/자료구조**: 전 파일 공통으로 기존 `try/catch`에 `instanceof SsrfBlockedError` 분기 하나를 추가하는 형태뿐이다. 새 반복문·중첩 루프·부적절한 자료구조 도입 없음.
- **N+1 호출**: 가드 함수(`assertSafeOutboundHostResolved`/`assertSafeOutboundUrl`) 호출 횟수는 요청당 그대로다. `http-redirect.ts`의 `followRedirectsSafely`는 `MAX_REDIRECT_HOPS = 5`로 상한이 있어 홉마다의 재검사(`outboundBlockReason`)가 무한 확장되지 않는다(이번 diff가 아닌 기존 구조, 변경 없음). 새로 추가된 `logger.warn`/`logUsage` 호출도 SSRF 가드 실패라는 희귀 경로에서 요청당 1회만 실행된다.
- **캐싱**: 해당 없음 — 캐싱이 필요할 만한 반복 계산이 새로 생기지 않았다.
- **블로킹 I/O**: 프로덕션 경로에 새 동기 I/O 없음. 신설 `http-redirect.spec.ts`는 `assertSafeOutboundHostResolved`를 mock해 실제 `node:dns` 조회를 피하도록 명시적으로 처리(테스트 전용, flaky/hang 예방).
- **불필요한 연산/문자열 연결**: 새 템플릿 리터럴(`logger.warn` 메시지 등)은 요청당 1회 평가되는 단발성 연결로 O(n²) 누적 패턴이 아니다.
- **지연 로딩**: 해당 없음.

## 요약

이번 3라운드 누적 diff는 SSRF 가드 네 소비자(HTTP 노드/테스터, DB 노드/테스터, `outboundBlockReason`)의 `catch` 블록에서 "차단 판정"과 "가드 자체의 고장"을 가르는 순수 에러 분류 리팩터링이며, 성능에 영향을 주는 루프·N+1·블로킹 I/O·부적절한 자료구조는 도입되지 않았다. 1~2라운드 성능 리뷰가 지적한 중복 계산(`toLogError` 2회 호출, `database-query.handler.ts`의 `detail` 이중 표현)은 커밋 `fff0d14bf`에서 실제로 단일 계산으로 고쳐졌음을 소스 대조로 확인했다. 유일하게 성능과 맞닿은 실질 변경(`http-connection-tester.ts`의 `AbortSignal.timeout` 생성 시점을 preflight 뒤로 이동)은 오히려 타임아웃 예산의 정확도를 개선하는 방향이다. 남은 `sanitizeMessage`/`clampMessage` 순서는 이론적 지적 수준이며 이미 백로그(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 등재돼 있어 재등재하지 않았다.

## 위험도

NONE
