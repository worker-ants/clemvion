# Security Review — 연결 테스트 결과 코드를 상수 · literal union 으로 · 테스트 빈칸 셋

## 검토 범위

- `codebase/backend/src/modules/integrations/connection-test-codes.ts` (신규) · `.spec.ts` (신규)
- `codebase/backend/src/modules/integrations/database-connection-tester.ts` · `.spec.ts`
- `codebase/backend/src/modules/integrations/database-driver-sockets.spec.ts`
- `codebase/backend/src/modules/integrations/http-connection-tester.ts`
- `codebase/backend/src/modules/integrations/integrations.service.ts` · `.spec.ts`
- `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts`
- `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts` · `.spec.ts`
- `plan/in-progress/connection-test-codes-and-gaps.md`
- `review/code/2026/09/19/23_34_45/**`, `review/consistency/2026/09/19/23_02_33/**` (1라운드 리뷰/consistency 산출물 — 코드 아님, 참고만 함)

프롬프트에 "전체 파일 컨텍스트 실리지 않음" 으로 표시된 파일(`database-connection-tester.ts`, `http-connection-tester.ts`, `integrations.service.ts`, `cafe24-api.client.ts`, `makeshop-api.client.ts` 등)은 `Read` 로 직접 열어 diff 밖 문맥까지 확인했다. 저장소 파일에 대한 뮤테이션은 수행하지 않았다(`git status --short` 로 확인 — 세션 전 untracked 였던 이 리뷰 세션 디렉터리 외 변경 없음).

## 변경의 성격

이번 diff 는 순수 타입 좁히기 리팩터다 — 연결 테스트 결과 코드(`'DB_HOST_BLOCKED'`, `'HTTP_BLOCKED'`, `'EMAIL_CONNECT_FAILED'` 등)를 흩어진 문자열 리터럴에서 `CONNECTION_TEST_CODES` `as const` 객체 참조로 바꾸고, `IntegrationTestResult.code` 를 `string` 에서 `IntegrationTestResultCode` literal union 으로 좁혔다. 런타임 값·분기 로직·에러 메시지 생성 경로는 전부 동일하다(`git diff` 상 로직 변경 없음, 값만 상수 참조로 치환). 나머지는 테스트 추가(MakeShop `pingConnection` 3분기, `INTEGRATION_CREDENTIALS_UNREADABLE` 분기, mysql SSL 매핑 3종, 소켓 정리 `try/finally`, rotate 404 경합)다.

## 발견사항

- **[INFO]** SSRF 차단 사유(`reason`/`detail`)는 이번에도 서버 로그(`logger.warn`)에만 남고 클라이언트 응답에는 고정 문구(`SSRF_BLOCKED_CLIENT_MESSAGE`, `DB_HOST_BLOCKED_MESSAGE`)만 나간다 — 기존 동작 유지, 회귀 없음.
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts` 함수 `blocked` (23-30행) · `codebase/backend/src/modules/integrations/database-connection-tester.ts` 함수 `testDatabaseConnection` 내 SSRF 분기 (136-147행)
  - 상세: `blocked(reason)` 은 `reason` 을 `logger.warn` 으로만 내보내고 반환 객체의 `message` 는 상수 `SSRF_BLOCKED_CLIENT_MESSAGE` 다. DB 쪽도 동일하게 `detail` 은 로그 전용이고 클라이언트에는 `DB_HOST_BLOCKED_MESSAGE` 만 간다. 이번 PR 이 건드리지 않은 부분이며 정보 노출 없음을 재확인.
  - 제안: 조치 불필요(현행 유지 확인).

- **[INFO]** 에러 메시지는 여전히 `clampMessage(err.message)` 로 길이만 제한할 뿐 원문 예외 메시지(드라이버 내부 문자열)를 그대로 노출한다 — DB/HTTP/Email 커넥션 테스트 공통.
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts` 함수 `testDatabaseConnection` (159-165행), `codebase/backend/src/modules/integrations/http-connection-tester.ts` 함수 `testHttpConnection` catch 블록 (144-148행), `codebase/backend/src/modules/integrations/integrations.service.ts` `testEmailTransport` 부근 (§`EMAIL_CONNECT_FAILED` 반환)
  - 상세: 기존부터 있던 설계(테스트 대상은 워크스페이스 소유자 자신의 통합 자격증명이므로 자기 자신에게 자기 인프라 에러 메시지를 보여주는 것 — 인가된 사용자 대상)이고 이번 PR 이 바꾼 부분이 아니다. `clampMessage` 는 길이만 제한하며 민감정보 필터링은 하지 않는다는 점은 트레이드오프로 남아 있다.
  - 제안: 조치 불필요(범위 밖, 회귀 아님). 후속으로 자격증명 문자열이 드라이버 예외 메시지에 반영될 가능성(예: 잘못된 접속 문자열에 비밀번호가 echo 되는 드라이버 버그)이 있는지는 이번 PR 범위가 아니므로 별도 트래킹 대상으로만 남긴다.

