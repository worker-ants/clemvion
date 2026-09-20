# API 계약(API Contract) 리뷰 — SSRF 가드 소비자 넷의 catch 판정 분기

## 검토 범위

SSRF 가드(`http-safety.ts`) 소비자 4곳(+동반 1곳)의 `catch` 를 `instanceof SsrfBlockedError` 로 갈라 "차단 판정"과
"가드 자체의 고장"을 구분하는 변경이다. wire 스키마(엔드포인트 경로·요청 바디·페이지네이션·인증)는 건드리지 않고, 이미 존재하는
에러 코드(`INTEGRATION_CALL_FAILED` · `HTTP_TRANSPORT_FAILED` · `HTTP_CONNECT_FAILED` · `DB_CONNECT_FAILED`)를 새로운 트리거
(가드 고장)에 재사용하는 형태라 새 코드가 API 표면에 추가되지는 않는다. 아래는 그 안에서 발견한 계약 관점 이슈다.

## 발견사항

- **[WARNING]** `http-request.handler.ts` 안에서 "가드 자체의 고장"(비판정 오류)이 **일어나는 시점에 따라 서로 다른
  `error.code`** 로 나간다 — preflight 시점은 `INTEGRATION_CALL_FAILED`, redirect **홉** 검사 시점은 `HTTP_TRANSPORT_FAILED`.
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:362`(preflight catch,
    `if (!(err instanceof SsrfBlockedError))` → `INTEGRATION_CALL_FAILED`), 대조 `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:536`(`if (err instanceof IntegrationError)` 분기 — 홉의 `SsrfBlockedError` 는 이미
    `IntegrationError(HTTP_BLOCKED)` 로 승격돼(`:454-461`) 여기서 잡히지만, 홉의 **비판정** 오류는 `IntegrationError` 가 아니라서
    이 분기를 타지 않고), `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:566`(제네릭 fallback —
    `HTTP_TRANSPORT_FAILED`). 근본 원인은 `codebase/backend/src/nodes/integration/http-request/http-redirect.ts:36-38`
    (`outboundBlockReason` — `SsrfBlockedError` 는 사유 문자열로 삼키고, 그 밖은 **그대로 던진다** — 이 raw 오류가
    `IntegrationError` 로 승격되지 않은 채 handler 의 outer catch 까지 전파된다).
  - 상세: 이번 PR 의 원칙은 "판정만 차단으로, 판정이 아니면 그 호출부의 «분류되지 않은 실패» 경로로" 다(`plan/in-progress/ssrf-catch-instanceof.md`
    39-49행). 그런데 `http-request.handler.ts` 라는 **같은 네임스페이스** 안에서, 같은 근본 원인(SSRF 가드가 판정 아닌 예외를
    던짐)이 preflight 때는 `INTEGRATION_CALL_FAILED`, 리다이렉트 홉 때는 `HTTP_TRANSPORT_FAILED` 로 서로 다른 `output.error.code`
    가 된다. `output.error.code` 는 워크플로 작성자가 분기 조건으로 쓰는 API 표면(spec `1-http-request.md` §6 "`$node["X"].output.error.code`
    → …")인데, "SSRF 가드가 고장났다(=실제 차단이 아니다)" 를 단일 코드로 감지할 방법이 없다 — 두 코드 모두를 알아야 하고, `HTTP_TRANSPORT_FAILED`
    는 진짜 네트워크/TLS/DNS 오류와 뒤섞여 구분이 더 어렵다. 참고로 이 저장소는 정확히 같은 모양의 문제(홉의 SSRF **차단** 판정이 바깥
    일반 catch 로 떨어져 `HTTP_TRANSPORT_FAILED`/`INTEGRATION_CALL_FAILED` 로 오분류되던 것)를 이미 한 번 고쳐 `HTTP_BLOCKED` 로
    통일했다(spec `1-http-request.md:364` Rationale). 이번 PR 은 "차단 판정" 은 그 수정을 그대로 유지하지만, "가드 고장" 케이스에서
    같은 모양의 비대칭을 새로 만든다. `http-connection-tester.ts` 는 preflight/홉 구분 없이 하나의 `try/catch` 로 감싸 둘 다
    `HTTP_CONNECT_FAILED` 로 통일한다(`http-connection-tester.ts:117-153`) — node 만 이 비대칭이 있다. 테스트도 이 갭을 못 잡는다:
    `http-request.handler.spec.ts` 의 신규 테스트(파일 9)는 preflight 비판정만 검증하고, 홉 비판정을 `http-request.handler.ts`
    레벨에서 확인하는 테스트는 없다(RESOLUTION.md INFO 4 는 "`outboundBlockReason` 의 던지는 계약은 `http-redirect.spec.ts` 가
    직접 본다" 로 스코프 아웃 — 하지만 handler 가 그것을 어떤 `code` 로 최종 surface 하는지는 아무 테스트도 보지 않는다).
  - 제안: (1) 지금 당장 코드를 고치기보다, `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 이미 등재된 항목
    ("`1-http-request.md` §4 에 «가드의 고장» 트리거 한 줄")을 planner 가 처리할 때 이 비대칭을 그대로 반영하도록 — "가드 고장 →
    `INTEGRATION_CALL_FAILED`" 라고 단일하게 쓰면 홉의 경우 틀린 문서가 된다. 표에 "preflight 시점" vs "redirect 홉 시점" 을
    구분해 적거나, (2) 근본적으로는 `followRedirectsSafely`/`outboundBlockReason` 이 비판정 오류도 `IntegrationError('INTEGRATION_CALL_FAILED', …)`
    로 승격해 던지게 해 두 시점을 통일하는 편이 API 소비자 입장에서 더 예측 가능하다. 어느 쪽이든 회귀 테스트(홉 비판정을 handler
    레벨에서 주입해 최종 `error.code` 를 단언)를 추가할 것.

