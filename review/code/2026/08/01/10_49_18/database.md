# 데이터베이스(Database) 코드 리뷰 — audit-logging (workflow/trigger/schedule/model_config CRUD 감사 로깅)

## 검토 범위·방법

프롬프트가 크기 제한으로 diff 를 생략한 파일(`model-config.service.spec.ts`, `triggers.service.spec.ts`,
`workflows.service.ts`)을 포함해 4개 서비스(`model-config`/`schedules`/`triggers`/`workflows`) 전문을
`Read` 로 직접 열어 확인했다. 아울러 diff 에는 없지만 신규 호출부가 전부 의존하는
`AuditLogsService`(`record`/`findAll`), `AuditLog` 엔티티, `audit_log` 테이블 마이그레이션
(`V001__initial_schema.sql`, `V002__indexes.sql`), `model_config` default-swap 유니크 인덱스
(`V089__model_config_kind_default_unique.sql`), `CurrentUser` 데코레이터, `AuditLogsModule`,
그리고 유사 delete 경로인 `workspaces.service.ts:removeMember`도 대조 확인했다. `git diff --stat
origin/main...HEAD -- codebase/backend/migrations/`로 이번 PR 체인 전체에 스키마 마이그레이션이
없음을 확인했다.

## 발견사항

- **[WARNING]** 동시 DELETE 요청이 동일 리소스에 대해 중복 `*.deleted` 감사 행을 생성할 수 있음 — 4개 서비스에 동일 패턴 반복
  - 위치:
    - `codebase/backend/src/modules/model-config/model-config.service.ts:394-409` (`remove`, `recordAudit` 호출은 402-408)
    - `codebase/backend/src/modules/schedules/schedules.service.ts:264-279` (`remove`, 호출 273-278)
    - `codebase/backend/src/modules/triggers/triggers.service.ts:849-878` (`remove`, 호출 871-877)
    - `codebase/backend/src/modules/workflows/workflows.service.ts:254-263` (`remove`, 호출 257-262)
  - 상세: 네 `remove()` 모두 `find*(id, workspaceId)` → (부수효과) → `repo.remove(entity)` →
    `await this.recordAudit(<RESOURCE>_DELETED)` 순서이고, 전체가 트랜잭션이나 `SELECT ... FOR UPDATE`
    같은 락으로 묶여 있지 않다. TypeORM `Repository.remove(entity)`는 PK 기준 `DELETE`를 실행할 뿐
    영향받은 행 수를 검사·반환하지 않으므로, 이미 삭제된 행에 재호출해도 예외 없이 조용히 0-row
    DELETE로 끝난다. `AuditLog` 엔티티(`codebase/backend/src/modules/audit-logs/entities/audit-log.entity.ts:12-48`)도
    append-only라 `(action, resource_id)` 류 유니크 제약이 없어 DB 레벨에서 중복을 막지 못한다. 동일
    리소스에 두 DELETE 요청(더블클릭·재시도·동시 사용자)이 겹치면 둘 다 `find*` 시점엔 엔티티가
    존재해 통과하고, 각자 `recordAudit()`를 호출해 **동일한 논리적 삭제 이벤트에 두 건의 `*.deleted`
    행**이 `audit_log`에 남는다 — 감사 로그의 존재 이유(누가 언제 삭제했는가) 자체가 훼손된다.
    다만 이 근본 패턴(`find→remove→recordAudit`, 행 수 미검증)은 기존 `auth-configs.service.ts`에
    이미 있던 것이라 이번 diff의 회귀는 아니며, 그 결과(중복 감사 행)를 4개 리소스 타입으로 새로
    확장·복제하는 것이다.
  - 제안: `repo.remove(entity)` 대신 `Repository.delete(criteria)`/`manager.delete(...)`를 사용해
    반환된 `DeleteResult.affected`가 1 이상일 때만 `recordAudit()`를 호출하거나, 삭제 직전
    `SELECT ... FOR UPDATE`로 대상 행을 잠가 동시 삭제를 직렬화할 것. 네 서비스가 완전히 동일한
    패턴을 반복하므로 공통 헬퍼로 한 번에 고치는 편이 재발 방지에 효율적이다.

