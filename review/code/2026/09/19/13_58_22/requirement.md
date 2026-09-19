# 요구사항(Requirement) 리뷰 — Database · HTTP 연결 테스터

## 발견사항

- **[INFO]** Database 연결 테스트의 실제 최악 대기시간이 문서상 "10초"보다 길어질 수 있음(연결과 쿼리에 독립적으로 10초씩)
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts:38-49` (`probePostgres`) 및 `:52-68`(`probeMysql`) — `connectionTimeoutMillis`/`connectTimeout` 과 `query_timeout`/`timeout` 에 같은 상수 `DB_TEST_TIMEOUT_MS`(10_000)를 독립적으로 적용
  - 상세: `spec/2-navigation/4-integration.md:490`은 "연결 대기는 10초"라고만 적고, 사용자 가이드(`codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.en.mdx:67`, `.mdx:78`)는 "Both wait up to 10 seconds for a response" / "두 연동 모두 응답 대기 시간은 10초예요"라고 명시한다. 그러나 구현은 연결 단계와 쿼리 실행 단계에 각각 독립된 10초 타임아웃을 건다(주석: "인증 뒤 멈춘 서버에 쿼리가 매달린다"는 설계 의도가 `plan/in-progress/integration-db-http-testers.md:35`에 있음). 연결이 느리게(예: 9초) 성공한 뒤 쿼리가 멈추는 서버라면 응답까지 최대 ~19-20초가 걸릴 수 있어 "10초" 문구와 어긋난다. HTTP 쪽은 `AbortSignal.timeout(HTTP_TEST_TIMEOUT_MS)` 하나로 리다이렉트 체인 전체를 감싸므로(전체 요청이 하나의 10초 예산 안에서 처리) 이 문제가 없다 — DB만 비대칭이다.
  - 이는 코드 결함이 아니라(의도적인 이중 방어) spec·가이드의 서술이 실제 최악 케이스를 정확히 반영하지 못하는 경계 사례다. 판단이 모호해 SPEC-DRIFT로 단정하지 않고 일반 INFO로 남긴다.
  - 제안: `spec/2-navigation/4-integration.md` §5.4에 "연결 대기 10초 + 쿼리 대기 10초(각각 독립)"로 세분화하거나, 가이드 문구를 "최대 약 20초"로 완화. 코드 변경은 불필요.

- **[INFO]** `INTEGRATION_TEST_FAILED` 상태 코드(400) vs spec §9.4(422) 불일치가 이번 PR로 Database·HTTP rotate 경로에도 처음 적용됨
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1088-1091` (`rotate()`)
  - 상세: 이 불일치는 이번 diff가 새로 만든 것이 아니라 기존 `rotate()` 예외 처리 메커니즘을 그대로 재사용한 것이며, `review/consistency/2026/09/19/13_21_00/SUMMARY.md` WARNING #1에서 이미 식별·추적 중이다(`plan/in-progress/integration-db-http-testers.md:17` e2e 파일 주석에도 "상태 코드는 단언하지 않는다"로 명시). 재지적 대상 아님, 참고로만 남긴다.
  - 제안: 조치 불요 — 기존 트래커 항목으로 처리.

## 정합성 확인 (문제 없음 — 검증 근거)

