# 데이터베이스(Database) 리뷰 — webhook endpoint_path 전역 유일화 (V131/V132)

## 발견사항

- **[INFO]** V131 dedupe DO 블록은 전체 `trigger` 테이블을 스캔·정렬한다
  - 위치: `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql:32-40` (`row_number() OVER (PARTITION BY endpoint_path ORDER BY created_at, id)` 서브쿼리)
  - 상세: 이 창함수는 `trigger` 테이블 전체(`endpoint_path IS NOT NULL`)를 훑어 정렬한다. 마이그레이션 시점엔 V002 의 `(workspace_id, endpoint_path)` 복합 UNIQUE 인덱스만 있고 `endpoint_path` 단독 선두 인덱스가 없어 인덱스를 못 쓰고 seq scan + sort 가 된다. 다만 이 파일 자체 실측(«웹훅 트리거 5만»)과 헤더 주석의 "옛 스키마에 중복을 심은 프로브" 근거로 볼 때 정상 규모에서는 문제되지 않는 크기이고, 일회성 데이터 정리 마이그레이션이라 반복 비용도 없다.
  - 제안: 조치 불요(수용 가능한 일회성 비용). 다만 향후 `trigger` 테이블이 수백만 행 규모로 커진 뒤 유사한 전수-스캔 정리 마이그레이션을 또 써야 한다면, 이 창함수 방식이 아니라 배치(청크) 처리를 검토할 것.

- **[INFO]** V131 DO 블록이 트랜잭션 하나 안에서 중복 그룹마다 개별 `UPDATE` 를 반복한다(서버측 루프, 앱 레벨 N+1 아님)
  - 위치: `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql:41-48` (`FOR r IN ... LOOP UPDATE trigger SET endpoint_path = ... WHERE id = r.id; ... END LOOP;`)
  - 상세: PL/pgSQL 루프 내 행 단위 `UPDATE` 는 애플리케이션 코드의 N+1 쿼리 패턴과 달리 왕복 없이 DB 엔진 안에서 실행되므로 성능 영향이 미미하다. 정상 운영에서는 중복이 발생하지 않는다는 설계 전제(복제·가져오기는 트리거를 옮기지 않음)상 대상 행 수가 매우 적을 것으로 예상돼 트랜잭션 보유 시간도 짧다.
  - 제안: 조치 불요. 참고로만 기재.

- **[INFO]** 잘 설계된 무중단 인덱스 교체 — CONCURRENTLY + DROP-먼저 패턴 정확히 준수
  - 위치: `codebase/backend/migrations/V132__trigger_endpoint_path_global_unique.sql:21-25`, `V132__trigger_endpoint_path_global_unique.conf:4`
  - 상세: `DROP INDEX CONCURRENTLY IF EXISTS idx_trigger_endpoint_path`(invalid 잔재 정리) → `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_trigger_endpoint_path ON trigger (endpoint_path) WHERE endpoint_path IS NOT NULL` → `DROP INDEX CONCURRENTLY IF EXISTS idx_trigger_workspace_endpoint` 순서는 `migrations/README.md` §5 "인덱스 교체는 DROP-먼저"(V110 선례)를 정확히 따른다. `.conf` 의 `executeInTransaction=false` 와 트랜잭션(DO 블록)이 필요한 V131 을 별 파일로 분리한 것도 README §5 "mixed 판정"(2026-09-05 실측)과 일치한다. `CREATE UNIQUE INDEX CONCURRENTLY` 실패 시 invalid 인덱스가 남는 경우에 대한 운영 절차(수동 V131 재실행 → repair → migrate)도 파일 헤더에 명시돼 있어, 무중단 배포 관점에서 필요한 항목을 모두 갖췄다.
  - 제안: 없음(모범 사례로 판단).

- **[INFO]** 삭제되는 `idx_trigger_workspace_endpoint` 를 다른 쿼리 경로가 성능 목적으로 의존하고 있지 않음을 확인
  - 위치: 확인 대상 — `codebase/backend/src/modules/triggers/triggers.service.ts` (`findByEndpointPath`, `isEndpointPathUniqueViolation`), `codebase/backend/src/modules/hooks/{hooks.service.ts,embed-config.service.ts,public-webhook-throttle.guard.ts}`
  - 상세: 저장소 전수 grep 결과 `idx_trigger_workspace_endpoint` 문자열은 `triggers.service.ts` 의 상수(이번 diff 로 새 인덱스명으로 값이 바뀜)와 그 테스트 fixture 뿐이었다. 수신 조회 3곳(`hooks.service.ts:115`, `embed-config.service.ts:44`, `public-webhook-throttle.guard.ts:70`)은 이미 `endpoint_path` 단독으로만 필터링하고 있어 새 전역 UNIQUE 인덱스의 직접 수혜자다. `triggers.service.ts` 의 `findByEndpointPath(workspaceId, endpointPath)` 는 여전히 두 컬럼으로 필터링하지만, `endpoint_path` 가 전역 유일이 된 이상 그 조건만으로 이미 최대 1행이라 워크스페이스 필터는 결과 행 위에서의 부가 검증일 뿐 플래너가 새 unique partial index 를 쓰는 데 지장이 없다.
  - 제안: 조치 불요.

