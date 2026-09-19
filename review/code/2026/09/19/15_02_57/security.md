# Security Review — Database · HTTP 연결 테스트 (integration-testers-5c2d91)

## 발견사항

- **[WARNING]** `preview-test` 가 워크스페이스/역할 검사 없이 임의 공개 host 에 실제 TCP 접속(Database) · HTTP GET 을 수행하는 인증-후 오라클이 됐다 — 아직 미해소
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts:149-163` (`previewTest` 데코레이터·JSDoc — 실제 메서드 시그니처는 `previewTest(@Body() body: PreviewTestDto)` 로 `@WorkspaceId()`·`@CurrentUser()`·`@Roles(...)` 중 어느 것도 받지 않는다, 라인 미변경이라 diff 게이트 없음)
  - 상세: `JwtAuthGuard`(전역, `app.module.ts:209`)만 통과하면 어느 워크스페이스에도 속하지 않아도 `POST /api/integrations/preview-test` 를 호출할 수 있다(`@Throttle` 20/min 뿐, `@Roles`/`@WorkspaceId` 없음 — 다른 라우트와 대조된다, 예: `rotate()` 는 `@Roles('editor')` + `requireEntity(id, workspaceId)`). 이 PR 전에는 이 엔드포인트가 필드 구조만 검사해 외부 호출이 전혀 없었다(JSDoc 개정 전 문구: "no outbound HTTP is performed"). 이제 `serviceType: 'database'`·`'http'` 조합은 `testDatabaseConnection`/`testHttpConnection` 이 실제로 접속해, `DB_AUTH_FAILED`/`DB_CONNECT_FAILED`/`HTTP_AUTH_FAILED`/`HTTP_SERVER_ERROR`/`HTTP_CONNECT_FAILED`(clamp 된 드라이버 원문 포함) 를 구분해 돌려준다. 즉 인증된 임의 사용자가 자신이 속하지 않은 워크스페이스와 무관하게, 공개 인터넷의 임의 host:port 에 대해 "포트 열림/거부/타임아웃/TLS 실패/인증 거부" 를 구분하는 신호를 최대 분당 20회로 지속적으로 얻을 수 있다 — 제한적 포트 스캐너 · 내부망 SSRF 정찰(사설 대역 자체는 `assertSafeOutboundHostResolved` 가 막는다)로 쓰일 수 있다.
  - 제안: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(2026-09-19 항목, `/ai-review 13_58_22` security WARNING 근거)에 planner 결정 대기로 등재돼 있다 — 이번 diff(`eebf0286a`, `edd468476`)에서도 해소되지 않았음을 확인. 옵션: (a) `preview-test` 에 `@WorkspaceId`/워크스페이스 멤버십 요구, (b) 실패 메시지를 더 일반화(진단성과 맞바꿈), (c) spec Rationale 에 받아들인 위험으로 명시. 셋 중 하나를 이번 트래커 turn 에서 확정할 것을 권고.

- **[INFO]** Database · HTTP 연결 테스트의 SSRF 가드에 DNS-rebinding TOCTOU 창이 있고, 이번 PR 로 Database 접속에도 같은 패턴이 처음 적용됐다
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts:119-131` (`assertSafeOutboundHostResolved(creds.host)` 검사 뒤 `probePostgres`/`probeMysql` 호출), `codebase/backend/src/nodes/integration/http-request/http-safety.ts:120-131`(`assertSafeOutboundHostResolved` 자체의 "Race window" 주석)
  - 상세: `assertSafeOutboundHostResolved` 는 자체 문서에 "a sufficiently fast attacker can flip DNS between this check and the subsequent fetch/connect" 라고 명시한 기존 설계(HTTP Request 노드·Database Query 노드가 이미 공유)다. 이번 PR 은 이 가드를 그대로 재사용해 Database 커넥션 테스터에도 적용했다 — 새로운 취약점 클래스는 아니지만(디자인 문서화·기존 노드 실행 경로와 동일 위험), 공격 표면이 "노드 실행"에서 "저장 전 preview-test"(워크스페이스 무관, 위 WARNING)로 넓어졌다는 점에서 실제 악용 난이도가 낮아졌다.
  - 제안: 기존에 문서화된 대로 egress 방화벽을 defense-in-depth 로 두거나, `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "해석한 IP 로 직접 연결" 항목을 근본 해법으로 우선순위를 올리는 것을 고려. 이번 PR 단독으로 막을 필요는 없음(이미 트래커에 있음).

- **[INFO]** 연결 테스트 동시 실행 상한(`pLimit(2)`)이 워크스페이스 구분 없이 프로세스 전역 공유 + 대기열 무제한
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:127`(`CONNECTION_TEST_MAX_CONCURRENCY = 2`), `:409-411`(`connectionTestLimit = pLimit(CONNECTION_TEST_MAX_CONCURRENCY)`), `:1545`(`this.connectionTestLimit(() => tester(authType, credentials))`)
  - 상세: 이전 라운드(리뷰 `13_58_22`)의 libuv 스레드풀 고갈 CRITICAL 을 이번 PR 이 상한 2 + `closeWithin` 타임아웃 파괴로 완화했다(양호). 다만 이 상한은 워크스페이스별이 아니라 프로세스 전역이고 대기열 길이 제한이 없다 — 한 워크스페이스가 응답하지 않는 DNS 를 가리키는 연결 테스트를 반복 요청하면(`@Throttle` 20/min 내에서도 가능) 두 슬롯을 계속 점유해 다른 워크스페이스의 연결 테스트 기능을 지연시킬 수 있다(프로세스 전체 다운은 아님). 이미 `spec-draft-nullable-notation-followups.md` "연결 테스트의 dns.lookup 이 스레드풀을 쥔다" 항목의 잔여로 낮은 우선순위 트래커에 등재돼 있다.
  - 제안: 트래커 항목대로 defer 유지 가능. 필요 시 워크스페이스별 최대 동시 요청 수 또는 대기열 상한을 후속 검토.

