# Requirement Review — audit-logging (workflow/trigger/schedule/model_config CRUD 13개 액션)

## 컨텍스트

리뷰 대상 5개 파일(`audit-action.const.ts`, `model-config.service.ts`, `schedules.service.ts`,
`triggers.service.ts`, `workflows.service.ts`)은 이미 8차 이상의 리뷰 라운드를 거친 audit-logging
기능이다. `origin/main` 대비 diff(`git diff origin/main...HEAD`)를 직접 대조해 실제 변경 범위를
확인했고, 직전 라운드(`review/code/2026/08/01/18_44_56/SUMMARY.md`)의 WARNING #6(`AuditActionFor`
리터럴-`RESOURCE_TYPE` 이중 하드코딩)과 INFO #12(`ModelConfigService.create()` 주석 누락)는 이번
코드에 이미 반영되어 있음을 확인했다(`model-config.service.ts:245` 등 `AuditActionFor<typeof
MODEL_CONFIG_RESOURCE_TYPE>` — 리터럴 재입력 없이 로컬 상수에서 파생; `model-config.service.ts` 의
`create()` recordAudit 앞에 "커밋 뒤 기록" 주석 존재). 아래는 남아 있는 발견사항이다.

## 발견사항

- **[SPEC-DRIFT] WARNING** `spec/5-system/1-auth.md` §4.1 "현재 구현된 액션" 표에 이번 PR 이 구현한
  13개 액션(workflow.created/updated/deleted, trigger.created/updated/deleted,
  schedule.created/updated/deleted, model_config.create/update/delete/set_default)이 없고, 오히려
  "Planned(미구현)" 표(L429-438)에 그대로 남아 있다. 코드(`audit-action.const.ts`)는 정확히 spec 이
  예고한 명명 규약대로 구현했고, spec 의 "구현 상태" 표만 갱신되지 않았다 — 코드가 아니라 문서가 낡은
  케이스.
  - 위치: `spec/5-system/1-auth.md:414`(구현된 액션 표 시작), `:429`(Planned 표 시작) / 코드 근거
    `codebase/backend/src/modules/audit-logs/audit-action.const.ts:32`(spec-sync-auth-gaps §4.1 로
    구현됐다는 docstring)
  - 상세: `model_config.service.ts 는 AuditLogsService 를 호출하지 않는다`(spec 원문, L438 부근)도
    현재 사실과 다르다 — `model-config.service.ts:58` 에서 `AuditLogsService` 를 주입해 4개 메서드
    (`create`/`update`/`setDefault`/`remove`)에서 실제로 호출한다.
  - 제안: 코드 유지 + spec 반영. 13개 액션을 "현재 구현된 액션" 표로 이동하고 `workflow.executed` 만
    Planned 로 잔류시킨다. 이미 `plan/in-progress/spec-sync-auth-gaps.md:18-22` 가 "spec SoT 4곳
    동기화 — planner 턴 필요"로 추적 중이므로 신규 작업 항목이 아니라 기존 추적 항목의 재확인이다.

- **[SPEC-DRIFT] WARNING** `spec/data-flow/1-audit.md` §1.1 writer 표에 4개 리소스(13개 액션) 행이
  없고, 커버리지 갭 문단이 "workflows / triggers / alerts / schedules 모듈에는 `AuditLogsService`
  import 가 전혀 없다"고 서술하나 실제로는 4개 서비스 모두 생성자에서 주입해 사용 중이다.
  - 위치: `spec/data-flow/1-audit.md:82`(커버리지 갭 문단 시작), `:85`("여전히 미구현" 서술)
  - 상세: 코드 근거 — `model-config.service.ts:58`, `schedules.service.ts:37`,
    `triggers.service.ts:83`, `workflows.service.ts:82` 전부 `AuditLogsService` 를 constructor DI 로
    주입한다.
  - 제안: 코드 유지 + writer 표에 13행 추가, 갭 문단을 "workflow.executed·saveCanvas/restoreVersion
    (및 트리거 시크릿/토큰 회전 3종)만 잔여 갭"으로 재작성. 동일 planner 트랙(위 항목과 한 커밋으로
    동시 처리 권장 — 재drift 방지).

