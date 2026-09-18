# 성능(Performance) 리뷰 — 웹훅 `endpoint_path` 전역 유일 (V131/V132) 외

## 발견사항

- **[INFO]** V131 dedupe 마이그레이션은 `trigger` 테이블의 `endpoint_path IS NOT NULL` 행 전체를 대상으로 윈도우 함수 정렬(`row_number() OVER (PARTITION BY endpoint_path ORDER BY created_at, id)`)을 1회 수행한다
  - 위치: `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql:32`~`39` (`FOR r IN SELECT ... row_number() OVER (...) ... FROM trigger WHERE endpoint_path IS NOT NULL`)
  - 상세: 기존 부분 인덱스(`idx_trigger_workspace_endpoint`)는 `(workspace_id, endpoint_path)` 순으로 정렬돼 있어 `PARTITION BY endpoint_path` 단독 정렬과 선두 컬럼이 맞지 않는다 — 옵티마이저가 이 인덱스를 그대로 못 쓰고 웹훅 트리거 전체를 별도로 정렬할 가능성이 높다(Seq Scan + Sort). 다만 (a) 이 마이그레이션은 Flyway 로 딱 한 번만 실행되고, (b) 정상 경로로는 중복이 생기지 않아(파일 자체 주석) 후속 `UPDATE`·`RAISE NOTICE` 는 실제 중복 건수(기대값 0에 가까움)만큼만 도는 구조라 반복문 자체는 비용이 적다. 정렬 대상 행 수가 웹훅 트리거 5만 규모(plan 문서 실측 기준)라면 O(n log n) 정렬은 수백 ms 내로 끝날 규모라 실질적 문제는 아니다. 트리거 수가 훨씬 큰 설치(수백만 행)에서는 이 1회성 정렬이 유의미한 시간을 차지할 수 있으니, 실제 운영 DB 적용 전 `EXPLAIN`으로 플랜을 한 번 확인해 두는 편이 안전하다.
  - 제안: 별도 수정은 불필요 — 다만 마이그레이션 적용 창(운영 절차 ①에 이미 기술된 "경쟁 대응" 수동 재실행 시나리오 포함)에서 정렬 비용이 예상보다 크면 재시도 시간에 영향을 줄 수 있음을 운영 절차에 한 줄 참고로 남겨도 좋다.

- **[INFO]** (긍정적 확인) V132 의 인덱스 교체는 핫패스 조회 성능을 개선하면서 인덱스 개수·쓰기 오버헤드는 늘리지 않는다
  - 위치: `codebase/backend/migrations/V132__trigger_endpoint_path_global_unique.sql:21`~`25` (`DROP INDEX CONCURRENTLY ... idx_trigger_endpoint_path` → `CREATE UNIQUE INDEX CONCURRENTLY ... idx_trigger_endpoint_path ON trigger (endpoint_path) WHERE ...` → `DROP INDEX CONCURRENTLY ... idx_trigger_workspace_endpoint`)
  - 상세: 워크스페이스 무관 수신 조회(`hooks.service` · `public-webhook-throttle.guard` · `embed-config.service` — `WHERE endpoint_path = ?`)가 옛 `(workspace_id, endpoint_path)` 복합 부분 인덱스로는 선두 컬럼이 맞지 않아 인덱스 전체 스캔이 필요했는데, 새 단일 컬럼 부분 인덱스는 정확히 이 조회 패턴에 맞아 직접 탐색이 가능하다. 코멘트에 실측치(웹훅 트리거 5만에서 0.200 ms → 0.025 ms)가 남아 있고, `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md:58`~`70` 실측 표와도 일치해 근거가 확인된다. 옛 인덱스 1개를 새 인덱스 1개로 **교체**하는 구조(`DROP`→`CREATE`→`DROP`)라 트리거 `INSERT`/`UPDATE` 시 유지해야 할 인덱스 총수는 변하지 않는다 — 조회 성능 개선이 쓰기 경로 비용 증가 없이 달성된다.
  - 제안: 없음 — 개선 확인.

