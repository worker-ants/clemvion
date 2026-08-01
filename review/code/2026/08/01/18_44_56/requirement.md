# Requirement Review — audit-logging (감사 로깅 커버리지 갭 13개 액션)

## 리뷰 대상
- `codebase/backend/src/modules/audit-logs/audit-action.const.ts`
- `codebase/backend/src/modules/model-config/model-config.service.ts`
- `codebase/backend/src/modules/schedules/schedules.service.ts`
- `codebase/backend/src/modules/triggers/triggers.service.ts`
- `codebase/backend/src/modules/workflows/workflows.service.ts`
- `codebase/backend/src/modules/workflows/workflows.service.spec.ts`

본 세션(`review/code/2026/08/01/18_44_56`)은 이미 7라운드 리뷰를 거친 `audit-logging` 브랜치(직전
SUMMARY: `review/code/2026/08/01/13_46_48/SUMMARY.md` = "수렴, 이번 PR 이 만든 코드 결함 0건")에
대한 요구사항 관점 재검증이다. 아래는 그 판정을 독립적으로 재현·확인한 결과다.

## 기능 완전성 확인 (요약)

`AUDIT_ACTIONS` 에 신규 13개 액션(`workflow.created/updated/deleted`, `trigger.created/updated/deleted`,
`schedule.created/updated/deleted`, `model_config.create/update/delete/set_default`)이 추가됐고, 4개
서비스(`WorkflowsService`/`TriggersService`/`SchedulesService`/`ModelConfigService`)의 모든 mutation
경로(create/update/remove/duplicate/importWorkflow/setDefault)에 `recordAudit` 호출이 배선돼 있다.
직접 대조한 결과:

- **action 상수 오배선 없음**: 13개 호출 지점 전부 자기 리소스의 올바른 `AUDIT_ACTIONS` 상수를 사용한다 (복붙 오류 0건).
- **actor(userId) 배선**: 4개 컨트롤러(`model-config`/`schedules`/`triggers`/`workflows.controller.ts`)의 create/update/remove/duplicate/importWorkflow/setDefault 호출 전부 `userId`(또는 `user.sub`)를 서비스에 전달 — 배선 누락 없음.
- **커밋 후 기록 순서**: `ModelConfigService.setDefault`(트랜잭션 뒤), `SchedulesService.create/update`(BullMQ 등록 전), `TriggersService.create/update`(secret 마이그레이션·chatChannel setup·`syncScheduleActivation` 전), `WorkflowsService.create/duplicate/importWorkflow`(트랜잭션 커밋 뒤) 전부 "감사 → 실패 가능한 외부 호출" 순서를 지킨다. `TriggersService.update()` 는 4차 리뷰가 잡은 순서 위반(schedule 동기화 뒤에 있던 것)이 현재는 `recordAudit` 이 `syncScheduleActivation` **앞**으로 정정돼 있음을 확인했다.
- **remove() 의 TypeORM id-nullification 회피**: `model-config`/`schedules`/`triggers`/`workflows` remove() 전부 `repo.remove(entity)` **이전에** `resourceId`/`kind`/`type` 값을 캡처하거나 파라미터 `id` 를 그대로 사용해, `TypeORM.remove()` 가 엔티티의 `id` 를 지우는 부작용으로 감사에 `undefined` 가 남는 경로가 없다.
- **1:1 결합 리소스(Schedule↔Trigger) 원칙 준수**: `SchedulesService.create/update/remove` 는 짝 `Trigger` 를 직접 쓰지만 `trigger.*` 액션을 남기지 않고, `TriggersService.update()` 의 `syncScheduleActivation` 도 짝 `Schedule` 을 갱신하지만 `schedule.*` 를 남기지 않는다 — `audit-action.const.ts` 상단 주석(38~43행)이 서술한 "호출된 엔드포인트의 리소스만 기록" 규칙과 코드가 정확히 일치한다.
- **`AuditActionFor<P>` 타입 좁힘**: 4개 서비스의 `recordAudit` 파라미터가 전부 `AuditActionFor<'workflow'|'trigger'|'schedule'|'model_config'>` 로 좁혀져 있어, 예컨대 `WorkflowsService.recordAudit` 에 `'trigger.deleted'` 를 넘기는 교차-도메인 오배선은 컴파일 타임에 차단된다(`auth-configs.service.ts` 는 이 좁힘을 아직 쓰지 않아 넓은 `AuditAction` 을 받지만, 그 파일은 이번 diff 밖).
- **테스트 커버리지**: `workflows.service.spec.ts` 에 `duplicate`/`importWorkflow` 각각 (a) `details.duplicatedFrom`/`details.imported` 단언, (b) "트랜잭션 커밋 뒤 기록" 순서 단언, (c) "트랜잭션 실패 시 감사 미기록" 롤백 단언이 3종 모두 존재한다(`workflows.service.spec.ts:744-1016`, `940-1016`).
- **TODO/FIXME/HACK/XXX**: 6개 파일 전수 grep 0건 — 미완성 표시 없음.
- **에러 시나리오**: `AuditLogsService.record()` 는 내부에서 전부 catch 해 warn 로그만 남기고 절대 throw 하지 않는다(`audit-logs.service.ts:69-90`) — 4개 서비스가 `await this.recordAudit(...)` 해도 감사 실패가 create/update/remove 트랜잭션 자체를 깨지 않는다. 이 계약이 spec(`data-flow/1-audit.md:21-23` "두 record 모두 실패를 삼킨다")과 일치.

