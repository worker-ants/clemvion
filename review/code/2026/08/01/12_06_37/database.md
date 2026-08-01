# Database Review — audit-logging (workflow/trigger/schedule/model_config CRUD 감사 기록)

## 스코프 요약

이번 변경은 `spec-sync-auth-gaps §4.1` 구현 — `workflow.*`/`trigger.*`/`schedule.*`/`model_config.*` CRUD 에
`AuditLogsService.record()` 호출을 추가하고(각 서비스에 `recordAudit()` private 헬퍼 신설), 컨트롤러→서비스
경로에 `userId` 파라미터를 새로 관통시킨 것이 핵심이다. **스키마·마이그레이션 변경은 없음**
(`git diff` 확인 — `migrations/*.sql`, `**/entities/*.ts` 모두 diff 0). `AuditLogsService.record()` 자체(기존
구현, `audit_log` 테이블·인덱스)도 이번 PR 에서 손대지 않았다 — 새 호출부만 추가됐다.

## 발견사항

- **[WARNING]** `TriggersService.update()` — 신규 `recordAudit` 호출이 `syncScheduleActivation`(DB write +
  BullMQ 외부 호출) **뒤**에 위치해, 같은 함수가 스스로 세운 "커밋 직후 기록, 실패 가능한 외부 호출은 그 뒤에"
  원칙을 어긴다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:332-350` (update 본문 — `saved =
    await this.triggerRepository.save(trigger)` 뒤 `syncScheduleActivation` 호출, 그 다음에
    `recordAudit`), 그리고 `codebase/backend/src/modules/triggers/triggers.service.ts:827-847`
    (`syncScheduleActivation` — `scheduleRepository.save` + `scheduleRunner.registerJob/removeJob` BullMQ
    호출을 포함).
  - 상세: 같은 `update()` 안에서 `normalizeNotificationSecretRef`/`setupChatChannel`(secret store, 어댑터
    호출)은 신규 주석("**커밋 직후** 기록한다 — 아래 secret 마이그레이션·chatChannel setup 은 실패할 수 있는
    외부 호출이라, 그 뒤로 미루면 트리거는 바뀌었는데 감사는 안 남는다 (리뷰 W6)")대로 `recordAudit` **뒤**에
    배치됐다. 그런데 `syncScheduleActivation`(schedule 타입 트리거의 `isActive` 역방향 동기화)은 정확히 같은
    성격의 실패 가능 외부 호출(`scheduleRunner.registerJob`/`removeJob` — Redis/BullMQ)을 포함함에도
    `recordAudit` **앞**에 남아 있다. `triggerRepository.save(trigger)`(주 리소스 커밋)는 이미 성공한
    시점에서, 뒤이은 `syncScheduleActivation` 이 BullMQ 호출에서 throw 하면 `update()` 전체가 reject 되어
    `recordAudit` 이 전혀 호출되지 않는다 — trigger(및 연쇄로 schedule.is_active)는 이미 DB 에 커밋됐는데
    `trigger.updated` 감사 행은 조용히 유실된다. 이 PR 이 다른 두 외부 호출에 대해서는 명시적으로 막아낸
    바로 그 실패 모드다. `triggers.service.spec.ts` 의 신규 "감사 로깅 (trigger.*)" describe 블록도
    `syncScheduleActivation` 실패 경로를 검증하지 않는다(순서 고정 테스트는 secret 마이그레이션 케이스만
    있음, `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2314-2342`).
  - 제안: `recordAudit` 호출을 `triggerRepository.save(trigger)` 직후·`syncScheduleActivation` 호출 이전으로
    옮기거나(다른 두 외부 호출과 동일 원칙 적용), 또는 `syncScheduleActivation` 내부의 BullMQ 호출을
    `SchedulesService` 의 대칭 경로처럼 감사 기록 뒤로 재배치. `create()`/`normalizeNotificationSecretRef`
    케이스처럼 "commit → audit → 외부호출" 순서를 고정하는 테스트(schedule 타입 + `isActive` 변경 +
    `registerJob` throw) 를 추가해 회귀를 잠그는 것을 권장.

- **[INFO]** `audit_log` 테이블은 보존 정책·pruner 가 없는 무제한 테이블인데, 이번 PR 로 13개 신규 CRUD
  액션의 INSERT 가 상시 활성화된다(이전에는 이 4개 리소스의 CRUD 가 전혀 감사되지 않았음).
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:32-43` (docstring이 이미 이 트레이드
    오프를 명시하고 `workflow.executed` 는 카디널리티 문제로 의도적으로 제외했다고 밝힘).
  - 상세: 이미 코드 주석·`impl-prep consistency 2026/08/01 09_11_58 INFO 6` 에서 인지·문서화된 결정이라
    이번 PR 이 새로 만든 문제는 아니다. CRUD 는 실행(`executed`)과 달리 저빈도이므로 당장 급한 위험은
    아니지만, `audit_log` 인덱스는 `(workspace_id, created_at DESC)` 하나뿐이라 (`migrations/V002__indexes.sql:33`)
    보존 정책이 계속 미정으로 남으면 장기적으로 테이블이 무한 성장한다는 점은 재확인해 둔다.
  - 제안: 새 항목 아님 — 이미 별도 트래킹된 결정이므로 추가 조치 불요. 향후 보존 정책 결정 시 이번에
    활성화된 13개 액션도 범위에 포함해야 함을 기억해 둘 것.