- **[INFO]** 트랜잭션·에러 매핑 로직은 인덱스 이름 상수 값 변경뿐 — 별도 트랜잭션 정합성 이슈 없음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`, `isEndpointPathUniqueViolation`, `rethrowEndpointPathConflict`)
  - 상세: 이번 diff 는 SQLSTATE 23505 위반을 인덱스 이름으로 좁히는 기존 로직의 상수 값(`'idx_trigger_workspace_endpoint'` → `'idx_trigger_endpoint_path'`)과 사용자 메시지 문구만 바꾼다. DB 트랜잭션 경계·저장 로직 자체는 변경되지 않았고, 인덱스 이름이 어긋나면 조용히 `false` 를 반환해 전역 `RESOURCE_CONFLICT` 로 안전하게 되돌아가는 fail-safe 설계가 유지된다. `triggers.service.spec.ts` 가 옛 이름(`idx_trigger_workspace_endpoint`)이 더 이상 좁히지 않는 방향까지 새로 검증한다.
  - 제안: 없음.

- **[INFO]** SQL 인젝션 위험 없음
  - 위치: `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql`, `V132__trigger_endpoint_path_global_unique.sql`
  - 상세: 두 마이그레이션 모두 사용자 입력이 개입하지 않는 정적 DDL/DML(`gen_random_uuid()`, 고정 컬럼명)이다. TypeORM 리포지토리 경유 코드(`hooks.service.ts` 등)도 파라미터 바인딩을 쓴다.
  - 제안: 없음.

- **[INFO]** e2e 테스트가 스키마 레벨(인덱스 유효성·정의)과 데이터 레벨(중복 정리 로직·NOTICE 비밀 미노출·멱등성)을 모두 검증
  - 위치: `codebase/backend/test/trigger-endpoint-path-dedupe.e2e-spec.ts` 전체, `codebase/backend/test/webhook-trigger.e2e-spec.ts` B5/B6 케이스
  - 상세: `trigger-endpoint-path-dedupe.e2e-spec.ts` 는 임시 스키마 + `search_path` 치환으로 V131 SQL 파일을 그대로(파일 위치 참조) 실제 PostgreSQL 에서 실행해 정리 규칙(가장 먼저 만든 행 유지, `created_at` 동률 시 `id` 순, v4 형식 재발급, NOTICE 비밀 미노출, 재실행 멱등)을 검증한다. `webhook-trigger.e2e-spec.ts` B6 은 `pg_index`/`pg_get_indexdef` 로 새 인덱스의 `indisvalid`·`indisunique`·정의(선두 컬럼·partial 조건)까지 대조해, README 가 경고하는 "이름만 점유한 invalid 인덱스" 실패 모드를 놓치지 않는다. B5 는 교차 워크스페이스 충돌·PATCH 거부 시 원자성(반영 안 됨)·수신 라우팅 정확성까지 확인한다. 데이터베이스 관점에서 이 정도 커버리지는 드물게 견고하다.
  - 제안: 없음(참고용 긍정 기재).

## 요약

이번 변경의 핵심은 `trigger.endpoint_path` 유일성 범위를 워크스페이스 단위에서 전역으로 옮기는 2단계 마이그레이션(V131 데이터 정리 → V132 인덱스 교체)이다. V131 은 트랜잭션 안에서 중복 그룹을 정리하고, V132 는 `migrations/README.md` §5 의 "인덱스 교체는 DROP-먼저" + `CONCURRENTLY` 패턴을 정확히 따라 무중단으로 옛 복합 UNIQUE 인덱스를 새 전역 partial UNIQUE 인덱스로 교체한다. CONCURRENTLY 실패 시 invalid 인덱스 잔재에 대한 운영 절차, V131-V132 사이 경쟁 조건에 대한 재실행 절차가 파일 헤더에 명시돼 있고, 이 인덱스 교체가 성능(수신 조회 워크스페이스 몰라도 O(1) 탐색)과 보안(가로채기 방지) 두 목적을 동시에 달성한다는 근거도 실측치로 뒷받침된다. 애플리케이션 코드 변경은 인덱스 이름 상수·에러 메시지 문구 수준으로 국한돼 트랜잭션·커넥션 관리·SQL 인젝션 관점에서 새로 발생한 위험은 없다. e2e 테스트가 스키마 유효성과 데이터 정리 로직 양쪽을 실제 PostgreSQL 로 검증하고 있어 마이그레이션 안전성에 대한 근거가 충분하다. Critical/Warning 급 결함은 발견되지 않았다.

## 위험도

LOW