- **[SPEC-DRIFT] WARNING** `spec/conventions/audit-actions.md` §3 "도메인별 분류 레지스트리" 표에서
  workflow/trigger/schedule/model_config 4행이 전부 "미구현" 상태로 남아 있다. 특히 `workflow` 행은
  `created`/`updated`/`deleted`(구현됨)와 `executed`(의도적 미구현)를 한 셀에 묶어 나열하고 있어,
  이후 이 표를 그대로 "구현"으로 전환하면 `executed` 까지 구현된 것으로 오독할 위험이 있다.
  - 위치: `spec/conventions/audit-actions.md:56`(workflow 행), `:57`(trigger), `:58`(schedule),
    `:59`(model_config)
  - 제안: 코드 유지 + planner 턴. `workflow` 행을 `created`/`updated`/`deleted`(구현) vs `executed`
    (미구현, 별도 행 또는 각주)로 분리하고 나머지 3행 상태를 "구현"으로 갱신.

- **[SPEC-DRIFT] WARNING** `spec/2-navigation/2-trigger-list.md` 가 audit action 명을 오기하고
  있다 — 실제 action 은 `trigger.deleted`/`trigger.updated`(과거분사, `audit-action.const.ts:80-81`
  `TRIGGER_DELETED: 'trigger.deleted'` 등과 audit-actions.md §2.1 과거분사 규약 일치)인데 문서는
  `trigger.delete`/`trigger.update`(현재형)로 적어, RBAC permission 문자열과 audit action 문자열을
  혼동하고 있다.
  - 위치: `spec/2-navigation/2-trigger-list.md:182`(`trigger.delete` action 오기),
    `:252`(`trigger.update` 오기)
  - 제안: 코드 유지 + planner 턴. 두 위치를 `trigger.deleted`/`trigger.updated` 로 정정하고, permission
    문자열(`trigger.delete` 류)과 audit action 문자열(`trigger.deleted` 류)이 별개 어휘임을 명시.
    이미 `plan/in-progress/spec-sync-auth-gaps.md:20-21` 이 이 두 줄을 정확히 지목해 추적 중.