- **[INFO]** `AuditLogsService.record()`(기존 구현, 이번 PR 미변경)는 자체 트랜잭션 없이 별도 INSERT
  왕복으로 동작하고 실패를 전부 swallow(`logger.warn` 만)한다 — 이번 PR 로 이 fire-and-forget 경로에
  대한 의존이 4개 리소스·13개 액션으로 크게 확장됐다.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:72-97` (`record()` 메서드).
  - 상세: 주 mutation 커밋과 감사 INSERT 사이에 프로세스가 죽거나(드묾) 감사 INSERT 자체가 실패하면
    (예: DB 순간 부하, 커넥션 풀 고갈) 주 동작은 성공 응답을 반환하지만 감사 로그는 남지 않는다 — 설계상
    의도된 트레이드오프("Failures are swallowed — audit logging must never break the primary action.")이고
    이번 PR 이 그 설계를 바꾼 것은 아니지만, 감사 기능의 신뢰도를 좌우하는 지점이 이번에 훨씬 더 많은
    호출부에서 재사용된다는 점은 인지해 둘 가치가 있다.
  - 제안: 별도 조치 불요(설계 의도) — 다만 향후 컴플라이언스 요구가 강해지면 outbox 패턴(주 트랜잭션과
    같은 트랜잭션에 감사 이벤트를 적재 후 비동기 발행) 검토 여지를 남겨 둔다.

- **[INFO]** `WorkflowsService.importWorkflow()` 는 새 workflow row 를 생성하지만 `recordAudit` 호출이 없다
  — 같은 "새 workflow 생성" 성격의 `create()`/`duplicate()` 는 모두 `workflow.created` 를 남기는 것과 대비된다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:451-576` (`importWorkflow` 전체 —
    `dataSource.transaction` 커밋 후 `recordAudit` 호출이 없음).
  - 상세: DB 관점에서는 정합성 문제가 아니라(트랜잭션 자체는 정상 커밋) 감사 트레일의 커버리지 갭이다.
    다른 리뷰 관점(요구사항/감사 완결성)에서 이미 다뤄질 수 있는 항목이지만, `audit_log` 에 대한 쓰기
    경로 일관성이라는 점에서 짚어 둔다.
  - 제안: 의도된 스코프 축소(spec §4.1 표가 CRUD 3종만 정의)인지 확인 필요. 의도라면 무시, 누락이라면
    `create()`/`duplicate()` 와 같은 패턴으로 트랜잭션 커밋 뒤 `recordAudit({action: WORKFLOW_CREATED,
    details: {importedAs: true}})` 류를 추가.

