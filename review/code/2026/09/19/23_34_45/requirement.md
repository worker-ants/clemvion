# 요구사항(Requirement) 리뷰 — 연결 테스트 결과 코드 상수화 · literal union · 테스트 빈칸 셋

## 검증 방법 메모

diff 10개 코드 파일 전문을 확인했고(프롬프트에서 잘린 `integrations.service.ts` · `cafe24-api.client.ts` · `makeshop-api.client.ts` 는 `Read`/`grep` 으로 직접 열람), `spec/2-navigation/4-integration.md` §5.3~§5.5·§9.1·§14.1 vocabulary 표와 line-level 대조했다. 핵심 주장("`code` 를 `string` 으로 되돌리면 `@ts-expect-error` 3건이 깨진다")은 스크래치 디렉터리에 원본을 `cp` 해 둔 뒤 저장소 파일 `integrations.service.ts` 의 `code?: IntegrationTestResultCode` 를 `code?: string` 으로 **1줄만** 임시로 바꿔 `npx tsc --noEmit` 을 직접 돌려 재현했다 — 정확히 `connection-test-codes.spec.ts:40,42,44` 에서 `TS2578: Unused '@ts-expect-error' directive` 3건이 남을 발생시킴을 확인했고, 즉시 `cp` 로 원복해 `git status --short` 로 클린 상태를 재확인했다(diff 없음). 저장소에는 뮤테이션 잔여물 없음.

## 발견사항

- **[INFO]** spec §5.3 이 HTTP 연결 테스트의 "결과:" 목록·§14.1 vocabulary 표에서 `INTEGRATION_INCOMPLETE`/`INTEGRATION_AUTH_UNSUPPORTED`(공유 `resolveHttpCredentials` 경로 실패)를 여전히 누락하고 있다.
  - 위치: `spec/2-navigation/4-integration.md` §5.3(결과 목록), §14.1(vocabulary 표) — `codebase/backend/src/nodes/integration/http-request/http-credentials.ts` 의 `resolveHttpCredentials` 가 이 두 코드를 반환하고, `http-connection-tester.ts` 의 `testHttpConnection` 이 그대로 통과시킨다(`resolved.code`).
  - 상세: 코드는 실제 동작을 정확히 반영한다(타입 `Extract<HttpCredentialsResult, { ok: false }>['code']` 로 정확히 포착돼 있고, 테스트도 `INTEGRATION_AUTH_UNSUPPORTED` 를 accepted 값으로 고정했다) — 즉 코드가 옳고 spec 서술이 비어 있는 회색지대다. 단, 이 갭은 이번 PR 이 만든 것이 아니라 이전부터 있던 spec 누락이며, 이번 plan 이 이미 `--impl-prep` 단계(`review/consistency/2026/09/19/23_02_33`)에서 WARNING 으로 잡아 "별도 planner 턴" 으로 트래커에 등재해 뒀다(plan 체크리스트 항목 (1)). 새로 발견한 결함이 아니라 기존에 추적 중인 항목이므로 재차 CRITICAL/WARNING 으로 올리지 않고 INFO 로만 기록한다.
  - 제안: 별도 조치 불필요(이미 planner 인계 대기 중). 다음 planner 턴에서 `4-integration.md` §5.3 결과 목록 끝과 §14.1 표에 두 코드를 HTTP 연결 테스트 반환 가능 코드로 명시 추가.

- **[INFO]** 새 타입 `IntegrationTestResultCode` 는 spec `2-navigation/4-integration.md` §14.1 vocabulary 표의 9개 transport 코드(`EMAIL_HOST_BLOCKED`·`EMAIL_CONNECT_FAILED`·`DB_HOST_BLOCKED`·`DB_AUTH_FAILED`·`DB_CONNECT_FAILED`·`HTTP_BLOCKED`·`HTTP_AUTH_FAILED`·`HTTP_SERVER_ERROR`·`HTTP_CONNECT_FAILED`)와 §9.1 의 게이트 코드(`INTEGRATION_CREDENTIALS_UNREADABLE`·`INTEGRATION_INCOMPLETE`)를 line-level 로 정확히 반영한다 — 값 자체·오류 조건 서술 모두 일치. 문제 없음(정보성 확인).
  - 위치: `codebase/backend/src/modules/integrations/connection-test-codes.ts:16-36`

## 관점별 확인 결과