이번 diff 로 인한 신규 CRITICAL/기능 결함은 발견되지 않았다.

## 발견사항

- **[WARNING] `[SPEC-DRIFT]` spec/5-system/1-auth.md §4.1 액션 카탈로그가 구현을 못 따라감**
  - 위치: `spec/5-system/1-auth.md:414-423`(현재 구현된 액션 표), `spec/5-system/1-auth.md:429-438`(Planned 표)
  - 상세: §4.1 "현재 구현된 액션" 표에는 `workflow.*`/`trigger.*`/`schedule.*`/`model_config.*` 가 없고, 반대로 "Planned (미구현)" 표(431-436행)에는 이번 PR 이 구현한 13개 액션이 여전히 나열돼 있다. 코드(`audit-action.const.ts`)는 정확히 spec 이 Planned 로 예고했던 액션명·시제(과거분사 CRUD for workflow/trigger/schedule, 현재형 CRUD for model_config)를 그대로 구현했으므로 **코드가 spec 의 의도와 일치하고, spec 의 "구현 상태" 표만 갱신되지 않은 것**이다. `workflow.executed` 만 (카디널리티·보존정책 미정 사유로) Planned 잔류가 맞다.
  - 제안: 코드 유지 + spec 반영. 13개 액션을 "현재 구현된 액션" 표로 이동하고, `workflow.executed` 만 Planned 에 남긴다. L438 의 "`model_config.service.ts` 는 `AuditLogsService` 를 호출하지 않는다" 노트도 stale이므로 함께 정정. 이미 `plan/in-progress/spec-sync-auth-gaps.md:18-22`("spec SoT 4곳 동기화 — planner 턴 필요", 미체크)와 `review/code/2026/08/01/13_46_48/SUMMARY.md` §3 이 동일 갭을 planner 인계 대상으로 추적 중이다 — `developer` 권한 밖(spec/ read-only)이라 본 PR 이 직접 고칠 수 없다.

- **[WARNING] `[SPEC-DRIFT]` spec/data-flow/1-audit.md §1.1 writer 표·커버리지 갭 문단 stale**
  - 위치: `spec/data-flow/1-audit.md:45-71`(writer 표, `workflow`/`trigger`/`schedule`/`model_config` 행 부재), `spec/data-flow/1-audit.md:82-92`(커버리지 갭 문단)
  - 상세: 82-88행이 "`workflow.*`/`trigger.*`/`schedule.*`/`model_config.*` 는 **여전히 미구현**이다 — workflows/triggers/alerts/schedules 모듈에는 `AuditLogsService` import 가 전혀 없다" 라고 단정하는데, 실제로는 4개 서비스 모두 `AuditLogsService` 를 주입받아 사용 중이다(`workflows.service.ts:5`, `triggers.service.ts:5`, `schedules.service.ts:5`, `model-config.service.ts:5`). 이 표가 spec 의 "현재 구현의 ground truth" 임을 자처하므로(43행) 갱신이 안 되면 후속 리뷰·감사 질의가 잘못된 전제로 진행될 위험이 있다.
  - 제안: 코드 유지 + spec 반영. writer 표에 13개 행 추가, 커버리지 갭 문단을 "workflow.executed·saveCanvas/restoreVersion 만 잔여 갭" 으로 재작성. 동일 planner 인계 트랙(`plan/in-progress/spec-sync-auth-gaps.md:18-22`).