- **[INFO]** 각 CRUD mutation 마다 `audit_log` 로의 추가 INSERT 왕복이 생겨 요청당 DB 왕복이 1회 늘었다.
  - 상세: `workflow`/`trigger`/`schedule`/`model_config` 의 create/update/remove(+ setDefault)는 저빈도
    관리 엔드포인트이므로 실질적 성능 영향은 미미하다. 인덱스·커넥션 풀 관점에서 우려할 수준은 아니다.

## 항목별 점검 결과

1. **인덱스**: 이번 PR 이 건드린 쿼리는 없음(전부 기존 `findEntity`/`findOne`/`createQueryBuilder` 경로
   재사용). `audit_log` 쓰기 경로만 늘었고, 기존 `idx_audit_log_workspace_created (workspace_id,
   created_at DESC)` 로 조회 경로는 충분히 커버됨(불변).
2. **N+1**: 신규 `recordAudit` 호출은 각 서비스 메서드당 정확히 1회이며 반복문 안에 있지 않다. 목록 조회
   (`triggers.service.ts findAll` 의 schedule enrichment 등)는 이번 PR 의 변경 대상이 아니고 기존에도
   `IN (...)` 배치 조회로 N+1 을 이미 회피하고 있었다(불변).
3. **트랜잭션**: `workflow.create/duplicate`·`model_config.setDefault` 는 DB 트랜잭션 커밋 **뒤**에
   `recordAudit` 을 호출하도록 정확히 구현·테스트됐다(commit→audit→외부호출 순서 고정 테스트 다수 확인).
   단 위 WARNING 1건(`triggers.service.ts update()`)은 그 원칙이 일관되게 적용되지 않은 경로.
4. **마이그레이션 안전성**: 해당 없음 — 스키마/마이그레이션 변경 0건.
5. **스키마 설계**: 해당 없음 — 엔티티 변경 0건.
6. **커넥션 관리**: `AuditLogsService` 는 표준 NestJS/TypeORM DI 레포지토리를 그대로 사용(기존 커넥션
   풀 공유). `AuditLogsModule` 을 4개 모듈에 추가 import 했지만 `AuditLogsModule` 은 `TypeOrmModule.
   forFeature` 외 의존이 없는 leaf 모듈이라 순환 의존·커넥션 이슈 없음.
7. **SQL 인젝션**: 신규 코드는 전부 TypeORM `save`/`remove`/파라미터 바인딩 경로만 사용, raw SQL 문자열
   조합 없음. `resourceId`/`details` 는 구조화된 객체로 전달되어 인젝션 표면 없음.
8. **대량 데이터**: 이번 PR 은 페이지네이션/대량 조회 로직을 건드리지 않음. `audit_log` 자체의 무제한
   증가는 위 INFO 항목 참고(기존에 이미 인지·별도 트래킹된 리스크).

## 요약

이번 변경은 스키마·마이그레이션·인덱스·쿼리 성능에 영향을 주지 않는 순수 애플리케이션 계층 변경(감사
로그 INSERT 호출 추가 + `userId` 파라미터 관통)이며, `workflow`/`model_config` 의 트랜잭션-커밋-후-감사
순서는 꼼꼼하게 구현·테스트됐다. 다만 `TriggersService.update()` 한 곳에서 신규 감사 기록 호출이 스스로
정의한 "실패 가능 외부 호출보다 먼저" 원칙을 어겨, schedule 타입 트리거의 `isActive` 토글 시 BullMQ 실패가
겹치면 실제로는 커밋된 변경에 대한 감사 행이 조용히 누락될 수 있다(WARNING 1건). 그 외에는 `audit_log`
무제한 성장(기존에 이미 문서화된 트레이드오프)과 `importWorkflow()` 의 감사 커버리지 갭 등 경미한 INFO
수준 관찰뿐이다.

## 위험도

LOW