1. **기능 완전성** — 순수 타입 리팩터(런타임 동작 불변) + 테스트 빈칸 3건 보강(SSL mysql `require`/`verify-full`/`disable` 매핑, 드라이버 소켓 실제-연결 테스트의 `finally` 정리, `rotate` 의 update-후-재조회 `null` → 404 경합). 세 빈칸 모두 plan 이 명시한 목표와 1:1 대응하며 실제로 커버리지가 늘었다.
2. **엣지 케이스** — `rotate` 의 "update 는 성공했는데 재조회가 null" 경합(삭제 레이스)이 신규 테스트로 고정됐고, 감사 로그·cache broadcast 가 그 경우 호출되지 않음(부작용 없음)까지 단언한다. mysql SSL `require` 케이스(기존엔 postgres `verify-full` 만 있었음)가 추가돼 "require 도 인증서 검증 켠다" 라는 서술이 mysql 경로에서도 고정됐다.
3. **TODO/FIXME** — 없음.
4. **의도와 구현 간 괴리** — 없음. 파일·함수 주석("연결 테스트의 transport tester 가 스스로 내는 결과 코드", "테스터 앞의 게이트")과 실제 구현(생산자별 리터럴 → 상수 참조 치환)이 정확히 일치. `TestGateCode` 는 export 하지 않지만 `IntegrationTestResultCode` union 안에서 리터럴로 펼쳐지므로 문제 없음.
5. **에러 시나리오** — 변경 없음(리팩터). 기존 에러 분기(SSRF 차단·인증 실패·타임아웃 등) 로직 자체는 손대지 않고 결과 `code` 값의 출처만 리터럴에서 상수로 바꿨다.
6. **데이터 유효성** — 해당 없음(타입 좁히기이며 런타임 검증 로직 변경 없음).
7. **비즈니스 로직** — `database-connection-tester.ts`·`http-connection-tester.ts`·`integrations.service.ts`(`testEmailTransport`) 세 생산자 모두 리터럴을 `CONNECTION_TEST_CODES.*` 로 전량 치환했음을 grep 으로 확인(잔여 raw 리터럴 없음). `Cafe24PingCode`/`MakeshopPingCode` 도 각 클라이언트의 실제 `mapPingError`/`pingConnection` 분기(4종·3종)와 정확히 일치 — 코드 값 하나하나를 실제 반환 지점과 대조해 전수 확인했다.
8. **반환값** — `IntegrationsService.testMcpTransport` 의 `code: result.code ?? 'MCP_CONNECT_FAILED'` 기본값은 `McpFailureCode` 의 멤버라 타입·의미 모두 일치. 모든 실패 분기가 `IntegrationTestResultCode` 부분집합의 값을 반환한다(직접 `npx tsc --noEmit` 으로 신규/변경 파일 관련 에러 0건 확인 — 사전 존재하던 무관 파일들의 baseline 에러만 있고 이번 diff 대상 파일에는 없음).
9. **spec fidelity** — §5.3/§5.4/§5.5 서술("결과:" 목록)과 §14.1 vocabulary 표를 라인 단위로 대조 — 9개 transport 코드 전부, 원인 서술(예: `DB_AUTH_FAILED` = PG class 28 · MySQL `ER_ACCESS_DENIED_ERROR`/`ER_DBACCESS_DENIED_ERROR`)까지 코드와 정확히 일치. §9.1 의 `INTEGRATION_CREDENTIALS_UNREADABLE`/`INTEGRATION_INCOMPLETE` 게이트 코드 서술도 `TestGateCode` 주석·`testConnection` 실제 분기와 일치. 유일한 갭은 위 INFO 항목(§5.3/§14.1 의 `INTEGRATION_INCOMPLETE`/`INTEGRATION_AUTH_UNSUPPORTED` HTTP 경로 누락)이며 이는 코드 결함이 아니라 이미 추적 중인 spec 서술 공백이다.

## 요약

이번 diff 는 동작을 바꾸지 않는 순수 타입 리팩터(런타임 결과 코드를 상수화 + `IntegrationTestResult.code` 를 `string` 에서 닫힌 literal union `IntegrationTestResultCode` 로 좁힘)와, 트래커에 명시됐던 테스트 빈칸 3건(mysql SSL 매핑 · 드라이버 소켓 unit 테스트의 소켓 누수 정리 · `rotate` 삭제 경합 404)을 보강하는 작업이다. 열 개 코드 파일 전수를 직접 읽어 각 생산자(DB·HTTP·Email 테스터, Cafe24·MakeShop `pingConnection`)의 실제 리터럴 반환값과 새 타입 union 멤버를 하나하나 대조했고 불일치가 없음을 확인했다. 핵심 주장인 "`@ts-expect-error` 게이트가 타입 래칫으로 실제로 강제된다" 는 서술은 스크래치 백업 후 저장소 파일을 1줄 임시 변경해 `tsc` 를 직접 돌려 재현·검증했다(원복 완료, `git status` 클린). spec(`2-navigation/4-integration.md` §5.3~§5.5, §9.1, §14.1)과의 line-level 대조에서도 새 타입·상수가 vocabulary 표를 정확히 반영함을 확인했으며, 유일하게 남은 spec 공백(HTTP 게이트 코드 2종의 §5.3/§14.1 미기재)은 이번 PR 이전부터 있던 것으로 이미 `--impl-prep` 단계에서 WARNING 으로 잡혀 planner 인계가 예정돼 있어 재차 격상하지 않고 INFO 로만 기록했다. TODO/FIXME, 반환값 누락, 비즈니스 로직 불일치는 발견되지 않았다.

## 위험도

NONE
