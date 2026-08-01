# Database Review — audit-logging (workflow/trigger/schedule/model_config CRUD 감사 기록)

## 스코프 요약

이번 diff(`origin/main...HEAD`, `codebase/` 20개 파일)는 `spec-sync-auth-gaps §4.1` 구현 —
`workflow.*`/`trigger.*`/`schedule.*`/`model_config.*` CRUD 에 `AuditLogsService.record()` 호출을
추가하고(각 서비스에 `recordAudit()` private 헬퍼 신설), 컨트롤러→서비스 경로에 `userId` 파라미터를
관통시킨 것이 핵심이다. **스키마·마이그레이션 변경은 없음** (`git diff --stat -- migrations/
**/entities` 확인 — 0 files). `AuditLogsService.record()` 자체(기존 구현, `audit_log` 테이블·인덱스)도
이번 diff 에서 손대지 않았다 — 새 호출부만 추가됐다.

동일 작업에 대한 직전 리뷰(`review/code/2026/08/01/12_06_37/database.md`)가 `TriggersService.update()`
의 `recordAudit` ↔ `syncScheduleActivation` 순서 위반(WARNING)과 `importWorkflow()` 감사 누락(INFO)을
지적했고, 이번 diff(커밋 `4b9f50a87 "4차 리뷰 조치 — C1 순서 위반 + importWorkflow 감사 + 순서 가드
확장"`)에서 둘 다 조치됐음을 코드·테스트로 확인했다:
- `triggers.service.ts:331-348` — `recordAudit(TRIGGER_UPDATED)` 가 `syncScheduleActivation` **앞**으로
  이동. `triggers.service.spec.ts` 에 `order = ['commit','audit','bullmq']` 를 단언하는 순서 고정
  테스트가 추가됨(`syncScheduleActivation` 케이스).
- `workflows.service.ts` `importWorkflow()` — 트랜잭션 커밋 뒤 `recordAudit({action:
  WORKFLOW_CREATED, details: { imported: true }})` 호출이 추가됨(`duplicate()` 도 동일 패턴으로
  `details: { duplicatedFrom: id }` 추가).

## 발견사항

- **[INFO]** `audit_log` 은 보존 정책·pruner 가 없는 무제한 테이블인데, 이번 diff 로 13개 신규 CRUD
  액션의 INSERT 가 상시 활성화된다(이전엔 이 4개 리소스의 CRUD 가 전혀 감사되지 않았음).
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts` 상단 docstring(46-51행) —
    `workflow.executed` 는 카디널리티 문제로 의도적으로 제외했다고 명시.
  - 상세: 이미 코드 주석·`impl-prep consistency 2026/08/01 09_11_58 INFO 6` 에서 인지·문서화된
    결정이라 이번 diff 가 새로 만든 문제는 아니다. CRUD 는 실행(`executed`)과 달리 저빈도이므로
    당장 급한 위험은 아니지만, `audit_log` 인덱스는 `(workspace_id, created_at DESC)` 하나뿐이라
    보존 정책이 계속 미정으로 남으면 장기적으로 테이블이 무한 성장한다.
  - 제안: 새 조치 불요(기존 트래킹된 결정) — 향후 보존 정책 결정 시 이번에 활성화된 13개 액션도
    범위에 포함해야 함을 재확인.

- **[INFO]** `AuditLogsService.record()`(기존 구현, 이번 diff 미변경)는 주 mutation 과 별도 트랜잭션
  없는 fire-and-forget INSERT 이고 실패를 전부 swallow 한다(`logger.warn` 만).
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:72-97` (`record()`).
  - 상세: 이번 diff 로 이 경로에 의존하는 호출부가 4개 리소스·13개 액션으로 크게 확장됐다. 주
    mutation 커밋 직후 감사 INSERT 가 실패(DB 순간 부하·커넥션 풀 고갈 등)해도 API 응답은 성공을
    반환하고 감사 행만 조용히 유실된다 — 설계상 의도된 트레이드오프이고 이번 diff 의 각 서비스가
    "커밋 뒤에만 기록" 원칙을 일관되게 지킨 점은 긍정적이지만, 감사 신뢰도가 이 단일 fire-and-forget
    지점에 더 넓게 의존하게 됐다는 점은 인지해 둘 가치가 있다.
  - 제안: 별도 조치 불요(기존 설계 의도) — 컴플라이언스 요구가 강해지면 outbox 패턴(주 트랜잭션과
    동일 트랜잭션에 감사 이벤트 적재 후 비동기 발행) 검토 여지.

