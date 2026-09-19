# 요구사항(Requirement) 리뷰 — Database · HTTP 통합 연결 테스터

대상: `IntegrationsService.dispatchTest` 에 `database`/`http` transport tester 를 신설해, 종전 구조 검증만으로 "Connection successful"
을 돌려주던 것을 실제 접속(DB `SELECT 1`, HTTP `GET base_url`)으로 바꾼 변경. 관련 spec: `spec/2-navigation/4-integration.md` §5.3(HTTP) ·
§5.4(Database) · §9.1/§9.2(엔드포인트) · §9.4(에러 코드) · §14.1.

## 발견사항

- **[INFO]** `rotate()` 의 `INTEGRATION_TEST_FAILED` 는 `BadRequestException`(400)인데 spec §9.4 는 422 로 정의 — 단 이 diff 가 만든 불일치가 아니다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` (`rotate()` 메서드, `throw new BadRequestException({ code: 'INTEGRATION_TEST_FAILED', ... })`) / spec: `spec/2-navigation/4-integration.md` §9.4 `INTEGRATION_TEST_FAILED (422)` 행
  - 상세: `git log -S"INTEGRATION_TEST_FAILED"`로 추적하면 이 400/422 불일치는 `ae8f9cfd9`(리포 구조 개편 커밋)부터 있던 기존 코드다. 이번 diff 는 rotate 에 "실제 연결 테스트 실패 시에도 이 코드로 거부한다"는 새 실패 경로를 하나 더 얹었을 뿐, 상태 코드 자체는 바꾸지 않았다. 이 PR 의 e2e(`integration-connection-test.e2e-spec.ts` 케이스 D)도 "rotate 의 상태 코드는 단언하지 않는다 — 구현 400 · spec §9.4 422 가 어긋나 있고 트래커에서 정한다"고 명시적으로 스코프 밖으로 뺐고, `plan/in-progress/integration-db-http-testers.md` 체크리스트에도 같은 결정이 기록돼 있다.
  - 제안: 코드 수정 불필요(이 PR 스코프 아님). 이미 트래커에 등재된 것으로 보이므로 별도 조치 없이 인지만 해두면 된다 — 재지적 방지용으로 기록.

- **[INFO]** HTTP 4xx(401/403 외) 결과의 "안내 메시지" 워딩이 spec 원문과 100% 축자 일치는 아니지만 의미는 동일
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts` `classify()` — `Reached the server, but base_url answered HTTP ${status} — the credentials could not be verified.` / spec: §5.3 "«서버에는 닿았지만 `base_url` 이 이 요청을 처리하지 않아 자격증명은 확인하지 못했다»"
  - 상세: spec 은 한국어 안내 문구의 "취지"를 규정한 것이고 실제 API 응답 메시지는 영어이므로 표현이 다른 것은 정상(스펙 문서 자체가 "message 로 알린다"는 요구만 명시, 정확한 영문 워딩을 고정하지 않음). 회색지대로 CRITICAL 대상 아님.
  - 제안: 조치 불요.

## 정합성 확인 (일치 — 발견사항 아님, 검증 근거로 남김)

아래는 CRITICAL/WARNING 후보로 점검했으나 spec·구현이 line-level 로 일치함을 실측 확인한 항목이다.