- **WARNING (비즈니스 로직 완전성, 이미 추적됨 — 신규 아님)** `TriggersService` 의 특권 시크릿/토큰
  회전 3개 메서드(`rotateNotificationSecret`, `revokePerTriggerToken`, `rotateBotToken`)가 여전히
  `recordAudit` 를 호출하지 않는다. 응답에 새 시크릿/토큰 평문을 1회 반환하는 Editor+ 특권 작업이라,
  이번 PR 의 취지("보안 사건 추적성")에 정면으로 부합하는 작업인데 감사 흔적이 남지 않는다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:902`
    (`rotateNotificationSecret`), `:938`(`revokePerTriggerToken`), `:983`(`rotateBotToken`)
  - 상세: 이번 diff(`git diff origin/main...HEAD`)는 이 3개 메서드를 전혀 건드리지 않는다 — 새로
    도입된 회귀가 아니라 기존에도 없던 커버리지다. `plan/in-progress/spec-sync-auth-gaps.md:34-41`
    이 "트리거 시크릿/토큰 회전 3종 감사 — planner 선행 필요"로 정확히 이 3개 메서드를 지목하며,
    대응 audit action 이 spec 카탈로그에 아직 없어(`spec/` 전체에 `trigger.rotate*` 0건) `developer`
    가 임의로 action 을 추가할 수 없고 `1-auth.md §4.1` + `conventions/audit-actions.md` 개정이
    선행돼야 한다고 명시한다.
  - 제안: 코드 변경 불필요(이번 PR 범위 밖, spec 부재로 developer 권한 밖). 위 SPEC-DRIFT 4건과 같은
    planner 턴에서 신규 action(`trigger.notification_secret_rotated` 등) 을 spec 에 먼저 정의한 뒤
    후속 developer 턴에서 배선.

- **INFO (확인, 조치 불요 — 의도적 범위 보류)** `WorkflowsService.saveCanvas`/`restoreVersion` 은
  여전히 감사를 기록하지 않는다. `audit-action.const.ts` 의 `workflow.executed` 관련 docstring 및
  `plan/in-progress/spec-sync-auth-gaps.md:26-29` 가 "캔버스 편집마다 발동해 카디널리티 논점을
  공유한다"는 근거로 명시적으로 범위 밖에 두었고, 이 근거는 `review/consistency/2026/08/01/09_11_58`
  INFO 6(`audit_log` 보존 정책 미정 상태에서 고빈도 액션을 넣으면 안 된다는 지적)과 일치한다.
  `importWorkflow`(`workflows.service.ts:585` 부근, `WORKFLOW_CREATED` + `details.imported`)는 이산적
  생성 이벤트라 이미 분리 조치되어 있다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `saveCanvas`(~605행),
    `restoreVersion`(~672행)
  - 제안: 없음. 결정이 명문화돼 있고 근거가 일관된다.

- **확인 (버그 아님 — 정상 동작)** 컨트롤러→서비스 `userId` 배선 전수 확인:
  `model-config.controller.ts:120,137,157,173`, `schedules.controller.ts:155,205,226`,
  `triggers.controller.ts:100,126,165`, `workflows.controller.ts:163,187,208` 전부 `@CurrentUser('sub')`
  로 획득한 `userId` 를 신규 시그니처(각 서비스 `create`/`update`/`remove`/`setDefault` 에 추가된
  `userId: string` 파라미터)에 정확히 전달한다. named-object `recordAudit` 파라미터(주체·대상 string
  타입 인접 배치로 인한 swap 위험 방지) 설계도 4개 서비스 전부 일관 적용됐다.
  `AuditLogsService.record()` 는 내부 try/catch 로 실패를 삼켜(`audit-logs.service.ts:76-88`) 감사
  기록 실패가 주 동작을 깨지 않는다는 `data-flow/1-audit.md` 의 "실패를 삼킨다" 계약과 일치한다.
  "1:1 결합 리소스는 주 리소스만 기록한다"는 정책(`audit-action.const.ts:38-44`)도 코드와 일치 —
  `SchedulesService.create/remove` 는 짝 `Trigger` 를, `TriggersService.syncScheduleActivation` 은
  짝 `Schedule` 을 건드리지만 어느 쪽도 상대 리소스의 액션을 기록하지 않는다.

## 요약

이번 audit-logging 구현(workflow/trigger/schedule/model_config CRUD 13개 액션)은 기능적으로
완전하다 — 컨트롤러→서비스 `userId` 배선, "커밋 후 기록" 순서 원칙, 1:1 결합 리소스 주 리소스만
기록하는 정책, `AuditActionFor<P>` 타입 레벨 cross-domain 가드까지 전 지점에서 일관되게 지켜지고
있으며, 직전 라운드에서 지적된 WARNING(리터럴 이중 하드코딩)·INFO(주석 누락)도 이미 반영됐다. 남은
문제는 전부 이미 `plan/in-progress/spec-sync-auth-gaps.md` 가 추적 중인 항목으로 수렴한다: (1) 코드는
spec 이 예고한 대로 구현됐는데 `1-auth.md §4.1`·`data-flow/1-audit.md §1.1`·`conventions/audit-actions.md
§3`·`2-trigger-list.md` L182/L252 네 문서가 "미구현"/오기 상태로 정체된 SPEC-DRIFT 4건(developer 권한
밖, planner 턴 필요) — 코드를 되돌릴 사안이 아니라 spec 을 코드에 맞게 갱신해야 하는 문서 부채이고,
(2) 트리거 시크릿/토큰 회전 3개 메서드의 감사 누락은 이번 PR 의 취지에 가장 부합하는 잔여 갭이지만
대응 action 이 spec 카탈로그에 없어 developer 단독으로는 착수 불가능한 상태로 이미 명문화돼 있다.
둘 다 이번 diff 가 새로 만든 문제가 아니라 기존 추적 항목의 재확인이다.

## 위험도
LOW
