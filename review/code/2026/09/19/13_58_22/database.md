# 데이터베이스(Database) 리뷰 — 연결 테스트 실장(Database · HTTP transport testers)

## 발견사항

- **[INFO]** 연결 테스트용 커넥션은 노드 실행 커넥션 풀과 의도적으로 분리 — 문서화됨, 문제 아님
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts:70-73` (`testDatabaseConnection` JSDoc)
  - 상세: `probePostgres`/`probeMysql` 는 매 호출마다 `new PgClient(...)` / `mysqlCreateConnection(...)` 로 새 커넥션을 열고, 둘 다 `try/finally` 로 성공·실패 관계없이 `client.end().catch(() => {})` / `connection?.end().catch(() => {})` 를 호출해 반드시 닫는다(`database-connection-tester.ts:43-49`, `52-67`). `SELECT 1` 단발성 프로브이므로 풀을 쓰지 않는 설계가 합리적이며, 종료 실패도 삼켜서 원래 판정(성공/실패)을 덮어쓰지 않는다 — `database-connection-tester.spec.ts:177-183` 이 이를 회귀 테스트로 고정. 이 풀 비-편입 사실은 consistency 리뷰(`review/consistency/2026/09/19/13_03_41/rationale_continuity.md` INFO #4)에서도 이미 지적되어 spec 반영 대상으로 트래킹 중이다. 코드 자체는 안전하나, 커넥션 관리 관점에서 "왜 풀을 안 쓰는가"가 spec 본문에도 명시될 필요가 있다는 기존 지적에 동의한다.
  - 제안: 조치 불요(이미 트래킹됨). 구현 자체는 누수·미종료 경로가 없다.

- **[INFO]** 연결 테스트 엔드포인트의 동시 아웃바운드 커넥션 수에 대한 명시적 상한이 없다
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts:158` (`@Throttle({ default: { limit: 20, ttl: 60_000 } })`), `codebase/backend/src/modules/integrations/database-connection-tester.ts:17-18`(`DB_TEST_TIMEOUT_MS = 10_000`)
  - 상세: `preview-test`/`:id/test`/`rotate` 세 경로 모두 분당 20회로 스로틀되지만, 이는 "요청 수" 제한이지 "동시에 열려 있는 아웃바운드 DB 커넥션 수"를 제한하지 않는다. 연결(최대 10s) + 쿼리(최대 10s) 타임아웃이 각각 걸려 있어 한 요청이 최대 ~20초까지 커넥션을 붙들 수 있으므로, 여러 워크스페이스/사용자가 동시에 이 엔드포인트를 호출하면 대상 외부 DB 쪽에 순간적으로 여러 개의 미완료 연결이 쌓일 수 있다. 다만 이는 이 앱 자신의 DB 풀이 아니라 사용자가 등록한 **외부** 대상 DB에 대한 부하이고, per-endpoint 스로틀이 어느 정도 완화하므로 심각도는 낮다.
  - 제안: 현재로선 조치 불요. 운영 중 외부 대상 DB에 대한 동시 연결 폭주가 문제가 되면 global concurrency cap(세마포어) 도입을 고려.

- **[정합성 확인 — 문제 없음]** SQL 인젝션 없음
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts:45`(`await client.query('SELECT 1')`), `:64`(`await connection.query({ sql: 'SELECT 1', timeout: DB_TEST_TIMEOUT_MS })`)
  - 상세: 두 드라이버 모두 리터럴 `'SELECT 1'` 만 실행하며 사용자 입력이 SQL 문자열에 보간되지 않는다. 신규 e2e 스펙(`codebase/backend/test/integration-connection-test.e2e-spec.ts:142-145`)의 검증 쿼리 `'SELECT last_rotated_at, credentials::text AS credentials FROM integration WHERE id = $1'` 도 `$1` 파라미터 바인딩을 쓴다 — 인젝션 경로 없음.

- **[정합성 확인 — 문제 없음]** 에러 메시지 길이 클램프로 컬럼 오버플로 방지
  - 위치: `codebase/backend/src/modules/integrations/clamp-message.ts:10-15`, `database-connection-tester.ts:110`, `http-connection-tester.ts:183`
  - 상세: 드라이버가 반환하는 자유 형식 에러 메시지를 `MCP_ERROR_MESSAGE_MAX_LEN` 으로 잘라 `last_error` JSONB 컬럼·`IntegrationUsageLog.error.message` 저장 시 과도한 크기 유입을 막는다. 기존 서비스 파일에 있던 로직을 별 파일로 추출만 한 것으로 동작 변화 없음(`integrations.service.ts` diff에서 동일 함수 제거 확인).

- **[정합성 확인 — 문제 없음]** 트랜잭션 / 스키마 / 마이그레이션 / 인덱스 / N+1 / 페이지네이션
  - 이번 변경 셋(Database·HTTP 커넥션 테스터, 자격증명 헬퍼 추출, DTO 문서 필드 추가)에는 이 앱 자체 DB에 대한 다건 쓰기·조회 로직이나 스키마 변경이 없다. `SELECT 1`/`GET base_url` 은 각각 단발성 프로브이고 반복문 내 쿼리(N+1)도 없다. 자격증명 교체(`rotate`)의 원자성 로직 자체는 이번 diff 범위 밖(기존 코드 미변경)이라 별도 평가 대상이 아니다.

## 요약

이번 변경은 Database/HTTP 통합의 연결 테스트가 실제로 접속하도록 만드는 기능 추가로, 앱 자신의 데이터베이스 스키마·트랜잭션·인덱스에는 영향이 없다. 데이터베이스 관점에서 유일하게 살펴볼 대상은 신규 `probePostgres`/`probeMysql` 의 일회성 커넥션 처리인데, 연결·쿼리 양쪽에 10초 타임아웃을 걸고 `try/finally` 로 성공·실패 무관하게 반드시 닫으며 종료 실패도 삼켜 판정을 오염시키지 않는다 — 커넥션 누수나 무한 대기 경로가 보이지 않는다. SQL 은 리터럴 `SELECT 1` 과 e2e 검증용 `$1` 파라미터 바인딩만 사용해 인젝션 위험이 없고, 드라이버 원문 에러 메시지는 `clampMessage` 로 길이를 제한해 JSONB 컬럼 팽창을 막는다. 유일한 관찰 사항은 연결 테스트 엔드포인트가 요청 수는 스로틀하지만 동시 아웃바운드 커넥션 수 자체는 제한하지 않는다는 점인데, 이는 이 앱의 DB가 아닌 사용자가 등록한 외부 대상 DB에 대한 부하이고 현재 심각도는 낮다.

## 위험도

LOW
