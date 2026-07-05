# 보안(Security) 리뷰 — trigger-list-cron-nextrun (V106 인덱스 추가분)

## 발견사항

- **[INFO]** V106 마이그레이션은 순수 성능 인덱스이며 보안 영향 없음
  - 위치: `codebase/backend/migrations/V106__schedule_trigger_id_index.sql`, `codebase/backend/migrations/V106__schedule_trigger_id_index.conf`
  - 상세: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_trigger_id ON schedule (trigger_id)` 는 기존 컬럼(`trigger_id`, FK 이지만 인덱스 미보유)에 대한 단순 단일 컬럼 non-unique btree 인덱스다. GRANT/REVOKE/ROLE/POLICY(RLS) 관련 구문이 전혀 없고, 신규 테이블·컬럼·뷰를 생성하지 않으며 기존 접근 제어 경로(애플리케이션 레벨 workspace 스코프, `TriggersService`/`SchedulesService` 의 `WHERE workspace_id = ?`)에 어떠한 변경도 가하지 않는다. `trigger_id` 값 자체는 이미 애플리케이션이 조회·응답하던 UUID 로, 인덱스 존재 여부가 노출 범위나 민감도에 영향을 주지 않는다(인덱스는 값 자체를 저장할 뿐 새로운 접근 경로를 열지 않음). `.conf` 의 `executeInTransaction=false` 는 `CREATE INDEX CONCURRENTLY` 가 트랜잭션 밖에서 실행돼야 하는 Postgres 제약에 따른 것으로 기존 V105 인덱스 마이그레이션과 동일 패턴이며 보안과 무관하다. `IF NOT EXISTS` 로 재실행 idempotent 하여 배포 중복 실행 시에도 에러/부작용이 없다.
  - 제안: 조치 불요.

- **[INFO]** enrichment 로직(`TriggersService.findAll`)의 cross-workspace 스코프도 재확인 — 변경 없음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (`scheduleRepository.find({ where: { triggerId: In(scheduleTriggerIds), workspaceId } })`)
  - 상세: 이번 diff 는 이전 리뷰 사이클(17_44_41, security=NONE 판정)에서 이미 검토된 서비스 로직에 V106 인덱스만 추가한 후속 변경이다. `scheduleTriggerIds` 는 이미 `workspaceId` 로 스코프된 `data`(트리거 목록 쿼리 결과)에서만 추출되고, `scheduleRepository.find` 호출에도 `workspaceId` 이중 필터가 걸려 있어 인덱스 추가로 인해 다른 워크스페이스의 schedule 행이 매칭될 가능성은 없다. `IN (...)` 절은 TypeORM 파라미터 바인딩을 사용하므로 SQL 인젝션 벡터도 아니다.
  - 제안: 조치 불요.

- **[INFO]** 하드코딩 시크릿·인증/인가·입력 검증·암호화·에러 처리·의존성 관점에서 이번 diff 범위(V106 인덱스 + 부수 CHANGELOG/plan 문서)에 해당 사항 없음
  - 위치: 전체 diff
  - 상세: 신규 API 엔드포인트, 인증/인가 로직 변경, 사용자 입력 처리 경로, 암호화/해시 사용, 에러 메시지 노출 지점, 신규 의존성 추가가 모두 이번 diff 에 존재하지 않는다. `TriggerDto` JSDoc 정정(주석 텍스트만)과 CHANGELOG/plan 문서 갱신은 코드 동작에 영향 없는 문서 변경이다.
  - 제안: 조치 불요.

## 요약

이번 diff 의 핵심은 `schedule(trigger_id)` 에 대한 단순 non-unique btree 인덱스(V106) 추가로, GRANT/REVOKE/RLS/POLICY 등 권한 관련 구문이 전혀 없으며 신규 접근 경로를 열지 않는 순수 조회 성능 개선이다. 인덱스 대상 컬럼(`trigger_id`)은 이미 애플리케이션이 조회·응답하던 비민감 UUID FK 이고, 이를 사용하는 `TriggersService.findAll` enrichment 로직도 `workspaceId` 이중 스코프가 이전 리뷰 사이클에서 이미 확인된 그대로 유지되어 cross-workspace 데이터 노출 위험이 없다. 인젝션·시크릿·인증/인가·입력검증·암호화·에러노출·의존성 관점 모두 이번 변경 범위에 해당 사항이 없다.

## 위험도

NONE
