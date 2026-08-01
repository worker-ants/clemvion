# 요구사항(Requirement) 리뷰 — audit-logging (workflow/trigger/schedule/model_config CRUD 13개 액션)

## 리뷰 범위 요약

`audit-action.const.ts` 에 신규 13개 액션(`workflow.{created,updated,deleted}` ·
`trigger.{created,updated,deleted}` · `schedule.{created,updated,deleted}` ·
`model_config.{create,update,delete,set_default}`)을 추가하고, 4개 서비스
(`ModelConfigService`/`SchedulesService`/`TriggersService`/`WorkflowsService`)에
`AuditLogsService` 를 주입해 CRUD 시점에 `recordAudit` 를 호출하도록 구현한 PR.
`git diff origin/main...HEAD` 로 실제 변경분을 전수 대조했고, 프롬프트에 잘려 실리지
않은 `triggers.service.ts`/`triggers.service.spec.ts`/`workflows.service.ts`/
`workflows.service.spec.ts` 는 `Read`/`grep` 으로 직접 열어 확인했다. 해당 4개 모듈
+ `model-config`/`schedules`/`triggers`/`workflows` 테스트 스위트를 로컬에서
`jest` 로 실행 — 16 suites / 423 passed, 1 skipped, 실패 없음.

## 발견사항

- **[WARNING]** `[SPEC-DRIFT]` 신규 13개 액션이 스펙 4개 문서에서 여전히 "미구현/Planned"로 남아 있다 (구현은 정확하나 spec 카탈로그가 갱신되지 않음).
  - 위치(코드 근거·의도 설명): `codebase/backend/src/modules/audit-logs/audit-action.const.ts:32-36` — "workflow/trigger/schedule/model_config 의 CRUD 액션은 spec-sync-auth-gaps §4.1 로 구현됐다(2026-08-01)" 주석
  - 위치(대상 spec, 갱신 필요):
    - `spec/5-system/1-auth.md:414-423` "현재 구현된 액션" 표 — workflow/trigger/schedule/model_config 행이 아직 없음
    - `spec/5-system/1-auth.md:429-438` "Planned (미구현)" 표 — 위 4개 리소스가 여전히 여기 나열됨 (구현 완료로 이동 필요)
    - `spec/data-flow/1-audit.md:82-86` "커버리지 갭" 문단 — "`workflow.*`/`trigger.*`/`schedule.*`/`model_config.*` … 전혀 없다"가 이제 사실과 다름
    - `spec/conventions/audit-actions.md:56-59` §3 레지스트리 표 — workflow/trigger/schedule/model_config 행의 "상태" 컬럼이 모두 "미구현"으로 표기(구현 완료로 갱신 필요)
    - `spec/2-navigation/2-trigger-list.md:182` — "`trigger.delete` action 항목으로 기록된다"(실제 구현은 `trigger.deleted`, 과거분사 오기)
    - `spec/2-navigation/2-trigger-list.md:252` — "`trigger.update` 로 기록한다"(실제 구현은 `trigger.updated`, 동일 오기)
  - 상세: 코드(`AUDIT_ACTIONS` const + 4개 서비스의 `recordAudit` 호출 + 대응 테스트 15개 지점)는 spec 규약(`conventions/audit-actions.md` 의 시제 규칙: workflow/trigger/schedule=과거분사, model_config=현재형)을 정확히 따르고 있고, 이번 PR 은 spec 이 오래전부터 "Planned"로 약속해 온 커버리지 갭을 정확히 메운 것이다. 문제는 코드가 아니라 spec 카탈로그 4곳이 구현 완료를 아직 반영하지 못한 것 — `developer` 는 `spec/` read-only 라 이 PR 범위에서 고칠 수 없다. 이는 이미 `plan/in-progress/spec-sync-auth-gaps.md`(`- [ ] spec SoT 4곳 동기화 — planner 턴 필요`, 대상 문서·라인까지 명시)에 정확히 같은 4곳으로 추적돼 있어 놓친 항목이 아니라 **다음 planner 턴을 기다리는 중인 상태**다.
  - 제안: 코드 변경 불필요(유지). `project-planner` 턴에서 위 4개 spec 문서를 한 커밋으로 동시 갱신 — (1) `1-auth.md` §4.1 표에서 4개 리소스를 Planned→구현으로 이동, (2) `data-flow/1-audit.md` §1.1 커버리지 갭 문단 갱신, (3) `conventions/audit-actions.md` §3 상태 컬럼 4행 "구현"으로 변경, (4) `2-trigger-list.md` L182/L252 의 `trigger.delete`/`trigger.update` 오기를 `trigger.deleted`/`trigger.updated` 로 정정. 한 커밋에서 동시에 고쳐야 재발(re-drift)하지 않는다는 점이 plan 문서에도 이미 명시돼 있다.

