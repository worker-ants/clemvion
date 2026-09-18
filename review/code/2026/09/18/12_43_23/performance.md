# 성능(Performance) 코드 리뷰

## 리뷰 대상 요약
- `codebase/backend/migrations/V111__trigger_workflow_id_index.{sql,conf}` — `trigger (workflow_id)` 신규 CONCURRENTLY 인덱스
- `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts` — `releaseExternalForParent` 의 `find()` 에 `select: { id, type, config }` 컬럼 좁히기
- 대응 unit/e2e 테스트, spec 문서(`spec/1-data-model.md`, `spec/data-flow/10-triggers.md`) 갱신
- `plan/`·`review/consistency/**` 산출물 (문서, 실행 코드 아님)

## 발견사항

- **[INFO]** 신규 인덱스의 쓰기측(INSERT) 비용은 정성적 서술만 있고 정량 벤치마크가 없음
  - 위치: `codebase/backend/migrations/V111__trigger_workflow_id_index.sql:18` (`-- 크기: 320,000행에서 4.5 MB … 쓰기 비용은 INSERT 때뿐.`)
  - 상세: 조회(열거·CASCADE) 3개 경로에 대해서는 20k/80k/320k 행 규모의 실측 표(Seq Scan → Bitmap Index Scan)가 상세히 제시되어 근거가 탄탄하다. 반면 INSERT 경로에 대한 비용은 "v1 에서 `workflow_id` 가 불변이라 쓰기 비용은 INSERT 때뿐" 이라는 정성적 주장만 있고, 실제 INSERT 처리량/지연 영향은 측정되지 않았다. 단일 btree 컬럼 추가라 일반적으로 무시할 수준이지만, 트리거 생성이 매우 빈번한 워크로드라면(예: 대량 import) 이 인덱스가 다른 3개 기존 인덱스(`(workspace_id, type)`, `(workspace_id, endpoint_path) UNIQUE`, `notification_health` 부분 인덱스)에 더해 4번째 인덱스 유지 비용을 추가한다.
  - 제안: 필수는 아니나, INSERT 벤치마크를 남기면 향후 "쓰기 비용 무시 가능" 주장이 완전히 실측 기반이 된다. 현재도 결정을 막을 정도의 문제는 아님.

- **[INFO]** 같은 클래스(부모 FK 선두 인덱스 부재)의 나머지 6건은 의도적으로 defer — 새로운 결함 아님
  - 위치: `spec/1-data-model.md:979` (`## Rationale` «Trigger `(workflow_id)` 인덱스» 절, "같은 클래스 전수" 문단) / `plan/in-progress/spec-draft-trigger-workflow-index.md` `## 트래커 반영`
  - 상세: `integration_usage_log.workflow_id`, `alert_rule.workflow_id` 등 6개 FK 도 선두 인덱스가 없어 CASCADE 시 전체 스캔이 발생할 수 있으나, 이 PR 은 트리거만 다룬다(#1346 이 트리거 삭제 경로 쿼리를 3배로 늘린 것이 트리거를 우선순위로 만든 이유). 이미 트래커에 정확히 등재되어 있어 새로 지적할 결함은 아니고, 리뷰어로서 "잊혀지지 않았다" 는 것만 확인함.

## 긍정적 관찰 (성능 개선점, 결함 아님)

- V111 인덱스는 실측 기반(20k/80k/320k 행, PostgreSQL 18)으로 필요성이 정량 검증되었고, `Seq Scan`/`Parallel Seq Scan`(최대 11ms) → `Bitmap Index Scan`(0.05ms 이하)으로 워크플로 삭제 경로의 세 쿼리(외부 해제 열거, 비밀 정리 열거, FK CASCADE) 전부가 개선된다. 이 중 두 쿼리는 `workflow` 행 잠금을 쥔 채 실행되므로 그 구간의 락 보유 시간을 줄이는 효과도 있다.
- `CREATE INDEX CONCURRENTLY` + `executeInTransaction=false`(.conf) 조합으로 인덱스 생성 중 `trigger` 테이블에 대한 쓰기 차단을 피한다. `DROP INDEX CONCURRENTLY IF EXISTS` 를 앞에 둔 것은(README §5 가 지적하는 "실패한 CREATE 가 남긴 invalid 인덱스가 영영 회복 안 되는" 결함 클래스를 예방) 신규 인덱스라 잃을 기존 인덱스가 없으므로 재실행 시 seq scan 구간만 재현되는 정도의 낮은 비용이다.
- `TriggerResourceReleaserService.releaseExternalForParent` 의 `find()` 를 `select: { id, type, config }` 로 좁힌 것은 불필요한 컬럼(비밀 참조, 헬스 상태, 타임스탬프 등) 적재를 제거하는 실질적인 메모리/네트워크 절감이다. 워크스페이스 삭제처럼 트리거 전체를 한 번에 로드하는 경로에서 특히 유효하다.
- `releaseExternalMany` 는 schedule 대상 트리거의 스케줄 행을 `In(scheduleTriggerIds)` 로 배치 조회하여(N+1 아님) 기존에도 올바르게 구성되어 있었고, 이번 diff 로 그 구조가 깨지지 않았다.
- `lockParentAndListTriggerIds` 도 `select: { id: true }` 로 최소 컬럼만 적재하도록 이미 구성되어 있다(이번 diff 대상 아님, 컨텍스트로 확인).

## 요약
이번 변경은 두 축 모두 성능 개선 방향이다 — (1) 워크플로 삭제 경로가 `trigger` 테이블을 인덱스 없이 3회 전수 스캔하던 문제를 실측(4자리 수 규모 벤치마크) 기반으로 해소하는 `CONCURRENTLY` 인덱스 추가, (2) 외부 자원 해제 조회의 컬럼 과다 적재를 3개 필드로 좁힌 것. 새로 도입된 성능 결함은 발견되지 않았고, 유일한 관찰 사항은 INSERT 측 비용이 정성적 근거에만 의존한다는 점과 동일 클래스의 나머지 6개 FK 가 별도 트래커로 미뤄져 있다는 점(둘 다 이미 문서화·추적됨)이다.

## 위험도
NONE
