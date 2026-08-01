# Cross-Spec 일관성 Check — cross_spec

검토 모드: impl-done (scope=`spec/5-system`, diff-base=`origin/main`, target 앵커 = `spec/5-system/1-auth.md §4.1` 감사 로그)

## 방법 메모

prompt 에는 `<git diff origin/main...HEAD -- code_areas>` 가 컨텍스트 예산으로 생략돼 있어, HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/audit-logging`)를 절대경로로 직접 확인했다:
- `git log --oneline origin/main..HEAD` — 이번 브랜치는 감사 로깅 커버리지 확장(`workflow.*`/`trigger.*`/`schedule.*`/`model_config.*` CRUD) 구현.
- `git diff origin/main...HEAD --stat -- codebase spec plan` — **`spec/**` 변경 0건**. 코드(`audit-action.const.ts`, `workflows/triggers/schedules/model-config` 의 service·controller·module)와 `plan/in-progress/spec-sync-auth-gaps.md` 만 변경됨.
- `git diff origin/main...HEAD -- codebase/backend/src/modules/audit-logs/audit-action.const.ts` 외 4개 서비스 diff 로 실제 구현(13개 액션: `workflow.created/updated/deleted`, `trigger.created/updated/deleted`, `schedule.created/updated/deleted`, `model_config.create/update/delete/set_default`)을 직접 확인.

## 발견사항

- **[WARNING] 감사 액션 구현 완료 vs 3개 타 영역 spec 문서의 "미구현" 서술 — 직접 모순**
  - target 위치: `spec/5-system/1-auth.md` §4.1 "Planned (미구현 — 목표 커버리지)" 표 (L429-436) — `workflow.*`/`trigger.*`/`schedule.*`/`model_config.*` 4개 카테고리가 여전히 Planned 로 남아 있고, "현재 구현된 액션" 표(L414-421)로 이동돼 있지 않다. model_config 관련 각주(L438)는 "`model_config.service.ts` 는 `AuditLogsService` 를 호출하지 않는다"고 명시하나 사실이 아니다.
  - 충돌 대상:
    - `spec/data-flow/1-audit.md` §1.1 (L82-88) — "**여전히 미구현**이다 — workflows / triggers / alerts / schedules 모듈에는 `AuditLogsService` import 가 전혀 없다" 로 단정. 이 문서는 자신을 "구현 현황의 SoT"(L247-248)로 선언한다.
    - `spec/conventions/audit-actions.md` §3 도메인별 분류 레지스트리 (L56-59) — `workflow`/`trigger`/`schedule`/`model_config` 4행 전부 상태 컬럼이 "미구현".
  - 상세: HEAD 워킹트리에서 직접 확인한 코드 사실과 정면 모순된다.
    - `audit-action.const.ts` — `WORKFLOW_CREATED`/`TRIGGER_CREATED`/`SCHEDULE_CREATED`/`MODEL_CONFIG_CREATE` 등 13개 액션이 `AUDIT_ACTIONS` 에 실제로 존재(diff `+`).
    - `workflows.service.ts` — `AUDIT_ACTIONS.WORKFLOW_CREATED`/`WORKFLOW_UPDATED`/`WORKFLOW_DELETED` 를 `auditLogsService.record` 로 실제 기록.
    - `triggers.service.ts` — `TRIGGER_CREATED`/`TRIGGER_UPDATED`(+`TRIGGER_DELETED`, 별도 지점)를 커밋 직후 시점에 기록, `AuditLogsService` 생성자 주입 확인.
    - `schedules.service.ts` — `SCHEDULE_CREATED`/`SCHEDULE_UPDATED`/`SCHEDULE_DELETED` 기록.
    - `model-config.service.ts` — `MODEL_CONFIG_CREATE`/`UPDATE`/`SET_DEFAULT`/`DELETE` 기록, `AuditLogsService` 주입.
    - `audit-action.const.ts` 자신의 신규 주석(diff)도 "workflow/trigger/schedule/model_config 의 CRUD 액션은 spec-sync-auth-gaps §4.1 로 **구현됐다 (2026-08-01)**" 라고 명시해 코드 자체가 구현 완료를 자인하고 있다.
    - 세 spec 문서(target 포함) 모두 이 사실을 반영하지 못해 "구현 현황 SoT" 라 자처하는 문서가 실제로는 stale 하다.
  - **이미 알려진 항목**: 이번 검토가 처음 발견한 게 아니라, (1) `review/code/2026/08/01/19_10_47/SUMMARY.md` WARNING #2~#5(6개 reviewer 중 requirement 가 동일 SPEC-DRIFT 4건을 이미 지목), (2) `plan/in-progress/spec-sync-auth-gaps.md` 의 미체크 항목 "spec SoT 4곳 동기화 — planner 턴 필요"(`5-system/1-auth.md §4.1` · `data-flow/1-audit.md §1.1` · `conventions/audit-actions.md §3` · `2-navigation/2-trigger-list.md`) 에 이미 추적되고 있다. `developer` 는 `spec/` read-only 라 이 PR 범위에서 직접 고칠 권한이 없어 의도적으로 미룬 것으로 보이며, 코드 자체의 회귀는 아니다. 다만 **현재 HEAD 시점 기준으로 3개 영역 spec 문서가 서로 모순**되는 상태이므로 cross-spec 관점에서 다시 표면화한다 — 후속 planner 턴 없이 이 상태로 머지되면 "구현 현황 SoT" 3곳이 전부 틀린 채 방치된다.
  - 등급 근거: 채택해도 두 영역이 "작동 불가"는 아니라(런타임 영향 없음, 문서 서술만 stale) CRITICAL 대신 WARNING으로 판정 — 단 세 문서가 각자 "SoT/ground truth" 를 자처하며 서로 다른 사실을 주장하는 **직접적 사실 모순**이라 우선순위가 높다.
  - 제안: (project-planner, `plan/in-progress/spec-sync-auth-gaps.md` 트랙) 한 커밋에서 동시 갱신 — `5-system/1-auth.md §4.1` Planned→"현재 구현된 액션" 표 이동(`workflow.executed` 만 Planned 잔류) + model_config 각주 정정, `data-flow/1-audit.md §1.1` writer 표에 13행 추가·갭 문단 재작성, `conventions/audit-actions.md §3` 4행 상태를 "구현"으로(단 `workflow` 행은 `created/updated/deleted`=구현·`executed`=미구현으로 분리).

- **[WARNING] `spec/2-navigation/2-trigger-list.md` 의 audit action 명 오기 — 실제 구현 액션명과 문자열 불일치**
  - target 위치: (참조 대상) `spec/5-system/1-auth.md` §4.1 / `spec/conventions/audit-actions.md` §2.1(과거분사 규약)
  - 충돌 대상: `spec/2-navigation/2-trigger-list.md:182` (`trigger.delete` permission/action 서술), `:252` (`trigger.update` 서술)
  - 상세: 실제 구현된 action 은 `audit-action.const.ts` 의 `TRIGGER_DELETED: 'trigger.deleted'` / `TRIGGER_UPDATED: 'trigger.updated'` (과거분사, `audit-actions.md` §2.1 규약과 일치)다. 그런데 `2-trigger-list.md` 는 `trigger.delete`/`trigger.update` (현재형)로 적어, RBAC permission 문자열과 감사 action 문자열을 혼동한 채 실제 구현과 다른 철자를 노출한다. (참고: 직전 impl-prep 검토(`review/consistency/.../09_11_58`)가 이 두 줄을 "미구현을 이미 구현된 것처럼 서술"이라는 다른 이유로 WARNING 처리했었는데, 이번 구현으로 그 전제는 해소됐지만 액션명 철자 불일치는 그대로 남았다.)
  - 제안: (project-planner) L182 를 `trigger.deleted`, L252 를 `trigger.updated` 로 정정. 위 항목의 4-SoT 동기화 커밋에 합류 권장(`spec-sync-auth-gaps.md` 가 이미 이 두 줄을 지목).

- **[INFO] Trigger 자격증명 회전 3종은 여전히 감사 미기록 — 도메인 내 완결성 비대칭**
  - target 위치: `spec/5-system/1-auth.md` §4.1 "현재 구현된 액션" 표 — `integration.rotated`(자격증명 회전, 이미 구현) · `auth_config.regenerate`(키/토큰 재발급, 이미 구현)
  - 충돌 대상: `codebase/backend/src/modules/triggers/triggers.service.ts` 의 `rotateNotificationSecret`/`revokePerTriggerToken`/`rotateBotToken` — 동일 "자격증명 회전" 성격의 특권 동작이지만 `recordAudit` 를 호출하지 않는다(HEAD 기준 실측).
  - 상세: `conventions/audit-actions.md` §2.1 이 이미 `integration.rotated` 를 "발생한 사건" 과거분사 패턴으로 등재해 자격증명 회전을 감사 대상 1급 사건으로 다루는 선례가 있는데, `trigger` 리소스의 동형 동작(webhook/봇 토큰 회전)에는 대응 action 이 카탈로그에 아예 없다. Cross-spec 관점에서 "리소스 회전은 감사한다" 는 기존 패턴과의 정의 공백.
  - 제안: 이미 `plan/in-progress/spec-sync-auth-gaps.md` 가 별도 항목("트리거 시크릿/토큰 회전 3종 감사 — planner 선행 필요")으로 추적 중이며, 위 SoT 동기화 커밋과 같은 planner 턴에서 `trigger.notification_secret_rotated` 등 신규 action 을 카탈로그에 먼저 정의할 것을 권고. 조치 시급성 낮음(비차단).

## 요약

이번 브랜치는 `spec/5-system/1-auth.md §4.1` 이 "Planned" 로 선언했던 감사 로깅 커버리지(`workflow.*`/`trigger.*`/`schedule.*`/`model_config.*` CRUD 13개 액션)를 코드에서 실제로 구현했으나, 그 사실을 반영해야 할 **spec 문서 3곳**(target 자신의 §4.1 Planned 표, `data-flow/1-audit.md §1.1`, `conventions/audit-actions.md §3`)이 전부 갱신되지 않아 "미구현"이라는 이제는 거짓인 서술을 계속 주장하고 있다. `data-flow/1-audit.md` 는 스스로를 "구현 현황의 SoT" 라 선언하는 문서라 이 drift 는 단순 오탈자가 아니라 **여러 영역이 서로 다른 사실을 주장**하는 cross-spec 모순이다. 다만 이 항목은 이미 코드 리뷰(19_10_47 SUMMARY WARNING 2~5)와 `plan/in-progress/spec-sync-auth-gaps.md` 가 정확히 같은 4곳을 지목해 "planner 턴 필요"로 추적 중이며, `developer` 의 `spec/` read-only 제약상 이번 PR 범위에서 고칠 권한이 없어 의도적으로 다음 턴에 넘긴 것으로 판단된다. 코드 자체의 RBAC·데이터 모델·상태 전이·API 계약 층위에서는 새로운 cross-spec 충돌이 발견되지 않았다(§3.2 RBAC 매트릭스의 Workflow/Trigger/Schedule/Model Config Editor+ CRUD 규정과 실제 컨트롤러 가드가 정합, `Trigger↔Schedule` 1:1 동기화 규칙(§2.9.1)과 "주 리소스만 감사" 설계도 상충 없음). 부수적으로 `2-navigation/2-trigger-list.md` 의 action 철자 오기(`trigger.delete`→`trigger.deleted` 등)도 같은 동기화 커밋에서 함께 정정이 필요하다.

## 위험도

MEDIUM — Critical 급 기능 충돌은 없으나(런타임 동작에는 영향 없음), "구현 현황 SoT" 를 자처하는 spec 문서 3곳이 실제 코드와 정반대 사실을 주장하는 상태로 머지 대기 중이라 문서 신뢰도에 실질적 영향이 있다. 이미 plan 에 추적되어 있으므로 이번 PR 자체를 BLOCK 할 사유는 아니되, 후속 planner 턴에서 반드시 한 커밋으로 동시 정정돼야 한다.