- **[WARNING] `[SPEC-DRIFT]` spec/conventions/audit-actions.md §3 상태 컬럼 stale**
  - 위치: `spec/conventions/audit-actions.md:56-59`
  - 상세: `workflow`/`trigger`/`schedule`/`model_config` 4개 행의 "상태" 컬럼이 전부 `미구현` 으로 남아 있다. `workflow` 행은 `created`/`updated`/`deleted`/`executed` 를 한 셀에 묶어 나열하는데, 이번 구현은 앞 3개만 구현하고 `executed` 는 의도적으로 제외했으므로 단순히 "구현" 으로 바꾸면 `executed` 까지 구현된 것으로 오독될 수 있다 — planner 가 셀 분리 여부를 결정해야 한다.
  - 제안: 코드 유지 + spec 반영(planner). `workflow` 행만 `created/updated/deleted`(구현) vs `executed`(미구현)로 분리 표기, 나머지 3행은 상태를 "구현" 으로 갱신.

- **[WARNING] `[SPEC-DRIFT]` spec/2-navigation/2-trigger-list.md 의 audit 액션명 오기**
  - 위치: `spec/2-navigation/2-trigger-list.md:182`(`trigger.delete`), `spec/2-navigation/2-trigger-list.md:252`(`trigger.update`)
  - 상세: L182 는 "API 게이트는 ... `trigger.delete` permission 으로 보호되며 audit log 의 `trigger.delete` action 항목으로 기록된다" 라고 서술한다. RBAC permission 이름(`trigger.delete`)은 맞지만, 실제 구현된 audit action 은 `AUDIT_ACTIONS.TRIGGER_DELETED = 'trigger.deleted'`(`audit-action.const.ts:81`, `triggers.service.ts:1904` `AUDIT_ACTIONS.TRIGGER_DELETED` 사용)다 — 과거분사 누락. L252 는 "활성/비활성 전환도 `trigger.update` 로 기록한다" 인데 실제 액션은 `trigger.updated`(`AUDIT_ACTIONS.TRIGGER_UPDATED`, `triggers.service.ts:1370`)다. 이 문서는 permission 문자열과 audit action 문자열을 같은 자리에서 섞어 써서 혼동을 유발한다.
  - 제안: 코드 유지 + spec 반영(planner). 두 위치의 audit action 표기를 `trigger.deleted`/`trigger.updated` 로 정정하고, permission 문자열(`trigger.delete`/`trigger.update`)과 audit action 문자열이 다른 어휘임을 명시. 이미 `plan/in-progress/spec-sync-auth-gaps.md:18-22` 가 이 L182/L252 오기를 명시적으로 추적 중.

- **[INFO] `saveCanvas`/`restoreVersion` 은 여전히 감사 미기록**
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` — `saveCanvas`(595행대) / `restoreVersion`(659행대) 함수 전체
  - 상세: 두 메서드 모두 `recordAudit` 호출이 없다. `workflow.executed` 를 Planned 로 유보한 것과 같은 카디널리티 논거(캔버스 편집마다 발동 vs `audit_log` 무제한 테이블·pruner 부재)가 적용되며, `audit-action.const.ts` 46-51행 주석과 `plan/in-progress/spec-sync-auth-gaps.md:26-29` 가 이를 알려진 잔여 갭으로 명시하고 있어 이번 PR 의 범위 밖 의도적 보류다. 기능 결함이 아니라 확인만 해 둔다.

## 요약

이번 audit-logging PR 은 요구사항(13개 CRUD 감사 액션 구현) 을 기능적으로 완전히 충족한다 — action 상수 배선, actor(userId) 전달, 커밋-후-기록 순서, TypeORM remove() id-nullification 회피, 1:1 결합 리소스(Schedule/Trigger) 중복 기록 방지, `AuditActionFor<P>` 를 통한 컴파일 타임 교차-도메인 오배선 차단, 롤백/순서 테스트까지 전부 직접 대조로 확인했고 신규 결함은 없다. 유일한 잔여 이슈는 spec 문서 4곳(`5-system/1-auth.md §4.1`, `data-flow/1-audit.md §1.1`, `conventions/audit-actions.md §3`, `2-navigation/2-trigger-list.md` L182/L252)이 여전히 "미구현" 으로 서술돼 코드와 어긋나는 **SPEC-DRIFT**이며, 이는 `developer` 권한 밖(spec/ read-only)이고 이미 `plan/in-progress/spec-sync-auth-gaps.md` 에 planner 인계 항목으로 명시돼 있다. `saveCanvas`/`restoreVersion` 미감사는 의도적 범위 보류로 확인됐다(INFO).

## 위험도
LOW — 코드 결함 0건, 전량 SPEC-DRIFT(문서 갱신, planner 턴 필요)와 1건의 의도적 범위 보류(INFO)뿐이다.