- **[INFO]** `audit_log` 필터 조회(`action`/`resource_type`/`user_id`)에 전용 인덱스 없음 — 이번 diff로 쓰기 소스가 4곳 늘며 기존 갭의 체감 시점이 앞당겨짐
  - 위치: `codebase/backend/migrations/V002__indexes.sql:33`(`idx_audit_log_workspace_created ON audit_log (workspace_id, created_at DESC)`), `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:34-65`(`findAll` — `action`/`resource_type`/`user_id`/`startDate`/`endDate` 필터가 모두 이 단일 복합 인덱스 위에서 filter-scan), `codebase/backend/src/modules/audit-logs/audit-action.const.ts:38-43`(신규 헤더 주석이 "무제한 테이블, pruner 없음"을 이미 인지)
  - 상세: 기존 인덱스는 `findAll()`의 기본 접근 패턴(workspace 범위 + `created_at DESC` 정렬)은
    잘 커버하지만, `action`/`resource_type`/`user_id` 단독·조합 필터는 인덱스 없이 workspace 범위
    내 residual scan에 의존한다. 이번 diff는 스키마를 바꾸지 않지만 model-config/schedules/triggers/
    workflows 4개 모듈의 **일상적** CRUD 트래픽이 새로 이 테이블에 쓰기 시작하므로(기존에는 audit
    coverage가 저빈도 액션 위주), 테이블 증가 속도와 필터 조회 성능 저하 시점이 실질적으로 앞당겨진다.
    이 갭은 이미 `review/consistency/2026/08/01/09_11_58` INFO 6·동 세션 performance/security 리뷰에서도
    같은 결론으로 추적 중이다.
  - 제안: 지금 조치는 불요(설계상 인지된 트레이드오프, `workflow.executed`처럼 고빈도인 액션은 이미
    이번 범위에서 의도적으로 제외됨). 후속으로 조회 API 필터 성능이 실측 저하되면 `(workspace_id,
    action)`/`(workspace_id, resource_type)` 보조 인덱스 또는 보존 정책(pruner) 도입을 검토할 것.

