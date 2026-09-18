# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** 신규 인덱스는 `workflow_id` 단일 컬럼이며, 삭제 경로의 세 조회(외부 해제 열거·비밀 정리 열거·FK CASCADE)가 모두 등치 술어 하나뿐임을 실측(EXPLAIN, 20k~320k행)으로 확인했다. 워크스페이스 삭제 경로는 기존 `(workspace_id, type)` 인덱스의 선두 컬럼으로 이미 커버되어 이번 추가와 충돌하지 않는다.
  - 위치: `codebase/backend/migrations/V111__trigger_workflow_id_index.sql:31-33`
  - 상세: 인덱스 설계 자체는 적절하다 — 복합 인덱스가 줄 이득이 없다는 근거(정렬·추가 술어 없음)가 spec Rationale(`spec/1-data-model.md`)에 명시돼 있다.
  - 제안: 조치 불요.

- **[INFO]** `CREATE INDEX CONCURRENTLY` 앞에 `DROP INDEX CONCURRENTLY IF EXISTS`(0단계)를 두는 패턴은 실패 후 재실행 시 invalid 잔재가 이름을 영구 점유하는 문제(V106 선례)를 막지만, "정상 인덱스인지 invalid 잔재인지 구분하지 않는" 비대칭을 감수한다 — 이미 성공한 마이그레이션을 수동으로 재실행하면 정상 인덱스도 지우고 재빌드(그 구간 seq scan)한다.
  - 위치: `codebase/backend/migrations/V111__trigger_workflow_id_index.sql:31` / 정책 문서 `codebase/backend/migrations/README.md` §5 "신규 추가에도 0) 을 둡니다"
  - 상세: 신규 추가 인덱스라 옛 인덱스를 잃을 위험은 없고(교체 케이스보다 비용이 작음), 이 트레이드오프는 README·spec Rationale·plan 세 곳에 이미 문서화되어 있어 새로운 리스크는 아니다.
  - 제안: 조치 불요 — 향후 `indisvalid` 분기(`DO $$ ... $$`)로 완전 no-op 재실행을 원하면 Flyway `mixed=true` 도입 여부를 별도 결정 항목으로 남긴 것을 그대로 따른다.

- **[INFO]** `.conf`(`executeInTransaction=false`)로 비-트랜잭션 모드가 정확히 설정돼 있고, 파일당 `CREATE INDEX CONCURRENTLY` 가 정확히 1개(컨벤션 §5 준수)이며, `DROP`/`CREATE` 모두 `CONCURRENTLY`라 `ACCESS EXCLUSIVE` 락 없이 무중단 배포에 안전하다. Dockerfile 이 `COPY V*.sql`/`COPY V*.conf` 와일드카드라 V111 자동 포함, 별도 배선 불요를 확인했다.
  - 위치: `codebase/backend/migrations/V111__trigger_workflow_id_index.conf:1-4`, `codebase/backend/migrations/Dockerfile:24,28`
  - 상세: 마이그레이션 번호(V111) grep 재확인 결과 저장소 내 유일 — 신규 충돌 없음.
  - 제안: 조치 불요.

- **[INFO]** `TriggerResourceReleaserService.releaseExternalForParent` 의 `find()` 에 `select: { id, type, config }` 를 추가해 불필요한 컬럼(비밀 ref·헬스·타임스탬프)의 조회·전송을 줄였다. 스케줄 조회는 `In(scheduleTriggerIds)` 로 일괄 배치돼 있어 N+1 이 아니며(트리거 수만큼 개별 쿼리하지 않음), 이 diff 는 그 배치 구조를 바꾸지 않는다.
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:72-77`
  - 상세: `select` 축소가 `config.chatChannel` 을 빼먹으면 teardown 이 조용히 no-op 되는 위험은 단위 테스트(뮤턴트: `config`/`type` 제거 시 RED 확인됨)로 방어되어 있다.
  - 제안: 조치 불요.

- **[INFO]** e2e 스키마 단언이 인덱스 `존재` 뿐 아니라 `indisvalid = true` 와 `pg_get_indexdef` 정의(선두 컬럼·btree)까지 확인해, `CREATE INDEX CONCURRENTLY` 실패로 인한 invalid 인덱스를 "존재만 보는 단언"이 통과시키는 회귀 클래스를 막는다.
  - 위치: `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts:199-212`
  - 상세: 좋은 방어적 테스트 설계.
  - 제안: 조치 불요.

## 요약
이번 변경은 `trigger.workflow_id` 에 대한 FK 미인덱스로 인해 워크플로 삭제가 트리거 테이블을 세 번(외부 해제 열거·비밀 정리 열거·FK CASCADE) 전부 스캔하던 문제를, `CREATE INDEX CONCURRENTLY`(비-트랜잭션, 무중단) 로 해결한다. 마이그레이션 안전성(락 회피·재실행 안전성·번호 충돌 부재)·인덱스 설계(단일 등치 술어에 맞는 단일 컬럼)·연관 쿼리 최적화(`select` 컬럼 축소, N+1 없음)가 모두 실측·문서화와 함께 검증됐고, 재실행 시의 비대칭 트레이드오프도 README/spec Rationale에 명시적으로 남아 있다. Critical/Warning 급 결함은 발견되지 않았다.

## 위험도
NONE