- **spec fidelity — §5.3/§5.4/§14.1 라인 단위 대조**: `spec/2-navigation/4-integration.md`가 이미 이 PR과 같은 브랜치의 선행 커밋(`74087dff6`)으로 갱신되어 있고, 구현이 그 서술과 정확히 일치한다.
  - HTTP: 2xx/Location 없는 3xx→성공, 401·403→`HTTP_AUTH_FAILED`, 그 외 4xx→성공+안내 메시지, 5xx→`HTTP_SERVER_ERROR`, SSRF/5홉 초과→`HTTP_BLOCKED`, 네트워크/타임아웃→`HTTP_CONNECT_FAILED`, `base_url` 공백→호출 없이 성공 — `http-connection-tester.ts:59-82`(`classify`)·`110-186`(`testHttpConnection`)가 그대로 구현.
  - 리다이렉트 5홉 로직은 `http-request.handler.ts:432-465`(노드 실행 경로)와 홉 카운팅이 동일(각 6번째 시도에서 차단) — unit spec(`http-connection-tester.spec.ts:256-264`)으로 실측 확인.
  - Database: SSRF→`DB_HOST_BLOCKED`(host 미노출), 인증 거부(PG class 28 정규식 `/^28[0-9A-Z]{3}$/`·MySQL `ER_ACCESS_DENIED_ERROR`/`ER_DBACCESS_DENIED_ERROR`)→`DB_AUTH_FAILED`, 그 외→`DB_CONNECT_FAILED` — `database-connection-tester.ts:29-35`(`isAuthFailure`)·`80-113`(`testDatabaseConnection`)가 spec §5.4 문구와 일치.
  - §14.1 신규 5개 코드(`DB_AUTH_FAILED`·`DB_CONNECT_FAILED`·`HTTP_AUTH_FAILED`·`HTTP_SERVER_ERROR`·`HTTP_CONNECT_FAILED`)와 기존 노드 런타임 코드(`DB_CONNECTION_ERROR`·`HTTP_{status}`)의 모집합 차이도 Rationale(`spec/2-navigation/4-integration.md:1165-1168`)에 명시돼 있어 근접-동형 혼동 우려(선행 consistency-check naming_collision WARNING #5)가 해소됨.
- **SSRF 메시지 일반화 계승**: 첫 요청과 리다이렉트 대상 모두 동일한 `BLOCKED` 상수(`SSRF_BLOCKED_CLIENT_MESSAGE`)를 반환하고 원본 상세는 `logger.warn`에만 남긴다(`http-connection-tester.ts:20-37`) — 선행 consistency-check(`13_21_00` WARNING #2, 구현 착수 전 우려)가 실제 구현에서는 정확히 반영됨. `database-connection-tester.spec.ts:102-118`·`http-connection-tester.spec.ts:185-209,237-254`에서 host/IP가 응답 메시지에 없음을 직접 단언.
- **DTO 필드**: `PreviewTestResultDto.code?`가 신규 선언되고(`integration-response.dto.ts:253-258`) `integrations.service.spec.ts`가 `assertMatchesContract`로 실제 응답과 DTO 선언 일치를 검증 — 선행 consistency-check(`13_21_00` WARNING #3) 반영 확인.
- **에러 시나리오·엣지 케이스**: 연결 실패 시 반드시 `finally`에서 close(`database-connection-tester.ts:43-49,63-67`), close 자체가 실패해도 결과에 영향 없음(unit spec "닫기가 실패해도 결과를 바꾸지 않고 던지지 않는다"), `driver` 미지정 시 postgres로 기본 처리(노드 핸들러의 기존 관례와 동일, `database-query.handler.ts:270`), `base_url` 형식 오류는 SSRF 차단과 구분해 `HTTP_CONNECT_FAILED`로 명확히 안내, 리다이렉트 상대경로(`Location`)는 현재 URL 기준으로 해석 — 모두 unit spec으로 커버됨.
- **반환값**: 두 테스터 모두 모든 분기에서 `IntegrationTestResult`를 반환하며 예외를 던지지 않음(주석·구현·spec 서술 일치). `dispatchTest` 배선(`integrations.service.ts:404-412`)의 타입 시그니처(`TransportTester`)와도 부합.
- **테스트 실행**: `database-connection-tester.spec.ts`(23개)·`http-connection-tester.spec.ts`(19개)·`integrations.service.spec.ts`(132개, dispatchTest 배선 포함) 전부 GREEN(직접 실행 확인, jest). plan(`integration-db-http-testers.md`)에 기록된 뮤테이션 테스트(DB 10건 전부 RED, HTTP 14건 중 13 RED·1 동치 뮤턴트)도 근거가 상세히 남아 있어 회귀 방어력이 실측됨.
- TODO/FIXME/HACK 종류 주석 없음(신규 파일 전수 grep 0건).

## 뮤테이션 규약 준수

리뷰 중 저장소 파일을 수정하지 않았다(`Read`/`Grep`/`Bash`(jest 실행)만 사용). `git status --short` 로 확인 — 내가 만든 변경 없음. 리뷰 도중 `plan/in-progress/integration-db-http-testers.md`가 다른 세션에 의해 동시 수정된 것을 관측했으나(TEST WORKFLOW 체크박스 갱신), 이는 내가 야기한 것이 아니며 병행 작업으로 판단된다.

## 요약

Database·HTTP 연결 테스터 구현은 `spec/2-navigation/4-integration.md` §5.3·§5.4·§14.1 및 선행 두 차례 consistency-check(13_03_41 draft 단계, 13_21_00 impl-prep 단계)에서 제기된 WARNING들을 모두 실제로 반영했다 — SSRF 메시지 일반화, DTO `code` 필드, 근접 코드명 모집합 차이 명시가 전부 코드/spec에 나타난다. 두 테스터는 성공·SSRF 차단·인증 거부·연결 실패·타임아웃·리다이렉트 추종/초과·4xx 안내·닫기 실패 등 엣지 케이스를 폭넓게 커버하고 예외 없이 항상 값을 반환하며, 유닛 테스트(42건) 및 dispatchTest 배선 테스트가 전부 GREEN이다. 유일하게 남는 것은 Database 테스트의 최악 대기시간이 연결+쿼리 이중 타임아웃으로 인해 문서상 "10초"보다 커질 수 있다는 문서 정밀도 문제(INFO)와, 이미 트래커에 있는 기존 400/422 상태 코드 불일치(INFO, 재지적 아님)뿐이다. CRITICAL/WARNING 급 결함은 발견되지 않았다.

## 위험도

LOW
