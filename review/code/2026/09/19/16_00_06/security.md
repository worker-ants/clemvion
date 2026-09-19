# 보안(Security) 리뷰 — integration-testers-5c2d91 (Database · HTTP 연결 테스트)

## 범위

`spec/2-navigation/4-integration.md`(§5.3·§5.4·§9.2)와 이를 구현하는 신규 `database-connection-tester.ts` ·
`http-connection-tester.ts` · 공유 모듈(`database-connection.ts` · `http-credentials.ts` · `http-redirect.ts`),
`IntegrationsService.rotate()`/`dispatchTest()` 변경, 관련 unit/e2e 테스트, CHANGELOG · 문서 · plan/`review/consistency`
산출물. 소스는 `Read`/`git diff origin/main...HEAD -- <path>` 로 원본을 직접 대조했다(프롬프트 번들이 일부 파일 diff 를
크기 제한으로 생략했기 때문).

## 발견사항

- **[INFO]** `preview-test`/`rotate`/`:id/test` 가 DB·HTTP 에 실제 접속하게 되면서, 인증된 workspace 사용자가 임의
  공인 호스트에 대해 "포트가 열려 있는지 · 인증을 요구하는지"를 구분해 응답받을 수 있는 blind 포트스캔/서비스
  핑거프린팅 표면이 넓어진다 (SSRF 자체는 아니고, 이미 SSRF 가드로 사설/loopback 은 막힌 상태에서의 정찰 표면).
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` `preview-test` 핸들러(라인
    159 부근, `@Throttle({ default: { limit: 20, ttl: 60_000 } })`), `codebase/backend/src/modules/integrations/database-connection-tester.ts` `testDatabaseConnection`, `codebase/backend/src/modules/integrations/http-connection-tester.ts` `testHttpConnection`
  - 상세: `DB_HOST_BLOCKED`(사설/차단) / `DB_AUTH_FAILED`(포트 열림+인증서버 확인) / `DB_CONNECT_FAILED`(그 외) 세
    코드가 그대로 클라이언트에 노출돼, 임의 공인 IP:port 가 postgres/mysql 을 구동 중인지 구분 가능한 오라클이
    된다(HTTP 쪽은 401/403/기타4xx/5xx 로 더 세밀). 이 자체는 기능 요구사항(spec §5.3·§5.4)이 의도한 동작이고, 이미
    존재하던 HTTP Request/Database Query 노드 실행 경로로도 비슷한 정찰이 가능했으므로 **새로운 취약점 클래스는
    아니다** — 다만 워크플로 실행(생성·저장 필요)보다 훨씬 낮은 진입장벽(요청 1회, 분당 20회)으로 이 정찰이
    가능해졌다는 점은 위협 모델에 기록해 둘 가치가 있다.
  - 제안: 조치 불요(설계 의도). 다만 이 endpoint 의 rate limit(20/min)과 동시 실행 상한(`CONNECTION_TEST_MAX_CONCURRENCY=2`)이
    이 표면의 유일한 완화책이라는 점을 spec Rationale 이나 위협모델 문서에 한 줄 남겨 두면 다음 변경(예: throttle 완화)
    시 이 트레이드오프가 재검토 없이 사라지는 것을 막을 수 있다.

- **[INFO]** DNS rebinding TOCTOU 윈도우가 신규 Database/HTTP 테스터에도 그대로 적용된다(신규 결함 아님, 기존
  주석에 이미 문서화된 한계).
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts` `assertSafeOutboundHostResolved`
    (주석 "Race window: a sufficiently fast attacker can flip DNS…"), 호출부는
    `codebase/backend/src/modules/integrations/database-connection-tester.ts:137`
    (`await assertSafeOutboundHostResolved(creds.host)` 뒤 `probePostgres`/`probeMysql` 이 드라이버 자체
    DNS 로 재해석), `codebase/backend/src/nodes/integration/http-request/http-redirect.ts` `outboundBlockReason`
    (검사 후 `fetch` 가 재해석).
  - 상세: SSRF 가드가 hostname 을 검사한 시점과 실제 드라이버/undici 가 같은 hostname 을 다시 resolve 해 접속하는
    시점 사이에 attacker-controlled DNS 가 응답을 바꾸면(짧은 TTL 로 공인 IP → 사설 IP) 검사를 통과한 뒤 사설
    네트워크에 접속할 수 있다. 기존 HTTP Request 노드가 이미 안고 있던 한계를 그대로 상속했을 뿐 이 PR 이
    새로 만든 문제는 아니다.
  - 제안: 조치 불요(기존에 공개적으로 인지·문서화된 defense-in-depth 한계, egress 방화벽 병행을 권고 문구로 이미
    명시). 재발 방지 차원에서 언급.