- **[INFO]** `schedules.service.ts` `create()`의 Trigger→Schedule 2단계 INSERT가 트랜잭션으로 묶여 있지 않음 (pre-existing, 이번 diff는 시그니처·감사 호출만 추가)
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:156-202`(`create`) — 특히
    `triggerRepository.save(trigger)`(170)와 `scheduleRepository.save(schedule)`(185)가 별도
    호출이며 공통 트랜잭션이 없다.
  - 상세: 두 번째 저장(Schedule, cron 표현식 등 검증을 거친 뒤)이 실패하면 첫 번째 저장에서 이미
    커밋된 `type='schedule'` Trigger row가 대응 Schedule 없이 고아로 남는다. `git show
    origin/main:.../schedules.service.ts`로 대조한 결과 이 두 단계 구조는 이번 diff 이전부터
    존재했고, 이번 diff는 `userId` 매개변수와 `recordAudit()` 호출(두 저장이 모두 성공한 뒤에만
    도달)만 추가했다 — 따라서 신규 `recordAudit` 자체의 정확성에는 영향이 없지만, 감사 커버리지
    확장으로 이 리소스의 쓰기 빈도가 늘면서 기존 비원자성 갭이 노출될 기회도 함께 늘어난다.
  - 제안: 이번 PR 범위 밖. 후속으로 `dataSource.transaction()`으로 두 저장을 묶는 것을 고려할 만하다
    (workflows.service.ts의 `create()`가 이미 같은 패턴 — Workflow+Node INSERT를 트랜잭션으로 묶는
    선례를 제공한다).

## 확인했으나 문제 없다고 판단한 항목 (positive findings)

- **트랜잭션 경계 정확성**: `model-config.service.ts` `setDefault()`(366-392)와 `workflows.service.ts`
  `create()`(191-227)/`duplicate()`(277-405)는 `recordAudit()`를 트랜잭션 **커밋 뒤**에 호출하도록
  정확히 설계됐고, `model-config.service.spec.ts`/`workflows.service.spec.ts`가 `order: string[]`로
  tx-start/tx-commit/audit 순서를 관측 가능한 형태로 단언하며 뮤테이션 검증까지 거쳤다(RESOLUTION.md
  C2). 롤백된 작업이 감사에 남는 위양성 기록을 방지한다.
- **N+1 없음**: `recordAudit(`/`auditLogsService.record(` 모든 호출 직전 컨텍스트에 `for`/`.map`/
  `.forEach`/`while`이 없음을 4개 서비스 전수 확인 — 리소스당 1회만 호출된다.
  `workflows.service.ts` `duplicate()`의 노드/엣지 복제도 `manager.insert(Node, nodeRows)`/
  `manager.insert(Edge, edgeRows)` 배열 일괄 insert를 그대로 유지해(324-390) per-row 루프가 아니다.
- **SQL 인젝션 없음**: 새로 조회/갱신되는 모든 경로가 TypeORM `QueryBuilder` 파라미터 바인딩
  (`:workspaceId` 등) 또는 `Repository`/`EntityManager` 메서드를 사용한다. `AuditLogsService.findAll()`의
  `sort`/`order` 파라미터도 화이트리스트(`getSortColumn`)로 걸러 정렬 컬럼 인젝션을 차단한다(기존
  코드, 이번 diff로 훼손되지 않음). `resourceId`는 항상 `ParseUUIDPipe` 검증 라우트 파라미터이거나
  DB가 생성한 `saved.id`다.
- **커넥션 관리**: `AuditLogsModule`은 `TypeOrmModule.forFeature([AuditLog])`만 import하는 leaf
  모듈로, 4개 feature 모듈에 반복 import돼도 NestJS DI 그래프상 단일 인스턴스로 캐시되며 별도
  커넥션 풀을 만들지 않는다(공용 `DataSource` 재사용). 순환 의존도 없어 `forwardRef` 불필요.
  트랜잭션은 전부 `manager.transaction()`/`dataSource.transaction()`으로 QueryRunner 획득·해제가
  자동 관리된다 — 수동 connect/release 코드 없음.
- **마이그레이션 안전성 해당 없음**: 이번 PR 체인 전체(`git diff --stat origin/main...HEAD --
  codebase/backend/migrations/`)에 스키마 마이그레이션 파일 변경이 없다 — 무중단 배포 lock/데이터
  손실 리스크 평가 대상 자체가 없다.
- **`model_config` 동시 default 지정 경합**: `saveWithDefaultSwap`/`setDefault`(2단계 `manager.update`)의
  이론적 경합은 `V089__model_config_kind_default_unique.sql`의 partial unique index
  `(workspace_id, kind) WHERE is_default = true`가 DB 레벨에서 막는다 — 진 쪽 트랜잭션은 unique
  violation으로 롤백되고, `recordAudit`는 트랜잭션 완료 후에만 호출되므로 실패한 요청에 감사가
  잘못 남지 않는다(`model-config.service.spec.ts` "트랜잭션이 실패하면 감사를 남기지 않는다" 테스트로
  확인).
- **대량 데이터/페이지네이션**: `AuditLogsService.findAll()`/`SchedulesService.findAll()`/
  `ModelConfigService.findAll()` 모두 `offset/limit`(또는 `skip/take`) 기반 페이지네이션을 이미
  갖추고 있다(이번 diff가 건드리지 않은 기존 코드) — 신규로 페이지네이션 없는 대량 조회가
  추가되지 않았다.

## 요약

이번 diff의 핵심은 4개 모듈(workflow/trigger/schedule/model_config)의 CRUD 경로에 감사 로그 INSERT
13곳을 추가하는 것이며, 데이터베이스 관점에서는 트랜잭션 커밋 후 기록·인자 객체화로 인한 순서 보장이
정확하고(뮤테이션 테스트로 검증됨), N+1·SQL 인젝션·커넥션 누수·마이그레이션 리스크는 발견되지
않았다. 유일한 실질적 WARNING은 4개 서비스의 `remove()`가 모두 실제 삭제 발생 여부(`affected` row
수)를 확인하지 않고 무조건 삭제 감사를 기록해, 동시 DELETE 요청 경합 시 동일 삭제 이벤트에 대해
중복 `*.deleted` 행이 남을 수 있다는 점이다 — 이 패턴 자체는 `auth-configs.service.ts`의 기존 관행을
재사용한 것이라 회귀는 아니지만, 감사 로그의 정확성이 곧 이 기능의 존재 이유이므로 4곳으로 늘어난
지금이 `DeleteResult.affected` 체크 같은 저비용 수정으로 한 번에 정리하기 좋은 시점이다. 그 외
`audit_log` 필터 인덱스 공백·`schedules.create()`의 비원자적 2단계 INSERT는 이번 diff가 새로
만든 문제가 아니라 기존에 알려졌거나(전자, INFO 6으로 이미 추적 중) 사전에 존재하던(후자) 갭이
감사 커버리지 확장으로 노출 빈도만 늘어난 것으로, 조치 불요한 INFO로 기록한다.

## 위험도

MEDIUM