- **[INFO]** `SchedulesService.create()`/`remove()` — 연결 `Trigger` row 생성/삭제와 `Schedule` row
  생성/삭제가 하나의 DB 트랜잭션으로 묶여 있지 않다(각각 독립 INSERT/DELETE 왕복 2회).
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` `create()`(트리거 저장 →
    `computeNextRuns` → 스케줄 저장) / `remove()`(`triggerRepository.delete` → `scheduleRepository.
    remove`).
  - 상세: 이 두 단계 쓰기 패턴은 이번 diff 이전부터 존재하던 것이며(`git diff` 확인 — 두 메서드
    모두 트랜잭션 관련 코드는 변경 없이 `userId` 파라미터 + `recordAudit` 호출만 추가됨), 이번 PR 이
    새로 만든 정합성 문제는 아니다. 다만 `recordAudit` 호출이 두 번째 쓰기(스케줄 저장/삭제) 직후에
    배치되어, 만약 중간 단계(트리거 저장 성공·스케줄 저장 실패, 또는 그 반대)에서 실패하면 감사가
    아예 기록되지 않아(정합성 관점에서는 안전한 방향 — "일어나지 않은 일이 감사에 남지 않음") 이
    자체는 문제가 아니지만, 부분 실패 시 고아 `Trigger`/`Schedule` row 가 남을 가능성은 여전히
    구조적으로 존재한다.
  - 제안: 새 항목 아님 — 이번 diff 범위 밖. 별도 트래킹이 필요하면 `dataSource.transaction`으로
    두 엔티티 쓰기를 묶는 리팩터를 백로그에 남기는 정도로 충분.

- **[INFO]** 각 CRUD mutation 마다 `audit_log` 로의 추가 INSERT 왕복이 생겨 요청당 DB 왕복이 1회
  늘었다.
  - 상세: `workflow`/`trigger`/`schedule`/`model_config` 의 create/update/remove(+ setDefault)는
    저빈도 관리 엔드포인트이므로 실질적 성능 영향은 미미하다. 인덱스·커넥션 풀 관점에서 우려할
    수준은 아니다.

## 항목별 점검 결과

1. **인덱스**: 이번 diff 가 새로 만든/변경한 쿼리는 없음(전부 기존 `findEntity`/`findOne`/
   `createQueryBuilder` 경로 재사용). `audit_log` 쓰기 경로만 늘었고, 기존
   `(workspace_id, created_at DESC)` 인덱스로 조회 경로는 그대로 충분히 커버됨(불변).
2. **N+1**: 신규 `recordAudit` 호출은 각 서비스 메서드당 정확히 1회이며 반복문 안에 있지 않다.
   `TriggersService.promoteRotatedNotificationSecrets`/`cleanupRotatedChatChannelTokens` 의 루프는
   이번 diff 의 변경 대상이 아니고(diff 미포함) 이번 PR 의 `recordAudit` 신규 호출과도 무관하다.
3. **트랜잭션**: `workflow.create/duplicate/importWorkflow`·`model_config.setDefault` 는 DB 트랜잭션
   커밋 **뒤**에 `recordAudit` 을 호출하도록 정확히 구현·테스트됐다(commit→audit→외부호출 순서
   고정 테스트 다수 확인: `schedules.service.spec.ts` W6, `triggers.service.spec.ts` W6/
   syncScheduleActivation, `model-config.service.spec.ts` isDefault 트랜잭션). 직전 리뷰가 지적한
   `TriggersService.update()` 의 순서 위반(WARNING)은 이번 diff 에서 조치 완료(코드+가드 테스트
   확인).
4. **마이그레이션 안전성**: 해당 없음 — 스키마/마이그레이션 변경 0건.
5. **스키마 설계**: 해당 없음 — 엔티티 변경 0건.
6. **커넥션 관리**: `AuditLogsService` 는 표준 NestJS/TypeORM DI 레포지토리를 그대로 사용(기존
   커넥션 풀 공유). `AuditLogsModule` 을 4개 모듈(`model-config`/`schedules`/`triggers`/`workflows`)
   에 새로 import 했지만 `AuditLogsModule` 은 `TypeOrmModule.forFeature` 외 의존이 없는 leaf 모듈
   이라 순환 의존·커넥션 이슈 없음.
7. **SQL 인젝션**: 신규 코드는 전부 TypeORM `save`/`remove`/`update`(조건 객체)/파라미터 바인딩
   경로만 사용, raw SQL 문자열 조합 없음. `resourceId`/`details`(`{ kind }`, `{ type }`,
   `{ duplicatedFrom }`, `{ imported: true }`)는 구조화된 객체로 전달되어 인젝션 표면이 없다.
8. **대량 데이터**: 이번 diff 는 페이지네이션/대량 조회 로직을 건드리지 않음. `audit_log` 자체의
   무제한 증가는 위 INFO 항목 참고(기존에 이미 인지·별도 트래킹된 리스크).

## 요약

이번 변경은 스키마·마이그레이션·인덱스·쿼리 성능에 영향을 주지 않는 순수 애플리케이션 계층 변경
(감사 로그 INSERT 호출 추가 + `userId` 파라미터 관통)이다. 직전 라운드에서 지적된 유일한 WARNING
(`TriggersService.update()` 의 `recordAudit`/`syncScheduleActivation` 순서 위반)은 코드와 순서 고정
테스트 양쪽으로 조치가 확인됐고, `importWorkflow()` 감사 누락도 함께 메워졌다. 네 서비스
(`workflow`/`trigger`/`schedule`/`model_config`) 모두 "DB 트랜잭션/저장 커밋 뒤에만 감사 기록, 실패
가능한 외부 호출(BullMQ·secret store·chat 어댑터)은 그 뒤" 원칙을 일관되게 지키고 있다. 남은 항목은
전부 INFO 수준으로, `audit_log` 무제한 성장(기존에 이미 문서화된 트레이드오프)과 fire-and-forget
감사 기록의 신뢰도 확장, `SchedulesService`의 트리거↔스케줄 2-step 쓰기(이번 diff 이전부터 존재,
범위 밖)에 대한 관찰이다. Critical/Warning 없음.

## 위험도

NONE