- **[INFO]** 드라이버·전송 오류 원문이 길이 제한(clamp)만 적용된 채 preview-test 응답에 그대로 실린다
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts:145`(`message: clampMessage(err instanceof Error ? err.message : String(err))`), `codebase/backend/src/modules/integrations/http-connection-tester.ts:168`(`message: clampMessage(describeFailure(err))`)
  - 상세: `clampMessage` 는 길이만 제한하고(`MCP_ERROR_MESSAGE_MAX_LEN`) 내용은 그대로 통과시킨다. 위 WARNING(워크스페이스 무관 preview-test)과 결합하면, 인증된 임의 사용자가 임의 공개 host:port 에 대해 `ECONNREFUSED`/`ENOTFOUND`/TLS handshake 실패/`ETIMEDOUT` 등 드라이버별 세분화된 오류를 그대로 받아볼 수 있어 정찰 정밀도를 높인다. host/IP 자체는 SSRF 차단 메시지(`DB_HOST_BLOCKED_MESSAGE`/`SSRF_BLOCKED_CLIENT_MESSAGE`)에서는 이미 일반화돼 있어(CWE-209 대응, 의도적) 이 항목은 그 범위 밖(공개 host 대상 성공/실패 세부) 이야기다.
  - 제안: 위 WARNING 해소책(워크스페이스 스코프 요구 또는 메시지 추가 일반화)에 자연히 흡수됨 — 별도 조치 불요, 같은 결정에 묶어 처리 권고(이미 트래커 문구가 그렇게 요청함).

- **[INFO]** SSL 검증 강제(`verify-full`/`require` → `rejectUnauthorized: true`)는 이번 diff 로 새로 만들어진 코드가 아니라 기존 로직의 단순 이동
  - 위치: `codebase/backend/src/nodes/integration/database-query/database-connection.ts:36-44`(`buildPgConnection`), `:55-61`(`buildMysqlSsl`)
  - 상세: 확인 목적의 negative 항목 — MITM 방지를 위해 `rejectUnauthorized: false` 로 기본값을 두지 않는다는 기존 결정이 그대로 보존됐다(코드·주석 동일, `database-query.handler.ts` 에서 옮겨온 것 뿐). 새 취약점 없음.

## 요약

인젝션(SQL/커맨드/헤더)·하드코딩 시크릿·평문 저장·과도한 에러 노출(host/IP 차원)은 발견되지 않았다. 자격증명 암호화(rotate 시 IV 갱신 확인 e2e 존재), TLS 강제 검증, SSRF 가드(사설 대역·loopback·CGNAT 차단), 동시 실행 상한(이전 CRITICAL 완화) 등 핵심 방어는 이번 PR 과 이전 리뷰 라운드를 거치며 견고해졌다. 남은 실질 이슈는 하나 — `preview-test` 엔드포인트가 워크스페이스/역할 검사 없이 인증만으로 호출 가능한데, 이번 PR 로 Database·HTTP 서비스 타입에 대해 "구조 검증"에서 "실제 접속 확인"으로 성격이 바뀌면서 제한적 포트 스캐너/오라클로 오용될 여지가 커졌다. 이는 이미 이전 리뷰 라운드(13_58_22)에서 지적돼 트래커(`spec-draft-nullable-notation-followups.md`)에 planner 결정 대기로 등재된 사안으로, 이번 diff 로도 해소되지 않은 상태다. 새로 발견된 Critical 은 없다.

## 위험도
MEDIUM
