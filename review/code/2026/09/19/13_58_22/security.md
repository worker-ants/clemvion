# 보안(Security) Review — Database · HTTP 연결 테스터

## 발견사항

- **[WARNING]** `preview-test` 가 workspace/role 검증 없이 Database·HTTP 에 실제 TCP 연결을 만드는 오라클이 됐다 — 원본 드라이버 에러 메시지가 (길이만 clamp 되어) 그대로 반환된다
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` (`previewTest`, `@Post('preview-test')` 핸들러 — 컨트롤러 diff 게이트 149~167행), `codebase/backend/src/modules/integrations/integrations.service.ts` (`previewTest()` — diff 게이트 없음, 원본 961~963행 / `dispatchTest()` 원본 1501~1524행), `codebase/backend/src/modules/integrations/database-connection-tester.ts:106-110`, `codebase/backend/src/modules/integrations/http-connection-tester.ts:179-184`
  - 상세: `POST /api/integrations/preview-test` 는 전역 `JwtAuthGuard`(인증)만 통과하면 되고 `@WorkspaceId()`/`@Roles()` 가 없다 — "저장 전 구조 검증뿐, 외부 호출 없음" 이라는 종전 전제 하에 만들어진 낮은 인가 기준이다. 이번 PR 은 그 전제를 `database`·`http` 두 서비스에서 깨뜨려 실제 outbound 연결(pg/mysql TCP 핸드셰이크, HTTP GET)을 수행하게 만들었지만, 인가 모델은 그대로 남았다. 그 결과, 워크스페이스 소속과 무관한 **임의의 인증된 사용자**가 임의의 `host:port`(사설/loopback 대역만 SSRF 가드로 차단, 공인 대역은 통과)를 지정해 분당 20회(사용자별 throttle)로 연결을 시도할 수 있고, 응답은 `DB_HOST_BLOCKED`(차단, 호스트 비노출) / `DB_AUTH_FAILED` / `DB_CONNECT_FAILED`(원본 드라이버 에러, 길이만 clamp) 세 갈래로 구분된다. `DB_CONNECT_FAILED`/`HTTP_CONNECT_FAILED` 경로는 `err.message`(`describeFailure`)를 그대로 노출하므로 ECONNREFUSED(닫힌 포트)·타임아웃(방화벽 드롭)·TLS 핸드셰이크 실패·프로토콜 핸드셰이크 실패(열린 포트지만 DB 아님)를 서로 구분할 수 있는 오라클이 된다 — 플랫폼의 아웃바운드 IP 를 프록시 삼아 공인 인터넷 대상에 대한 blind 포트스캔/네트워크 정찰에 재사용될 수 있다. `mcp`·`email` 테스터도 같은 인가 모델을 공유하지만(사전 존재), 이번 변경으로 "실제 TCP 연결" 이 가능한 서비스 종류가 2개 늘어 오라클의 활용가치(포트 스캔 대상 프로토콜 폭)가 커졌다.
  - 제안: (a) `preview-test` 에도 최소한의 workspace 컨텍스트/요청 빈도 하한(예: workspace 당 합산 throttle) 을 도입하거나, (b) `DB_CONNECT_FAILED`/`HTTP_CONNECT_FAILED` 메시지를 SSRF 차단 경로처럼 일반화된 문구로 대체하고 원본은 서버 로그에만 남기거나, (c) 최소한 이 트레이드오프가 의도적 accepted risk 인지 spec/plan 에 명시(Rationale) — 현재는 어느 문서에도 "preview-test 인가 모델이 실제 outbound 능력과 짝이 안 맞는다" 는 언급이 없다.

- **[INFO]** DNS rebinding TOCTOU — SSRF 재검증과 실제 접속 사이에 재해석 창구가 남아있다(기존에 문서화된 accepted risk, 이번 PR 이 새로 만든 것은 아님)
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts:119-127`(주석 자체가 "Race window" 명시) — `codebase/backend/src/modules/integrations/database-connection-tester.ts:82-96`, `codebase/backend/src/modules/integrations/http-connection-tester.ts:27-37`가 각각 `assertSafeOutboundHostResolved` 호출 뒤 별도 시점에 pg/mysql 드라이버·`fetch` 가 다시 DNS 를 조회한다.
  - 상세: 두 신규 테스터 모두 HTTP Request 노드/Database Query 노드와 같은 기존 SSRF 유틸을 그대로 재사용했고, 유틸 자체 주석이 이미 "sufficiently fast attacker can flip DNS between this check and the subsequent fetch/connect" 를 인정하며 egress 방화벽으로 defense-in-depth 하라고 안내한다. 새로 도입된 리스크는 아니지만, `preview-test` 인가 모델 이슈(위 WARNING)와 결합하면 워크스페이스 소속 없이도 이 창구를 반복 시도할 수 있는 대상이 넓어진다는 점만 참고로 남긴다.
  - 제안: 별도 조치 불요(기존 accepted risk). 위 WARNING 을 해결한다면 이 리스크의 노출 대상도 함께 줄어든다.