1. **HTTP 판정 분기 (§5.3)** — `http-connection-tester.ts` `classify()`: 401/403→`HTTP_AUTH_FAILED`, 5xx→`HTTP_SERVER_ERROR`, 그 밖 4xx→`success:true`+안내, 2xx/Location 없는 3xx→성공. spec §5.3 결과 목록과 코드가 정확히 대응한다. 리다이렉트 5홉(`MAX_REDIRECT_HOPS`, `http-redirect.ts`), 홉마다 SSRF 재검사, 판정은 마지막 응답, 응답 본문 미독(`discardBody`) 모두 spec 문장과 일치. `http-request.handler.spec.ts`에 6회 fetch 호출(첫 요청+5홉) off-by-one 검증까지 추가돼 있다.
2. **Database 판정 분기 (§5.4)** — `database-connection-tester.ts`: SSRF 차단→`DB_HOST_BLOCKED`, PG SQLSTATE class 28(`/^28[0-9A-Z]{3}$/`)·MySQL `ER_ACCESS_DENIED_ERROR`/`ER_DBACCESS_DENIED_ERROR`→`DB_AUTH_FAILED`, 그 밖→`DB_CONNECT_FAILED`. 연결·`SELECT 1` 각각 10초(`DB_TEST_TIMEOUT_MS`, pg `connectionTimeoutMillis`/`query_timeout`, mysql2 `connectTimeout`/쿼리 `timeout`)는 spec 최신 문구("연결과 `SELECT 1` 을 각각 10초까지 기다린다")와 정확히 일치 — 같은 PR 의 spec draft(`spec-draft-integration-db-test-waits.md`)가 이 문장 자체를 이 구현에 맞춰 정정했고 그 draft 도 이미 spec 에 반영됐다.
3. **SSL 매핑 (Database 노드 §4-nodes/4-integration/2-database-query.md)** — `buildPgConnection`/`buildMysqlSsl` (신설 `database-connection.ts`)가 `disable`→false/undefined, `require`/`verify-full`→`{rejectUnauthorized:true}` 로 매핑, 표와 축자 일치. 순수 코드 이동(노드 핸들러에서 추출)으로 로직 변경 없음을 diff 로 확인.
4. **base_url 없음 · 형식 오류** — 없으면 호출 없이 `success:true`(spec 문구와 일치), 형식이 틀리면 `HTTP_CONNECT_FAILED`(spec 미명시지만 SSRF 차단과 구분해 "형식 오류"로 명확히 알리는 방어적 분류이며 기존 결과 버킷과 충돌 없음).
5. **동시 실행 상한** — `CONNECTION_TEST_MAX_CONCURRENCY = 2`(`p-limit`), transport tester·entity tester 모두 같은 슬롯을 공유. spec 본문에는 없고(견고성 장치라 CHANGELOG 로만 공지) `spec-draft-integration-db-test-waits.md` 의 "비대상" 절이 이를 명시적으로 spec 비대상 처리한 근거와 일치 — SPEC-DRIFT 아님(의도적으로 spec 밖에 둔 결정).
6. **DTO 계약** — `PreviewTestResultDto`/`TestConnectionResultDto` 에 신설된 `code?: string` 필드가 `IntegrationTestResult.code`(실제 반환값)와 대응하며, `integrations.service.spec.ts` 가 `assertMatchesContract(result, contractForDto(PreviewTestResultDto))` 로 값-대-선언 일치를 회귀 테스트로 고정했다.
7. **rotate 흐름** — "새 자격증명으로 연결 테스트 → 성공해야 저장"(controller Swagger 설명, §9.2 rotate 행)이 `rotate()` 구현과 일치. 부분 `update`(엔티티 전체 `save` 아님)로 동시 `logUsage` 의 `lastUsedAt` 를 되돌리지 않는 것, 응답을 저장 후 재조회한 행으로 구성하는 것도 e2e(`E. rotate 성공`)로 검증됨.
8. **동시성 · closeWithin 엣지 케이스** — 닫기가 끝나지 않는 서버(그레이스 1초 초과) → 소켓 파괴 후 결과는 그대로 반환하고 던지지 않음, 드라이버 내부 구조가 예상과 다르면(소켓 못 찾음) 조용히 넘어가지 않고 `logger.warn` 을 남김 — 둘 다 fake timer 로 단위 테스트됨(`database-connection-tester.spec.ts`). `database-driver-sockets.spec.ts` 가 이 구조적 가정(pg/mysql2 모두 `connection.stream`)을 목킹 없이 고정해, spec 이 검증하지 못하는 "실제 드라이버 구조가 바뀌면 RED" 갭까지 메운다.
9. **TODO/FIXME/HACK/XXX** — 신규·변경 파일 전수 grep 0건. 미완성 표시 없음.
10. **mutation testing** — `plan/in-progress/integration-db-http-testers.md` 에 세 대상(총 27개 뮤턴트)의 예측/실측이 기록돼 있고 26 RED·1 GREEN(동치 뮤턴트로 판별 근거 포함)으로 커버리지가 실측됨.

## 요약

Database·HTTP 통합의 연결 테스트를 "구조 검증만"에서 "실제 접속"으로 바꾸는 이번 변경은 spec/2-navigation/4-integration.md §5.3·§5.4 의 결과
코드·대기 상한·SSRF 연계·리다이렉트 규칙과 line-level 로 일치하며, 노드 실행 경로(HTTP Request/Database Query 핸들러)와 자격증명 붙이는 방식·SSL
매핑·SSRF 가드를 공유 모듈(`http-credentials.ts`/`http-redirect.ts`/`database-connection.ts`)로 추출해 "테스트 통과 = 실행 성공"이라는
핵심 요구를 구조적으로 보장한다. 엣지 케이스(닫기 지연, 드라이버 소켓 구조 가정, 리다이렉트 홉 상한 off-by-one, 빈 base_url, 잘못된 URL 형식,
동시 실행 상한 하의 대기열)까지 단위·e2e·뮤테이션 테스트로 폭넓게 검증됐고 TODO/FIXME 류 미완성 표시는 없다. 유일하게 남는 것은 `rotate()` 의
`INTEGRATION_TEST_FAILED` 400 vs spec 422 불일치인데, 이는 이 PR 이전부터 있던 기존 결함이며 이번 PR 이 명시적으로 스코프 밖으로 미루고
트래커에 등재했으므로 INFO 로만 기록한다(재도입·악화 없음).

## 위험도

LOW
