# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 은 없다. Database·HTTP 연결 테스트를 "구조 검증만"에서 "실접속"으로 바꾸는 이번 변경은 SSRF 가드 재사용·동시 실행 상한·경계값 테스트가 잘 갖춰져 있으나, `concurrency`·`side_effect` 두 reviewer 가 공통으로 지적한 **entity tester 재진입 데드락 계약 미강제**와 **SSRF preflight DNS lookup 무제한 대기**가 이 PR 이 스스로 세운 "슬롯은 영구히 잡히지 않는다"는 안전 전제를 약화시킬 수 있어 MEDIUM 으로 판정한다. forced whitelist(documentation·maintainability·requirement·scope·security·side_effect·testing) 는 전원 결과를 확보했고 누락된 reviewer 는 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성/아키텍처 | `registerEntityTester` 확장점의 "entity tester 는 `testConnection`/`previewTest`/`rotate` 를 재진입 호출하면 안 된다"는 계약이 JSDoc 에만 있고 런타임 가드가 없다. `connectionTestLimit = pLimit(2)`(상한 2)를 위반하면 두 슬롯이 서로를 영원히 기다리는 프로세스 전역 데드락이 된다. 현재 등록된 Cafe24·MakeShop 테스터는 위반하지 않지만 타입 시스템도, 런타임도 이를 강제하지 않는다 | `codebase/backend/src/modules/integrations/integrations.service.ts` (`registerEntityTester` JSDoc ~464-472, `connectionTestLimit` 필드, `testConnection` 984행, `dispatchTest` 1570행) | 재진입 감지 가드(예: `AsyncLocalStorage`/카운터로 "슬롯 안에서 실행 중" 표시 후 재호출 시 즉시 throw) 또는 세마포어 획득 타임아웃 추가. 최소한 위반 시 fail-fast 하는 회귀 테스트 1건 추가 |
| 2 | 동시성 | SSRF preflight `assertSafeOutboundHostResolved` (DNS lookup) 이 어떤 타임아웃에도 감싸이지 않은 채 `CONNECTION_TEST_MAX_CONCURRENCY=2` 라는 극히 좁은 슬롯 안에서 실행된다. HTTP 리다이렉트는 홉마다 이를 재호출하는데, 이 lookup 은 `AbortSignal.timeout(10_000)` 예산 밖에 있다 — "슬롯당 최대 26초/20초"라는 이 PR 의 안전 마진 계산이 근거로 삼은 실측(musl 환경 1회 `EAI_AGAIN` 5.0초)이 다른 환경(glibc 다중 nameserver 등)에서 깨지면, 이 PR 이 고치려던 "느린 DNS 가 슬롯을 영원히 쥔다" 문제가 새로 추가된 preflight 단계에서 재현될 수 있다 | `codebase/backend/src/modules/integrations/database-connection-tester.ts:137`, `codebase/backend/src/nodes/integration/http-request/http-redirect.ts` (`outboundBlockReason`, 홉마다 27/67행 재호출), `codebase/backend/src/modules/integrations/http-connection-tester.ts:115-123` (preflight 이 `AbortSignal.timeout` 생성 이전에 실행) | `closeWithin` 과 같은 `Promise.race([lookup, timeout])` 패턴으로 preflight DNS 에도 명시적 상한을 걸거나, HTTP 쪽은 preflight 을 timeout 생성 이후로 옮기고 hop 간 검사도 같은 signal 로 취소 가능하게 만들 것 |
| 3 | 동시성/DB | `rotate()` 의 read-test-write 구간이 동시 `rotate` 호출 사이의 lost-update 를 막지 못한다 — `merged = {...baseCreds, ...body.credentials}` 를 조건 없이 `update` 로 덮어써, 두 rotate 요청이 겹치면 먼저 끝난 쪽이 바꾼 필드가 나중 요청의 base 값으로 조용히 되돌아갈 수 있다(양쪽 다 200+감사로그를 받으므로 호출자는 눈치채지 못함). 이번 PR 이 `rotate` vs `logUsage` 경쟁은 정확히 고쳤지만 `rotate` vs `rotate` 경쟁은 다루지 않았다 — 이 diff 가 새로 만든 결함은 아니나(merge 구조 자체는 기존), admin 저빈도 동작이라 발생 확률은 낮다 | `codebase/backend/src/modules/integrations/integrations.service.ts` `rotate()` (1080-1113행 merge, 1139행 `update`) | `update` 에 `WHERE id=:id AND updated_at=:readAt`(또는 version 컬럼) 조건부 갱신을 걸어 0 rows 면 409/재시도 유도, 또는 id 단위 advisory lock 으로 같은 integration 의 rotate 를 직렬화 |
| 4 | 유지보수성 | 신규 `DB_*`/`HTTP_*` 결과 코드(`DB_AUTH_FAILED`·`DB_CONNECT_FAILED`·`HTTP_AUTH_FAILED`·`HTTP_SERVER_ERROR`·`HTTP_CONNECT_FAILED` 등)가 `MCP_ERROR_CODES` 같은 중앙 `as const` 상수 없이 프로덕션 코드·`*.spec.ts`·e2e 여러 파일에 원시 문자열 리터럴로 반복된다 — 같은 디렉터리의 기존 관례(오타를 컴파일 에러로 만드는 것)와 어긋난다 | `codebase/backend/src/modules/integrations/database-connection-tester.ts`, `http-connection-tester.ts` (및 대응 `*.spec.ts`/e2e) | `DatabaseTestErrorCode`/`HttpTestErrorCode`(또는 통합 `CONNECTION_TEST_ERROR_CODES`) `as const` 객체를 만들어 테스터·스펙·e2e 가 참조하게 함 |
| 5 | 테스트 | `buildMysqlSsl('require'\|'verify-full') → { rejectUnauthorized: true }` 매핑(MITM 방지, 노드 실행과 연결 테스트가 공유하는 보안-민감 코드)이 postgres 쪽만 `rejectUnauthorized` 를 단언하고 mysql 쪽은 직접 검증되지 않는다(저장소 전체 grep 1건 = postgres 뿐) | `codebase/backend/src/nodes/integration/database-query/database-connection.ts:55-61`, `codebase/backend/src/modules/integrations/database-connection-tester.spec.ts:149-154` | mysql `describe` 블록에 `it.each(['require','verify-full'])` 로 `expect.objectContaining({ssl:{rejectUnauthorized:true}})` 대칭 추가 |
| 6 | 테스트 | `database-driver-sockets.spec.ts` 가 unit 계층(`npm test`, mock 기반 관례)에 있으면서 mysql2 케이스에서 실제 루프백 TCP 연결을 즉시 시도한다(pg 케이스는 `.connect()` 를 안 불러 실제 연결 없음 — 비대칭). 소켓 정책이 엄격한 CI 샌드박스에서 다르게 동작할 여지, 앞쪽 `expect` 실패 시 `stream.destroy()` 정리가 실행되지 않는 부수효과 있음(위험은 낮음) | `codebase/backend/src/modules/integrations/database-driver-sockets.spec.ts:18-37` | 소켓 정리를 `try/finally` 로 감싸고, 파일 상단 주석에 "이 spec 은 예외적으로 실제 소켓을 쓴다"를 명시 |
| 7 | 문서화 | `SMTP_BLOCK_PRIVATE_HOSTS` 라는 존재하지 않는 환경변수를 가리키는 주석이 2곳에 복제돼 있고, 실제 구현(`ALLOW_PRIVATE_HOST_TARGETS`, opt-out 방식)과 이름·방향(opt-in↔opt-out) 모두 반대다. 이 PR 이전부터 있던 주석(PR #350)이지만, 이번 PR 이 같은 파일·같은 테마(3-way SSRF 가드 공유)를 광범위하게 문서화하면서 인접 모순을 놓쳤다 | `codebase/backend/src/modules/integrations/integrations.service.ts:1594`, `codebase/backend/src/nodes/integration/send-email/send-email.handler.ts:176` | "SSRF 완화 (opt-out) — `ALLOW_PRIVATE_HOST_TARGETS=true` 가 아니면 사설/loopback host 를 차단" 으로 정정, 스코프 밖이면 트래커에 등재 |
| 8 | API 계약 | `rotate()` 의 `INTEGRATION_TEST_FAILED` 가 `BadRequestException`(400)인데 spec §9.4 는 422 로 정의 — 기존 불일치(`ae8f9cfd9`부터)이지만 이번 PR 이 Database·HTTP 의 새 실패 코드까지 같은 400 경로에 태워 도달 가능 범위를 넓혔다. 신규 e2e(케이스 D)는 상태 코드를 정확히 단언하지 않도록 신중히 작성돼 이 불일치를 고정시키지는 않음 | `codebase/backend/src/modules/integrations/integrations.service.ts` `rotate()`, spec `spec/2-navigation/4-integration.md §9.4` | 이번 PR 을 막을 사안 아님(이미 트래커 등재, e2e 도 회피). 트래커 완료 시 `spec/5-system/11-mcp-client.md:539`(400 근거)·`spec/5-system/2-api-convention.md §6`(422 원칙) 두 근거를 함께 남길 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `preview-test`/`rotate`/`:id/test` 실접속화로, 인증된 사용자가 임의 공인 host 에 대해 포트/서비스 판별이 가능한 blind 정찰 표면이 워크플로 실행보다 낮은 진입장벽(요청 1회, 20/min)으로 넓어졌다(신규 취약점 클래스는 아님, HTTP Request/Database Query 노드로도 기존에 가능) | `integrations.controller.ts` preview-test, `database-connection-tester.ts`, `http-connection-tester.ts` | 조치 불요 — rate limit(20/min)+동시 상한(2)이 유일한 완화책임을 위협모델/Rationale 에 한 줄 기록 권장 |
| 2 | 보안 | DNS rebinding TOCTOU(가드 통과 후 드라이버가 hostname 을 재해석하는 사이 공격자가 DNS 응답을 바꿀 여지)가 신규 테스터에도 그대로 상속됨 — 기존에 문서화된 defense-in-depth 한계, 이 PR 신규 결함 아님 | `http-safety.ts` `assertSafeOutboundHostResolved`, `database-connection-tester.ts:137`, `http-redirect.ts` | 조치 불요(egress 방화벽 병행 권고 이미 명시) |
| 3 | 보안 | 일반 연결 실패 메시지(`DB_CONNECT_FAILED`/`HTTP_CONNECT_FAILED`)는 드라이버/fetch 원문을 클램프만 해서 그대로 노출 — "비밀번호는 드라이버 원문에 없다"는 가정이 코드가 강제하는 불변식은 아님(위험도는 낮음: 본인 자격증명 자기-노출) | `database-connection-tester.ts`/`http-connection-tester.ts` catch 분기 | 필수 아님 — `clampMessage` 직전 password/token 부분 문자열 마스킹 스크럽을 안전망으로 추가 고려 |
| 4 | 성능/DB | `CONNECTION_TEST_MAX_CONCURRENCY=2` 전역 큐를 mcp·email·database·http·entity tester 가 공유 — libuv 스레드풀 고갈을 막기 위한 의도된 설계(근거 실측 포함)이나, 멀티테넌트 배포에서 느린 대상에 대한 테스트가 몰리면 무관한 워크스페이스의 요청도 최대 수십 초 대기할 수 있음 | `integrations.service.ts:132,413-416,983-984,1570` | 조치 불요(4라운드 리뷰로 근거 확립됨) — 운영 중 지연 문의 시 이 큐를 먼저 의심하도록 모니터링에 큐 대기시간 로그 확인 권장 |
| 5 | DB/테스트 | `rotate()` 가 `update()` 성공(`affected>0`) 직후 별도 `findOne()` 으로 재조회하는데 두 단계 사이 트랜잭션이 없다 — 그 찰나에 행이 삭제되면(드문 admin 동작) `saved`가 null 이 되어 자격증명은 이미 바뀐 채 404 반환. 이 두 번째 `!saved` 분기는 코드엔 있으나 대응하는 테스트 케이스가 없음(`findOne` mock 이 항상 같은 값 반환) | `integrations.service.ts:1139-1153`, 대응 부족한 spec `integrations.service.spec.ts:1296-1307` | 심각도 낮음 — `update`+`findOne` 을 트랜잭션 또는 `RETURNING` raw query 로 묶어 원천 차단, 테스트는 `findOne.mockResolvedValueOnce(entity).mockResolvedValueOnce(null)` 케이스 추가 |
| 6 | 성능 | `rotate()` 가 연결 테스트 성공 후 `update`+`findOne` 두 번 왕복 — 메모리 `updatedAt` 과 DB 값이 어긋나는 문제(e2e 실측 1ms)를 고치기 위한 의도된 추가 쿼리, 단일 행이라 N+1 아님 | `integrations.service.ts:1139-1153` | 조치 불요(저빈도 관리자 작업, 정합성이 성능보다 우선) |
| 7 | 아키텍처 | 범용화된 `clampMessage` 가 여전히 `MCP_ERROR_MESSAGE_MAX_LEN`(MCP 전용 네이밍 상수, `modules/mcp/mcp-error-codes.ts`)에 의존 — 소비처가 4개 서비스 타입으로 늘며 이름·소속 불일치가 더 눈에 띄게 됨(사전부터 있던 상수, 이 PR 이 소비처만 확대) | `codebase/backend/src/modules/integrations/clamp-message.ts:1` | 상수를 범용 이름·위치로 이동(`INTEGRATION_ERROR_MESSAGE_MAX_LEN` 류) 또는 "전 서비스 공용 SoT" 주석 강화 |
| 8 | 아키텍처 | 노드 실행/통합 관리 두 계층이 공유하는 leaf 모듈 3개(`http-credentials.ts`·`http-redirect.ts`·`database-connection.ts`)가 순환 없이 잘 추출됐으나 물리적으로 여전히 `nodes/integration/*`(소비자 중 한쪽) 내부에 위치 | 위 3개 파일 경로 | 지금은 문제 없음 — 같은 종류가 하나 더 생기면 `nodes/integration/_shared/` 류 중립 위치 고려 |
| 9 | 아키텍처 | `PreviewTestResultDto`/`TestConnectionResultDto` 의 `code` 필드가 공통 베이스 클래스 없이 두 곳에 중복 선언(기존 패턴, 새 결함 아님) | `dto/responses/integration-response.dto.ts:258,484` | 조치 불요 — 세 번째 형제 DTO 생기면 `BaseTestResultDto` 추출 고려 |
| 10 | 요구사항 | HTTP 4xx 안내 메시지의 영문 워딩이 spec 원문(한국어 취지 서술) 과 축자 일치는 아니나 의미는 동일 — spec 이 정확한 영문 워딩을 고정하지 않음 | `http-connection-tester.ts` `classify()` | 조치 불요 |
| 11 | 유지보수성 | `resolveHttpCredentials` 의 3개 `case` 분기가 "필수 필드 없음 → `INTEGRATION_INCOMPLETE`" 보일러플레이트를 반복(함수가 ~90줄) | `http-credentials.ts` `resolveHttpCredentials` | 필수 아님 — `missingIncomplete(authType, missing)` 헬퍼로 메시지 조립만 추출 |
| 12 | 유지보수성 | `CONNECTION_TEST_MAX_CONCURRENCY` 상수 위 주석이 libuv 스레드풀·musl 실측치까지 담아 상수 하나에 비해 밀도가 매우 높음 | `integrations.service.ts` 상수 위 JSDoc | 필수 아님 — 핵심 결론만 남기고 실측 근거는 CHANGELOG/plan 링크로 대체 고려 |
| 13 | 유지보수성 | `database-driver-sockets.spec.ts` 가 `database-connection-tester.*` 계열과 파일명 어간을 공유하지 않아 관계가 디렉터리 목록만으론 드러나지 않음(docstring 은 설명함) | `database-driver-sockets.spec.ts` | 필수 아님 — 여유 있으면 `database-connection-tester.driver-assumptions.spec.ts` 류로 개명 |
| 14 | 문서화 | `PreviewTestDto.credentials` 필드의 JSDoc("검증 대상")이 이번에 갱신된 Swagger description("실제로 접속")과 어휘가 어긋남 | `dto/integration.dto.ts:172,175` | JSDoc 을 "테스트할 자격 증명(저장 안 함)" 으로 통일 |
| 15 | 문서화 | `:id/test` 의 Swagger 설명이 `preview-test` 형제 엔드포인트만큼 `code` 필드를 언급하지 않음(비대칭) | `integrations.controller.ts` `testConnection()` `@ApiOkWrappedResponse` | `description` 에 "실패 시 `code` 로 원인을 구분합니다" 추가해 대칭 맞춤 |
| 16 | API 계약 | HTTP "그 밖의 4xx" 는 `success:true` 로 응답 — 문서화는 잘 돼 있으나 스키마 레벨에 "검증 완료"와 "검증 불가"를 구분하는 필드가 없어 `success` 단독 판단 시 오독 여지 | `http-connection-tester.ts` `classify()` | 필수 아님 — 향후 `verified: boolean` 3-state 필드 고려 |
| 17 | 유저가이드 동반 갱신 | 통합 등록 마법사의 "프리뷰 테스트 진행 중" 로딩 카피(ko/en 동일하게 stale)가 옛 "레지스트리 구조 검증만" 동작을 암시 — 실제로는 최대 10초 실접속 대기로 바뀜. parity 위반은 아니고 매트릭스 강제 target 도 아님(회색 지대) | `dict/ko(en)/integrations.ts` `runningProbe`, `.../new/_components/test-step.tsx` | 급하지 않으면 스킵 가능 — 다음 라운드에 "자격 증명을 실제로 확인하는 중이에요(최대 10초)" 류로 갱신 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 정찰 표면 확대·DNS rebinding·에러메시지 노출은 모두 INFO — 인젝션/인증/TLS/암호화/SSRF 회귀 없음 |
| performance | NONE | 동시성 상한 2 의 트레이드오프가 실측 근거로 잘 뒷받침됨, N+1/메모리 누수 없음 |
| architecture | LOW | entity tester 재진입 계약 미강제(WARNING, 타 reviewer 와 통합), 그 외 네이밍/leaf 위치/DTO 중복은 INFO |
| requirement | LOW | spec §5.3·§5.4 와 line-level 일치, rotate 400 vs 422 는 기존 결함으로 트래커 등재됨 |
| scope | LOW | 56개 파일 diff 전부 단일 기능+4라운드 수정으로 추적됨, 무관한 변경 없음 |
| side_effect | MEDIUM | 재진입 데드락 WARNING(코드로 강제되지 않는 계약), mysql2 unit spec 실제 소켓 I/O 는 INFO |
| maintainability | LOW | `DB_*`/`HTTP_*` 코드 매직 스트링(WARNING), 함수 길이·네이밍은 전반적으로 양호 |
| testing | LOW | mysql SSL 매핑 미검증·소켓 I/O 섞인 unit spec(WARNING 2건), 217+136건 GREEN 실측 |
| documentation | LOW | SMTP 플래그 오기 주석(WARNING, pre-existing), 그 외 문서 동기화는 매우 촘촘 |
| database | LOW | rotate save→update 전환은 개선, update+findOne 비원자성·rotate 경쟁은 INFO(낮은 확률) |
| concurrency | MEDIUM | preflight DNS 무타임아웃(WARNING), rotate-vs-rotate lost-update(WARNING) — 이 PR 의 안전 마진 전제와 직결 |
| api_contract | LOW | 400/422 불일치 확대(WARNING, 기존 결함), success:true 오독 여지는 INFO |
| user_guide_sync | LOW | 매칭 매트릭스 3개 전부 동반 갱신 확인, 마법사 로딩 카피 stale 1건만 INFO |

## 발견 없는 에이전트

없음 — 13개 reviewer 모두 최소 INFO 이상의 관찰 사항을 보고했다("문제 없음" 판정 항목도 각 보고서의 "정합성 확인" 절에 근거와 함께 기록됨).

## 권장 조치사항

1. `registerEntityTester` 재진입 금지 계약을 런타임 가드(재진입 감지 시 즉시 throw) 또는 회귀 테스트로 강제 — 코드 3곳(architecture·side_effect·concurrency)이 독립적으로 지적한 잠재적 프로세스 전역 데드락.
2. SSRF preflight DNS lookup(`assertSafeOutboundHostResolved`)에 `closeWithin` 과 같은 `Promise.race` 기반 명시적 타임아웃 부여 — 특히 HTTP 리다이렉트 홉마다 재호출되는 지점을 `AbortSignal.timeout` 예산 안으로 편입.
3. `rotate()` 의 `update`+`findOne` 을 트랜잭션/`RETURNING` 으로 묶거나 최소한 조건부 update(버전 컬럼)로 rotate-vs-rotate lost-update 를 방지 — 현재는 저확률이나 자격증명 유실이라는 영향도가 크다.
4. `DB_*`/`HTTP_*` 결과 코드를 `MCP_ERROR_CODES` 패턴을 따르는 중앙 `as const` 상수로 승격 — 다음 서비스 추가 전 정리.
5. `buildMysqlSsl` 의 `rejectUnauthorized` 매핑에 mysql 전용 단언 추가(postgres 와 대칭) — MITM 방지 매핑의 회귀 감지력 보강.
6. `SMTP_BLOCK_PRIVATE_HOSTS` 오기 주석 2곳 정정(`ALLOW_PRIVATE_HOST_TARGETS`, opt-out) — 이번 PR 스코프 밖이면 트래커 등재.
7. `INTEGRATION_TEST_FAILED` 400 vs spec 422 불일치를 다음 트래커 정리 라운드에서 근거 문서(§9.4, `2-api-convention.md §6`)와 함께 확정.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync (13명)
  - **제외**: 아래 표 (1명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 가 이번 changeset 에 해당 없음으로 판단해 제외 |