- **[INFO]** 일반 연결 실패(`DB_CONNECT_FAILED`/`HTTP_CONNECT_FAILED`) 메시지는 SSRF 차단 메시지와 달리
  드라이버/fetch 원문(길이만 클램프)을 그대로 클라이언트에 돌려준다 — "비밀번호는 드라이버 원문에 없다"는 spec
  서술은 코드가 강제하는 불변식이 아니라 드라이버 동작에 대한 가정이다.
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts` `testDatabaseConnection`
    catch 분기(`message: clampMessage(err instanceof Error ? err.message : String(err))`),
    `codebase/backend/src/modules/integrations/http-connection-tester.ts` `describeFailure`/`testHttpConnection`
    catch 분기(`message: clampMessage(describeFailure(err))`).
  - 상세: pg/mysql2 가 정상적으로는 비밀번호를 에러 메시지에 싣지 않지만, 이는 서드파티 라이브러리 동작에 대한
    가정이며 코드에서 명시적으로 스크럽하지 않는다. 대상 host 는 이미 SSRF 가드를 통과한 통합 소유자 본인이
    등록한 값이라 위험도는 낮다(제3자 정보 노출이 아니라 본인 자격증명 관련 자기-노출).
  - 제안: 필수는 아니지만, 저비용 방어로 `clampMessage` 직전에 요청에 실렸던 `password`/`value`/`token` 원문
    부분 문자열을 마스킹하는 스크럽을 추가하면 드라이버 동작 변경(예: 향후 mysql2/pg 버전이 상세 진단 메시지에
    자격증명을 echo 하기 시작하는 경우)에도 안전망이 된다.

## 정합성 확인 (검토했으나 문제 없음)

- **인젝션**: DB 테스터는 `SELECT 1` 리터럴만 실행하고 자격증명은 드라이버 connection-options 객체(host/port/
  database/user/password/ssl)로만 전달된다 — 문자열 결합 없음, SQL 인젝션 경로 없음. `buildPgConnection`/
  `buildMysqlSsl`(`database-connection.ts`)은 raw credentials 를 스프레드하지 않고 알려진 필드만 명시적으로
  매핑해 드라이버 옵션에 임의 키를 주입할 수 없다.
- **하드코딩 시크릿**: diff 전체(`CHANGELOG.md`·plan·e2e 테스트 포함)에서 실제 시크릿 패턴 없음. e2e 테스트의
  `clemvion-e2e`/`e2e-token-old` 류는 docker-compose 전용 더미 값.
- **인증/인가**: `rotate()` 는 여전히 `requireEntity(id, workspaceId)` 로 workspace 범위를 먼저 확인한 뒤
  그 `entity.id` 로만 `update`/재조회를 수행한다 — `save()` → `update()`+`findOne()` 전환에서 workspace 검증이
  누락되거나 다른 workspace 의 row 를 건드릴 수 있는 경로는 없다.
- **암호화**: `rotate()` 가 엔티티 전체 `save()` 대신 부분 `update()` 로 바뀌면서 컬럼 transformer
  (`encryptedJsonTransformer`, `entities/integration.entity.ts`)가 여전히 적용되는지가 핵심 우려였는데,
  실제 DB 를 쓰는 `codebase/backend/test/integration-connection-test.e2e-spec.ts` 테스트 E 가 회전 뒤 저장된
  ciphertext 가 평문 secret 을 포함하지 않음을 명시적으로 단언해 검증한다 — 평문 저장 회귀 없음.
- **TLS**: `database-connection.ts` `buildPgConnection`/`buildMysqlSsl` 은 `ssl: 'require'`/`'verify-full'`
  둘 다 `rejectUnauthorized: true` 를 강제한다(과거 `require` 가 인증서 미검증으로 MITM 에 열려 있던 문제를
  이미 고친 상태를 그대로 이동한 것 — 이 PR 의 회귀 아님, 오히려 유지).
- **정보 노출 일반화**: SSRF 차단 시 클라이언트 메시지는 `SSRF_BLOCKED_CLIENT_MESSAGE`/`DB_HOST_BLOCKED_MESSAGE`
  로 일반화되고 원본 host/IP 는 `logger.warn` 서버 로그에만 남는다 — unit spec(`http-connection-tester.spec.ts`
  "host 가 사설 IP 로 해석돼도 HTTP_BLOCKED", `database-connection-tester.spec.ts` 해당 host 미노출 단언)과
  e2e A·B 케이스가 실측으로 확인한다.
- **동시성/DoS**: `IntegrationsService` 에 추가된 `pLimit(CONNECTION_TEST_MAX_CONCURRENCY=2)` 는 `dns.lookup`
  이 libuv 스레드풀을 소진해 무관한 `fs`/`crypto`/`zlib` 작업까지 멈추는 프로세스 전역 DoS 를 완화한다 — 공격
  표면을 없애진 않지만(동시에 2개까지는 여전히 오래 걸리는 대상으로 슬롯을 쥘 수 있음) 무제한 동시 실행보다는
  개선이다.
- **리다이렉트 SSRF**: `http-redirect.ts` `followRedirectsSafely` 로 리팩터링된 뒤에도 홉 수 상한(5)·홉마다
  재검사·fetch 호출 횟수(6회, off-by-one 없음)가 리팩터 전과 동일함을 `http-request.handler.spec.ts` 신규
  단언(`toHaveBeenCalledTimes(6)`)으로 확인했다 — 리팩터로 인한 SSRF 우회 회귀 없음.
- **입력 검증**: `dispatchTest` 는 `validateCredentials`(service-registry 기반)로 `host`/`base_url` 등 필수
  필드 존재·타입을 테스터 호출 전에 강제한다 — `creds.host` 가 비어 SSRF 검사를 우회하는 경로는 `database`
  서비스 등록에서 `host: required: true` 로 막혀 있다.
- **헤더 인젝션**: `resolveHttpCredentials` 가 만드는 `headers[keyName]`/`Authorization` 값은 fetch/undici 의
  Headers 검증(Fetch 표준 ByteString/CRLF 금지)을 통과해야 하므로 CRLF 헤더 인젝션 경로가 없고, 애초에 값이
  워크스페이스 관리자가 등록한 저장된 자격증명이라 런타임 공격자 입력이 아니다.

## 요약

핵심 변경은 그동안 "필드 형식만 확인하고 항상 성공"으로 응답하던 Database·HTTP 연결 테스트를 실제 접속으로
바꾸는 보안 개선(잘못된 자격증명·만료 토큰도 통과하던 결함 해소)이다. 새로 열리는 표면(SSRF, 정찰, 동시성 DoS)은
기존에 검증된 SSRF 가드(`http-safety.ts`)를 노드 실행과 동일하게 재사용하고, 차단 메시지를 일반화하고, 동시
실행 상한(`pLimit(2)`)을 추가하는 방식으로 체계적으로 완화했으며, 그 완화가 실제로 동작함을 unit spec 과 실제
DB/네트워크를 쓰는 e2e spec(SSRF 미노출·리다이렉트 재검사·암호화 유지·workspace 범위 유지)이 모두 검증한다.
CRITICAL/WARNING 급 결함은 발견하지 못했다. 위에 적은 세 INFO 는 신규 결함이 아니라 이미 알려졌거나 설계
트레이드오프로 받아들여진 잔여 리스크에 대한 기록이다.

## 위험도

LOW
