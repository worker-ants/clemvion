# 보안(Security) 리뷰

## 검토 범위

`connection-test-codes-and-gaps` plan 의 diff 10개 코드 파일(`codebase/backend/src/modules/integrations/{connection-test-codes.ts,connection-test-codes.spec.ts,database-connection-tester.ts,database-connection-tester.spec.ts,database-driver-sockets.spec.ts,http-connection-tester.ts,integrations.service.ts,integrations.service.spec.ts}`, `codebase/backend/src/nodes/integration/{cafe24/cafe24-api.client.ts,makeshop/makeshop-api.client.ts}`)와 plan/review 산출물(`plan/in-progress/connection-test-codes-and-gaps.md`, `review/consistency/2026/09/19/23_02_33/**`)을 전부 확인했다. 실제 코드 diff 는 `git diff origin/main...HEAD -- codebase/` 로 재확인(10 files changed, +195/-21) — 프롬프트가 컨텍스트 예산으로 생략한 `integrations.service.ts` · `integrations.service.spec.ts` · `cafe24-api.client.ts` 전체는 저장소에서 직접 `Read`/`grep` 했다.

## 발견사항

이번 변경은 연결 테스트 결과 코드(`'DB_HOST_BLOCKED'` 등)를 흩어진 문자열 리터럴에서 `CONNECTION_TEST_CODES` 상수 객체 + `IntegrationTestResultCode` literal union 으로 좁히는 **순수 리팩터**이며, 테스트 3건(SSL 매핑 mysql `require`/`verify-full`, 소켓 정리 try/finally, rotate 404 레이스)을 추가한다. 런타임 분기·인가·SSRF 가드·에러 메시지 노출 로직은 전부 그대로다. 관점별로 확인한 결과 새로 도입된 보안 결함은 없다.

- **인젝션**: 신규 SQL/커맨드/경로 조합 없음. `database-connection-tester.ts` 의 `SELECT 1` 은 리터럴 고정 쿼리이고 변경되지 않았다.
- **하드코딩된 시크릿**: `git diff` 를 `password|secret|token|apikey|-----BEGIN` 패턴으로 훑었다. 매치된 것은 기존 테스트 관례와 동일한 플레이스홀더 리터럴(`'new-secret'`, `database-connection-tester.spec.ts` 의 `'s3cret-pw'` 는 이번 diff 밖의 기존 코드)뿐이다. 실제 자격증명·키는 없다.
- **인증/인가**: `rotate()`(`integrations.service.ts`)의 권한 검사(`isAdmin` · `oauth2` 라우팅 거부)는 이번 diff 로 건드리지 않았다. 신규 테스트(update 성공 뒤 재조회 `null` → `RESOURCE_NOT_FOUND`)는 기존 로직을 고정할 뿐 로직 자체를 바꾸지 않는다.
- **입력 검증**: `validateCredentials`/`dispatchTest` 흐름 불변. SSRF 가드(`assertSafeOutboundHostResolved` · `outboundBlockReason` · `isSmtpHostBlocked`) 호출 위치·순서 불변.
- **에러 처리 / 정보 노출**: `DB_HOST_BLOCKED`·`HTTP_BLOCKED` 경로는 여전히 차단된 host/IP 를 응답 메시지에 싣지 않고(`database-connection-tester.spec.ts:156-172` 의 기존 단언 유지), 로그(`logger.warn`)에만 남긴다. `clampMessage` 로 길이 제한도 그대로다. 코드값이 `string` → literal union 으로 좁혀진 것은 오히려 노드 런타임 `ErrorCode` 와의 혼입을 컴파일 타임에 막아 **정보 노출 표면을 넓히지 않는 방향**이다.
- **암호화**: `database-connection-tester.spec.ts` 에 추가된 `SSL %s → 노드와 같은 매핑` 테스트는 `buildMysqlSsl`(`database-connection.ts:55-62`, 이번 diff 밖·미변경)이 `require`/`verify-full` 에 대해 `rejectUnauthorized: true` 를 반환함을 postgres 뿐 아니라 mysql 경로에서도 고정한다 — TLS 인증서 검증 우회 회귀를 잡아내는 **테스트 커버리지 개선**이며 새 결함이 아니다.
- **의존성 보안**: 신규 의존성 추가 없음.
- **OWASP Top 10 기타**: `database-driver-sockets.spec.ts` 는 `try/finally` 로 감싸 unit 테스트에서 연 실제 루프백 소켓(127.0.0.1:9, discard)을 단언 실패 시에도 정리하도록 고쳤다 — 리소스 누수 완화이며 프로덕션 코드 경로가 아니다.

INFO 성격으로 참고할 점(보안 결함 아님, 이번 diff 범위 밖의 기존 코드 확인):
- `cafe24-api.client.ts`/`makeshop-api.client.ts` 의 `mapPingError` 는 알 수 없는 예외를 `extractErrorMessage(err)`(= `err.message`)로 그대로 노출하는데, 이는 이번 diff 가 만든 것이 아니라 기존 동작이고 이번 변경은 그 반환 타입을 `string` → `Cafe24PingCode`/`MakeshopPingCode` literal union 으로 좁히기만 했다 — 재-flag 대상 아님.
- `connection-test-codes.spec.ts` 의 "타입 수준 계약" `it` 은 jest 런타임에서는 no-op(강제는 `tsc`/타입 래칭 게이트)이라는 점을 주석에 명시해 뒀다 — 오해를 막는 좋은 관례이며 지적 사항 아님.
- 동봉된 `plan/in-progress/connection-test-codes-and-gaps.md`, `review/consistency/2026/09/19/23_02_33/**` 는 이번 작업의 절차 산출물(consistency-check 리포트)이며 별도의 보안 위험을 담고 있지 않다.

## 뮤테이션/재현 메모

가설 검증을 위해 저장소 파일을 고치지 않았다 — grep/Read 로 충분히 확인 가능한 순수 리팩터였다. `git status --short` 로 원상태(리뷰 세션 출력 디렉터리 외 변경 없음)를 확인했다.

## 요약

이번 변경은 연결 테스트 결과 코드의 문자열 리터럴을 상수/타입으로 좁히는 리팩터와, 기존 SSRF·TLS·404 경로에 대한 테스트 커버리지 추가로 구성되며 런타임 동작은 변경되지 않는다. 인젝션·시크릿 하드코딩·인가 우회·정보 노출·암호화 약화 등 새로 도입된 취약점은 발견되지 않았고, 추가된 테스트들은 오히려 기존 SSRF/TLS 가드의 회귀를 더 촘촘히 잡아내는 방향이다.

## 위험도

NONE
