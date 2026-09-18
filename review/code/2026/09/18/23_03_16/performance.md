# 성능(Performance) 코드 리뷰

## 리뷰 범위

이번 변경은 애플리케이션 로직이 아니라 순수 DB 마이그레이션(V121~V130, 10개 인덱스 신설 + `.conf`)과
그에 대응하는 e2e 검증 테스트(`deletion-cascade-indexes.e2e-spec.ts`) 갱신, spec/plan 문서다. 목적은
FK 트리거 조회 또는 목록 조회가 선두 인덱스 없이 순차 스캔하던 31개 FK 컬럼 중 인덱스가 필요하다고
판정된 10개에 인덱스를 신설하는 것이다.

## 발견사항

- **[INFO]** 파티셜/풀 인덱스 선택이 실제 컬럼 nullability 와 전부 일치함을 확인
  - 위치: `codebase/backend/src/modules/edges/entities/edge.entity.ts:43`(target_node_id, NOT NULL → V121 풀 인덱스), `codebase/backend/src/modules/folders/entities/folder.entity.ts:29`(parent_id, nullable → V124 partial), `codebase/backend/src/modules/workflows/entities/workflow.entity.ts:38`(folder_id, nullable → V123 partial), `codebase/backend/src/modules/triggers/entities/trigger.entity.ts:70`(auth_config_id, nullable → V126 partial), `codebase/backend/src/modules/workflow-assistant/entities/workflow-assistant-session.entity.ts:51`(llm_config_id, nullable → V125 partial), `codebase/backend/src/modules/llm/entities/llm-usage-log.entity.ts:32`(llm_config_id, nullable → V122 partial), `codebase/backend/src/modules/auth-configs/entities/auth-config.entity.ts:18`(workspace_id, NOT NULL → V127 풀), `codebase/backend/src/modules/workspaces/entities/workspace-member.entity.ts:26`(user_id, NOT NULL → V129 풀)
  - 상세: FK 트리거의 등치 조회(`$1 = col`)는 `col IS NOT NULL` 조건의 partial 인덱스만 쓸 수 있다는 전제(V115~V118 선례)를 이번 10개 전부에서 실측 결과가 아니라 코드(entity nullable 여부)로 교차 검증했다. 전 항목이 일치한다 — nullable 컬럼은 partial(`WHERE col IS NOT NULL`), NOT NULL 컬럼은 풀 인덱스. `model_config.workspace_id`(V130, NOT NULL)도 마찬가지로 풀 인덱스이며, 기존 partial UNIQUE(`WHERE is_default=true`, V089)와 조건이 달라 두 인덱스가 서로 대체하지 않고 공존해야 하는 것도 코드상 맞다.
  - 제안: 없음 — 검증 결과 기재만.

- **[INFO]** `CREATE/DROP INDEX CONCURRENTLY` + `executeInTransaction=false` 패턴이 10개 마이그레이션 전부에서 V111~V120 선례와 동일하게 일관 적용됨
  - 위치: `codebase/backend/migrations/V121__edge_target_node_id_index.sql` ~ `V130__model_config_workspace_kind_index.sql` 전체
  - 상세: 큰 테이블(`llm_usage_log` 223MB, `edge` 108MB)에 대한 인덱스 신설도 프로덕션 쓰기 트래픽을 블로킹하지 않는 `CONCURRENTLY` 를 쓴다. `DROP INDEX CONCURRENTLY IF EXISTS` 를 앞세워 이전 실패 시도의 invalid 인덱스 잔재를 정리하는 것도 반복 실행 안전성 측면에서 타당하다. e2e 테스트(`deletion-cascade-indexes.e2e-spec.ts`)가 `indisvalid` 까지 대조해 invalid 인덱스가 조용히 남는 것을 잡아낸다.
  - 제안: 없음.

- **[INFO]** 대용량 테이블(`llm_usage_log`, 실측 기준 약 200만 행/223MB)에서 `CREATE INDEX CONCURRENTLY` 는 두 번의 전체 테이블 스캔과 `ShareUpdateExclusiveLock` 유지 시간을 요구한다 — 실제 프로덕션 규모(문서상 실측은 W=10,000 규모)가 이 문서 벤치마크보다 훨씬 크면 배포 시 마이그레이션 자체의 실행 시간이 늘어날 수 있다
  - 위치: `codebase/backend/migrations/V122__llm_usage_log_llm_config_id_index.sql:8`(문서화된 벤치마크 규모 명시부)
  - 상세: 이는 이번 PR 이 새로 만든 리스크가 아니라 `CONCURRENTLY` 인덱스 생성의 일반적 특성이고, V111~V120 에서도 동일하게 감수한 트레이드오프다. 다만 문서에 "PostgreSQL 18, W=10,000" 규모의 조회/삭제 지연 개선치만 있고 인덱스 **빌드 자체의 소요 시간**(배포 운영 관점)은 명시되어 있지 않다.
  - 제안: 필수 아님(선례와 동일 패턴). 배포 runbook 에 "대상 테이블이 문서 벤치마크보다 훨씬 크면 CONCURRENTLY 빌드 시간이 비례해 늘 수 있다"는 한 줄만 있으면 운영 관점에서 충분.

- **[INFO]** 쓰기 비용 실측이 전 인덱스에서 행당 개별로 문서화되어 향후 회귀 판단 기준이 된다
  - 위치: 10개 `.sql` 파일 각 헤더 주석(`쓰기 비용:` 문단)
  - 상세: `edge`(+1.7~2.2 µs), `llm_usage_log`(+1.8~2.1 µs) 등 호출 빈도가 높은 테이블의 쓰기 비용이 마이크로초 단위로 무시할 만함을 실측으로 뒷받침한다. 인덱스를 늘릴 때 흔히 누락되는 "쓰기 대가" 항목을 매 마이그레이션마다 빠짐없이 기록한 점이 인상적이다.
  - 제안: 없음.

## 요약

이번 변경은 애플리케이션 코드가 아닌 순수 인덱스 신설 마이그레이션 10건으로, 각각 (1) FK 트리거 조회 또는 (2) 목록/조회 API 의 순차 스캔을 해소한다. Partial vs 풀 인덱스 선택을 실제 entity nullable 선언과 대조한 결과 전부 일치했고, `CONCURRENTLY` + `executeInTransaction=false` + `DROP...IF EXISTS` 선행 패턴도 기존 V111~V120 선례와 일관되게 적용되어 있다. 쓰기 비용도 인덱스마다 실측으로 문서화되어 트레이드오프가 투명하다. 알고리즘 복잡도·N+1·캐싱·블로킹 I/O 등 다른 관점에서 지적할 애플리케이션 코드 변경은 이번 diff 에 없다(리뷰 대상 나머지 파일은 e2e 테스트·spec 문서·리뷰 산출물이며 실질적 성능 리스크가 없다). 발견된 사항은 전부 INFO 수준의 확인·참고이며, CRITICAL/WARNING 급 성능 결함은 없다.

## 위험도

NONE