- **[INFO]** (이미 추적 중, 참고차 재확인) 판정 아닌 오류의 응답 `message` 는 차단 판정과 다른 마스킹 수준을 쓴다 — 에러
  응답 형식의 일관성 관점에서도 유효한 지적
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts:150`(`clampMessage(sanitizeMessage(detail))`)
    vs 같은 파일의 차단 분기(고정 문구 `DB_HOST_BLOCKED_MESSAGE`), `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts:278`(`sanitizeMessage(detail)`)
    vs 차단 분기(고정 문구), `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:378`(`logError.message` — `toLogError` = `sanitizeMessage`)
    vs 차단 분기(고정 문구 `SSRF_BLOCKED_CLIENT_MESSAGE`).
  - 상세: 차단 판정 응답은 host/IP 를 절대 노출하지 않는 고정 일반화 문구를 쓰는데(CWE-209 대응, spec `1-http-request.md:364`),
    같은 API 응답 스키마(`IntegrationTestResult`/`output.error`) 안에서 "가드 고장" 분기는 `sanitizeMessage`(자격증명 패턴만
    마스킹, host/IP 패턴은 마스킹 대상 아님)를 거친 **원문에 가까운 메시지**를 그대로 내보낸다. 오늘 가드가 낼 수 있는 유일한
    비판정 오류(`isBlockedHostname` 의 `TypeError`, host/IP 미포함)에는 실제 유출이 없다는 것은 `plan/in-progress/ssrf-catch-instanceof.md`
    가 실측했고, 이 비대칭 자체는 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(2026-09-20 등재 항목 "가드
    «고장» 메시지에는 host/IP 마스킹이 없다")에 developer 후속 항목으로 올라가 있다. API 계약 관점에서도 "같은 엔드포인트의 에러
    응답이 코드에 따라 마스킹 보장 수준이 다르다" 는 것은 문서화가 필요한 계약 갭이므로, 그 트래커 항목이 닫힐 때 응답 스키마
    문서(§4.2/§6.2 에러 표)에도 "이 코드의 `message` 는 host/IP 마스킹을 보장하지 않는다" 를 명시하는 편이 좋다.
  - 제안: 별도 조치 불요(이미 계획됨) — 위 트래커 항목이 처리될 때 이 메시지도 함께 반영되는지만 후속 확인.

- **[INFO]** 하위 호환성: 신규 코드 추가 없이 기존 코드(`INTEGRATION_CALL_FAILED`/`HTTP_CONNECT_FAILED`/`DB_CONNECT_FAILED`)를
  재사용해 새 트리거(가드 고장)에 매핑 — breaking change 로 보기 어렵다
  - 상세: `connection-test-codes.ts` 의 닫힌 union(`CONNECTION_TEST_CODES`)과 node 쪽 `ErrorCode` 모두 이번 diff 로 새 멤버가
    추가되지 않았다. 기존 코드를 이미 처리하고 있던 클라이언트(프런트엔드 · 워크플로 조건 분기)는 이 새 트리거가 발동해도 알던
    코드를 그대로 받으므로 컴파일/런타임 실패로 이어지지 않는다. 또한 `plan/in-progress/ssrf-catch-instanceof.md` 29-33행이 "가드가
    오늘 던질 수 있는 것은 전부 `SsrfBlockedError` 뿐이고, 유일한 비판정 경로(`TypeError`)는 `validateCredentials` 가 API 입구에서
    막아 도달 불가" 임을 실측해 두어, 오늘 시점에는 어떤 API 응답도 실제로 바뀌지 않는다(CHANGELOG 미갱신과 일치). 위 첫 WARNING
    이 지적하는 것은 "미래에 가드가 실제로 고장 났을 때" 의 코드 분류 정합성이지, 지금의 하위 호환성 문제가 아니다.
  - 제안: 조치 불요.

- 버전 관리 / URL·경로 설계 / 페이지네이션 / 인증·인가 / 요청 검증: 해당 없음. 엔드포인트·라우트·요청 스키마·인증 로직에는
  손대지 않았고, 변경은 기존 REST 엔드포인트(연결 테스트) 및 노드 실행 결과(`output.error`)의 **에러 분류 내부 로직**에 한정된다.

## 요약

wire 스키마·엔드포인트·인증·페이지네이션은 영향 없고, 재사용하는 에러 코드도 기존 닫힌 union 안이라 하위 호환성 파괴는 없다.
다만 `http-request.handler.ts` 안에서 "SSRF 가드 고장" 이라는 같은 근본 원인이 발생 시점(preflight vs 리다이렉트 홉)에 따라
서로 다른 `output.error.code`(`INTEGRATION_CALL_FAILED` vs `HTTP_TRANSPORT_FAILED`)로 나가는 새로운 비대칭을 이 PR 이 만든다 —
이 저장소가 정확히 같은 모양의 문제를 "차단 판정" 케이스에서는 이미 한 번 고쳐 통일한 전례가 있어(`HTTP_BLOCKED` 통일), 이번에
같은 원칙이 "가드 고장" 케이스에는 적용되지 않은 점이 눈에 띈다. 회귀 테스트도 이 경로(홉 비판정의 최종 `error.code`)를 보지
않는다. 이미 계획된 spec 표 갱신(§4.2 "가드의 고장" 트리거 추가) 작업이 이 비대칭을 반영하지 않으면 문서가 실제 동작과 다시
어긋나므로, 그 작업 전에 반영을 권한다. 응답 메시지 마스킹 비대칭은 이미 별도 트래커 항목으로 등재돼 있어 재확인만 했다.

## 위험도

LOW