- **[INFO]** `workflow.executed` 및 `saveCanvas` 감사 미구현은 의도적 범위 제외로 확인됨 — 오탐 아님.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:46-51` (주석), `plan/in-progress/spec-sync-auth-gaps.md` 미구현 항목 목록
  - 상세: `workflow.executed`(트리거/webhook 발동마다 적재되는 고빈도 액션)와 `saveCanvas`(캔버스 편집마다 발동)는 `audit_log` 테이블에 보존 정책·pruner 가 없다는 구조적 제약과 결합된 **의도적** 범위 제외이며, plan 문서에 별도 미구현 항목으로 명시돼 있다. 이번 PR 의 "CRUD 13개" 범위와 일치해 완전성 문제로 보지 않는다.

- **[INFO]** 대칭 리소스(Schedule↔Trigger) 이중 감사 회피 설계가 코드·테스트 양쪽에서 일관되게 지켜짐.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:832-852`(`syncScheduleActivation`, audit 호출 없음), `codebase/backend/src/modules/schedules/schedules.service.ts:213-223`(trigger 필드 갱신 시 audit 호출 없음), 테스트는 `triggers.service.spec.ts:2344-2373`("chatChannel 분기가 있어도 기록은 한 번이다")
  - 상세: `audit-action.const.ts` 상단 주석의 "1:1 결합 리소스는 주 리소스만 기록한다" 원칙대로, Schedule↔Trigger 상호 갱신 경로(`syncScheduleActivation`, Schedule.update 의 trigger 필드 동기화)는 감사를 남기지 않고 호출된 엔드포인트의 리소스만 기록한다. 설계와 구현·테스트가 일치.

## 요약

`AUDIT_ACTIONS` 신규 13개 액션과 4개 서비스(`model-config`/`schedules`/`triggers`/`workflows`)의 `recordAudit` 통합은 기능적으로 완전하다 — 모든 CRUD 경로(create/update/delete/set_default, workflow 는 duplicate/import 포함)에서 트랜잭션·DB 커밋 **뒤**에 감사를 기록하고(롤백 시 미기록 보장), 삭제 전에 `type`/`kind` 필드를 스냅샷해 undefined 유입을 막고, 외부 호출(BullMQ/secret store/chatChannel setup) 이전에 감사를 남겨 "리소스는 생겼는데 감사가 없다"는 부분 실패를 방지한다. named-params 시그니처로 동일 타입 인자 순서 스왑 위험도 차단했고, 대칭 리소스(Schedule↔Trigger) 이중 기록도 설계대로 회피된다. `AuditLogsService.record()` 는 실패를 삼키므로(try/catch) 감사 실패가 주 동작을 깨지 않는다는 계약도 유지된다. 컨트롤러 전 계층에서 `userId` 를 정확히 관통시켰고, 15개 이상의 전용 감사 테스트(순서 뮤턴트 가드 포함)가 커버하며 로컬 `jest` 전체 통과(423/424, 1 skip)를 확인했다. TODO/FIXME 류 미완성 표식 없음, 반환값·에러 시나리오 결손 없음. 유일한 유의미 발견은 코드 결함이 아니라 **spec 카탈로그 4곳(§4.1 표, data-flow 커버리지 갭 문단, conventions 상태 컬럼, trigger-list 액션명 오기)이 구현 완료를 아직 반영하지 못한 SPEC-DRIFT**이며, 이는 이미 `plan/in-progress/spec-sync-auth-gaps.md` 에 정확한 대상 위치까지 추적되어 다음 `project-planner` 턴을 기다리는 상태다.

## 위험도

LOW