- **[INFO]** (긍정적 확인) 인덱스 교체가 `CONCURRENTLY` + `.conf`(`executeInTransaction=false`)로 수행돼 트랜잭션 블로킹·전체 테이블 락 없이 이루어진다
  - 위치: `codebase/backend/migrations/V132__trigger_endpoint_path_global_unique.conf:4`, `V132__trigger_endpoint_path_global_unique.sql:21`~`25`
  - 상세: `CREATE/DROP INDEX CONCURRENTLY` 는 테이블에 대한 배타 락 없이 동작해 마이그레이션 적용 중에도 웹훅 수신·트리거 CRUD 가 정상 동작한다. 운영 절차 ①에 CONCURRENTLY 실패 시 invalid 잔재가 남는 경우의 복구 절차(0) DROP 선행)도 README §5·V110 선례를 그대로 따른다.
  - 제안: 없음.

- **[NONE]** `triggers.controller.ts`/`triggers.service.ts` 변경은 문자열 상수 추출·값 치환(`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX` 값, 에러 메시지 문구)뿐이며 쿼리 패턴·호출 횟수·자료구조에는 변화가 없다
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:50`(상수 도입), `codebase/backend/src/modules/triggers/triggers.service.ts:228`(인덱스명 상수 값 교체)
  - 상세: `isEndpointPathUniqueViolation`/`rethrowEndpointPathConflict` 는 여전히 DB 가 이미 실행한 INSERT/UPDATE 의 에러를 사후 검사하는 방식이라, 사전 존재 확인용 별도 SELECT(N+1 유발 가능 지점)를 추가하지 않았다 — 동시성 경합을 DB UNIQUE 제약에 위임하는 기존 설계를 그대로 유지.
  - 제안: 없음.

- **[NONE]** e2e/unit 테스트 추가(`trigger-endpoint-path-dedupe.e2e-spec.ts`, `webhook-trigger.e2e-spec.ts` B5/B6, `triggers.service.spec.ts`)는 소규모 고정 fixture(행 7개 이하) 기반이라 테스트 자체의 성능 영향은 없다
  - 위치: `codebase/backend/test/trigger-endpoint-path-dedupe.e2e-spec.ts:71`~`86`(rows 배열 7행)
  - 상세: 프로덕션 코드 경로·자료구조 변경 없음.
  - 제안: 없음.

## 요약

이번 변경의 핵심(V131 dedupe + V132 전역 UNIQUE 인덱스 교체)은 보안 결함(워크스페이스 간 웹훅 경로 가로채기) 수정이 목적이지만, 성능 관점에서는 부수적으로 순수 이득이다 — 옛 `(workspace_id, endpoint_path)` 복합 인덱스가 워크스페이스 미상 수신 조회에서 강제하던 인덱스 전체 스캔을 단일 컬럼 부분 인덱스로 교체해 핫패스 쿼리(0.200 ms → 0.025 ms, 실측 근거 확인됨)를 개선했고, 인덱스 개수는 1:1 교체라 쓰기 경로 오버헤드도 늘지 않았으며, `CONCURRENTLY` 로 무중단 적용이 보장된다. 유일한 관찰 대상은 V131 의 1회성 dedupe 가 웹훅 트리거 전체를 대상으로 윈도우 함수 정렬을 수행한다는 점인데, 정상 경로에서는 중복이 없어 반복 처리 자체는 사실상 비용이 없고 정렬 비용도 문서화된 실측 규모(5만 행)에서는 무시할 수준이다 — 대규모 설치에서 운영 적용 전 플랜 확인을 권고하는 정도의 INFO 수준 관찰이다. 애플리케이션 코드(controller/service) 변경은 상수·문자열 교체뿐이라 성능에 영향이 없다.

## 위험도

NONE