- **[INFO]** SSRF 차단 메시지의 host/IP 비노출 원칙은 준수됨 — 재확인만
  - 위치: `codebase/backend/src/nodes/integration/database-query/database-connection.ts:25-26`(`DB_HOST_BLOCKED_MESSAGE`), `codebase/backend/src/nodes/integration/http-request/http-safety.ts:24-28`(`SSRF_BLOCKED_CLIENT_MESSAGE`), `codebase/backend/src/modules/integrations/database-connection-tester.ts:184-192`, `codebase/backend/src/modules/integrations/http-connection-tester.ts:32-36`
  - 상세: 차단된 host/IP 원문은 `logger.warn` 서버 로그에만 남고 클라이언트 응답 문구는 일반화된 상수 — 기존 `#814` SSRF 에러 메시지 일반화 결정과 일치. 새 e2e(`integration-connection-test.e2e-spec.ts` A·B)도 `message` 에 host 문자열이 없음을 실제로 단언한다. 새로 도입된 코드가 이 원칙을 정확히 따르고 있음을 확인.
  - 제안: 없음(정보용).

- **[INFO]** `basic`/`api_key`/`bearer_token` 자격증명이 헤더 값으로 그대로 들어가지만 CRLF 등 헤더 인젝션 문자에 대한 명시적 sanitize 는 없다
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-credentials.ts:52-101`(`resolveHttpCredentials`)
  - 상세: `Authorization: Bearer ${token}` / `Basic ${encoded}` / `{ [keyName]: value }` 형태로 사용자 입력이 헤더 이름·값에 바로 들어간다. Node 의 `fetch`(undici)가 Fetch 표준에 따라 헤더 이름/값에 포함된 제어문자(CR/LF 등)를 만나면 `TypeError` 를 던져 요청 자체가 실패하므로 실질적인 HTTP 헤더 인젝션으로 이어지지는 않는 것으로 보이나(예외는 `catch` 로 흡수되어 `HTTP_CONNECT_FAILED` 가 됨), 명시적 방어가 아니라 런타임 구현 세부에 의존하고 있다는 점만 기록한다.
  - 제안: 별도 조치는 낮은 우선순위. 필요하면 `keyName`/`value` 를 헤더 안전 문자 집합으로 사전 검증해 명시적 방어를 추가할 수 있다.

## 요약

이번 변경은 Database·HTTP 통합의 연결 테스트가 실제로 접속하도록 만들어 "틀린 자격증명도 성공으로 표시" 되던 정확성 결함을 고쳤고, SSRF 가드·SSL 강제(`rejectUnauthorized: true`)·차단 메시지 host 비노출·리소스 정리(연결 close)·타임아웃 상한 등 기존 보안 관례를 신규 코드에 일관되게 재적용했다. SQL 인젝션(정적 `SELECT 1`), 하드코딩 시크릿, 안전하지 않은 암호화 알고리즘 등 직접적인 OWASP Top 10 결함은 발견되지 않았다. 가장 눈에 띄는 리스크는 인젝션류가 아니라 **인가 모델과 새로 활성화된 outbound 능력 사이의 불일치**다 — `preview-test` 엔드포인트는 "외부 호출을 하지 않는다" 는 전제로 workspace/role 검증 없이 설계됐는데, 이 전제가 `database`·`http` 두 서비스에서 깨졌음에도 인가 모델은 재검토되지 않아, 임의의 인증된 사용자가 플랫폼을 프록시 삼아 임의 공인 호스트에 대한 제한적 포트스캔/네트워크 정찰 오라클로 남용할 수 있는 여지가 남는다. DNS rebinding TOCTOU 는 기존에 문서화된 accepted risk로 이번 PR 이 새로 만든 것은 아니다.

## 위험도

MEDIUM