- **[INFO]** `database-driver-sockets.spec.ts` 는 unit 계층에서 루프백(127.0.0.1) 소켓을 실제로 연다(`mysqlCoreConnection({ host: '127.0.0.1', port: 9 })`, `new PgClient({ host: '127.0.0.1', port: 1 })`) — 외부 네트워크 접근은 아니고 SSRF 가드 대상도 아니므로(테스트 코드 자체이며 프로덕션 경로를 거치지 않음) 취약점은 아니다.
  - 위치: `codebase/backend/src/modules/integrations/database-driver-sockets.spec.ts` — 두 `it` 블록 (18-27행, 29-45행)
  - 상세: 주석에도 "unit 계층에서 예외적으로 실제 소켓을 연다" 고 명시했고 `finally` 로 소켓을 정리한다(이번 PR 이 `try/finally` 로 고쳐 실패 시에도 정리되게 개선함 — 오히려 리소스 누수 방지가 강화됨).
  - 제안: 조치 불필요.

- **[INFO]** 신규 테스트(`connection-test-codes.spec.ts` "타입 수준 계약")는 jest 실행 시 no-op 이며 실제 강제는 `tsc`/타입체크 ratchet 이 한다 — 주석에 명시되어 있고 코드 자체의 보안 이슈는 아니다.
  - 위치: `codebase/backend/src/modules/integrations/connection-test-codes.spec.ts` `it('타입 수준 계약 (런타임 no-op)')` 블록
  - 상세: 보안 관점 영향 없음(테스트 신뢰성 이슈이며 1라운드 리뷰 INFO 5와 동일 지적, 이미 인지됨).
  - 제안: 조치 불필요.

인젝션(SQL/커맨드/경로탐색), 하드코딩 시크릿, 인증/인가 우회, 암호화 알고리즘, 의존성 변경 관련 새로운 문제는 발견되지 않았다. `Cafe24PingCode`/`MakeshopPingCode`/`IntegrationTestResultCode` 도입은 컴파일타임 전용이며 런타임 검증(예: 실제로 반환되는 문자열)을 대체하지 않지만, 반환값 자체가 소스 코드 상수/리터럴 그대로이므로 새로 도입된 신뢰 경계는 없다.

## 요약

이번 변경은 연결 테스트 결과 코드를 원시 문자열에서 명명된 상수 · literal union 으로 좁히는 순수 리팩터와 그에 딸린 테스트 보강(MakeShop `pingConnection` 3분기, 자격증명 복호화 실패 게이트, mysql SSL 매핑, 소켓 정리, rotate 404 경합)으로 구성되며, SSRF 차단·에러 메시지 클램핑·자격증명 처리 등 기존 보안 관련 동작은 그대로 유지된다. 새로운 인젝션·인가 우회·시크릿 노출·암호화 약화 지점은 발견되지 않았고, 기존부터 있던 에러 메시지 노출 범위(자기 자신의 통합 대상)도 이번 PR 이 넓히지 않았다.

## 위험도

NONE
