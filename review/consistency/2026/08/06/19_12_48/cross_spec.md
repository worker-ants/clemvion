# Cross-Spec 일관성 검토 — `spec/conventions` (audit-actions.md 중심)

## 발견사항

- **[CRITICAL]** `audit-actions.md` §3 레지스트리의 "상태" 컬럼이 실제 구현 상태와 모순 — 3개 spec 파일이 한 방향으로 모두 stale
  - target 위치: `spec/conventions/audit-actions.md` §3 "도메인별 분류 레지스트리" (56~59행) — `workflow`/`trigger`/`schedule`/`model_config` 행이 전부 `상태: 미구현`
  - 충돌 대상:
    - `spec/5-system/1-auth.md` §4.1 (429~436행) — 위 4개 resource 의 CRUD 액션이 "현재 구현된 액션" 표가 아니라 "Planned (미구현 — 목표 커버리지)" 표에 남아 있음
    - `spec/data-flow/1-audit.md` §1.1 (45~71행 Writer 표, 82~88행 "커버리지 갭" 문단) — Writer 표에 workflow/trigger/schedule/model_config 서비스가 없고, 본문이 "여전히 미구현… AuditLogsService import 가 전혀 없다"고 명시
    - 코드: `codebase/backend/src/modules/audit-logs/audit-action.const.ts` — `WORKFLOW_CREATED/UPDATED/DELETED`, `TRIGGER_CREATED/UPDATED/DELETED`, `SCHEDULE_CREATED/UPDATED/DELETED`, `MODEL_CONFIG_CREATE/UPDATE/DELETE/SET_DEFAULT` 13개 액션이 이미 정의돼 있고, `workflows.service.ts`/`triggers.service.ts`/`schedules.service.ts`/`model-config.service.ts` 가 전부 `AuditLogsService` 를 호출한다 (commit `d02bb422f` "감사 로깅 커버리지 갭 — workflow/trigger/schedule/model_config 13개 액션 (#1081)", 이미 이 워크트리 HEAD 이력에 병합돼 있음 — `git log --oneline` 확인)
  - 상세: target 문서(`audit-actions.md`)가 스스로 "구현 여부의 ground truth 는 `data-flow/1-audit.md §1.1`" 이라고 위임하는데, 그 위임처 자체가 이미 실제와 어긋나 있다. 세 문서가 서로는 정합(모두 "미구현"으로 일치)하지만 셋이 한 방향으로 실제 코드와 불일치한다 — 전형적인 "합의된 오류". `plan/in-progress/spec-sync-auth-gaps.md` 가 정확히 이 3개 SoT 를 지목하며 "spec SoT 4곳 동기화 — planner 턴 필요"(18~21행)로 이미 추적 중이나 **아직 처리되지 않았다** (devloper 는 `spec/` read-only 라 구현 커밋에서 spec 을 못 고쳤다). 이 상태로 `audit-actions.md` 를 그대로 참조하면 향후 작업자가 이미 구현된 13개 액션을 "미구현"으로 오판해 중복 구현을 시도하거나, 반대로 커버리지 갭 리포트에서 실제로 커버된 액션을 빠진 것으로 집계할 수 있다.
  - 제안: 한 커밋에서 동시에 3곳을 갱신 — ① `1-auth.md §4.1` 의 workflow/trigger/schedule/model_config CRUD 를 "Planned" 표에서 "현재 구현된 액션" 표로 이동 (`workflow.executed` 만 Planned 잔류, 이유는 코드 주석에 이미 명문화돼 있음), ② `data-flow/1-audit.md §1.1` Writer 표에 4개 서비스 행 추가 + "커버리지 갭" 문단에서 이 4개 resource 를 "구현됨"으로 정정, ③ `conventions/audit-actions.md §3` 레지스트리의 해당 4행 "상태" 컬럼을 `구현` 으로 변경. 이 작업은 `project-planner` 턴이 필요하다 (developer 는 `spec/` read-only).

- **[WARNING]** target 이 정의한 `<resource>.<verb>` 명명 규약(과거분사 §2.1)을 다른 spec 영역이 위반 — `trigger.delete`/`trigger.update` 오기 3곳
  - target 위치: `spec/conventions/audit-actions.md` §1 (67~69행, resource dot-prefix + 과거분사 필수) · §3 레지스트리 57행 (`trigger | 과거분사 (§2.1) | created, updated, deleted`)
  - 충돌 대상:
    - `spec/2-navigation/2-trigger-list.md:182` — `trigger.delete` action 으로 기록된다고 서술 (정: `trigger.deleted`)
    - `spec/2-navigation/2-trigger-list.md:252` — "활성/비활성 전환도 `trigger.update` 로 기록" (정: `trigger.updated`)
    - `spec/5-system/15-chat-channel.md:377` — "audit log 가 `trigger.update` 와 `chat-channel.rotate-bot-token` 으로 mixed" (정: `trigger.updated`)
  - 상세: 세 지점 모두 target 문서가 정의한 verb 시제 규약(§2.1 과거분사)과 실제 `AUDIT_ACTIONS` 상수(`TRIGGER_UPDATED: 'trigger.updated'`, `TRIGGER_DELETED: 'trigger.deleted'`)를 어기는 현재형(`delete`/`update`) 표기를 쓴다. `audit-action.const.ts` 는 union 타입으로 강제되므로 실제 코드에 `trigger.delete`/`trigger.update` 라는 액션은 존재하지 않는다 — 두 nav/chat-channel spec 문서가 가리키는 액션명 자체가 실재하지 않는 값이다.
  - 제안: 위 3곳을 `trigger.deleted`/`trigger.updated` 로 정정.

- **[WARNING]** 존재하지 않는 "`trigger.delete` permission" 언급 — RBAC 모델과 불일치
  - target 위치: (간접) `spec/conventions/audit-actions.md` 는 인가 모델을 정의하지 않으나, `spec/5-system/1-auth.md` 의 RBAC 모델(§3.2)과 대비해 검증
  - 충돌 대상: `spec/2-navigation/2-trigger-list.md:182` — "API 게이트는 [Spec 인증 §3] 의 `trigger.delete` permission 으로 보호되며…" / `spec/5-system/1-auth.md` §3.2 "리소스별 권한 매트릭스" (368행 `Trigger | CRUD | CRUD | CRUD | R`)
  - 상세: `1-auth.md` 의 실제 인가 모델은 **역할 기반**(`@Roles('editor')` 등 role string)이며 리소스별 CRUD 매트릭스로 기술된다. `trigger.delete` 라는 이름의 개별 permission 은 spec 전체(§3, §3.2)에도 코드(`RolesGuard`)에도 존재하지 않는다 — audit action 이름(`trigger.deleted`)과 permission 이름을 혼동한 서술로 보인다. `plan/in-progress/spec-sync-auth-gaps.md` (24~27행)가 이미 같은 문제를 "그런 permission 은 존재하지 않는다"고 지적하며 `§3.2 리소스별 권한 매트릭스` 인용으로 교체할 것을 정리해 두었다.
  - 제안: `2-navigation/2-trigger-list.md:182` 를 "`§3.2 리소스별 권한 매트릭스` (Trigger CRUD — Owner/Admin/Editor) 로 보호되며 audit log 의 `trigger.deleted` action 으로 기록된다"로 정정.

- **[INFO]** target(`audit-actions.md`) 의 도메인 고유 결정 2건이 spec `## Rationale` 에 미승격 — 코드 주석에만 존재
  - target 위치: `spec/conventions/audit-actions.md` §Rationale (미기재 상태)
  - 충돌 대상: `codebase/backend/src/modules/audit-logs/audit-action.const.ts` 상단 주석 (1:1 결합 리소스는 주 리소스만 기록 / 고빈도 액션은 보존 정책 확정 전까지 유예)
  - 상세: 두 결정 모두 기존 Rationale 을 번복하지 않는 신규 설계 판단이지만 spec 어디에도 문서화돼 있지 않아 코드 주석이 유일한 출처다. `plan/in-progress/spec-sync-auth-gaps.md` (30~37행)가 이미 동일하게 지적(`rationale_continuity` INFO, impl-done consistency 19_26_35 발견 인용).
  - 제안: 위 CRITICAL 항목과 같은 planner 턴에서 `audit-actions.md §Rationale` 에 두 결정을 추가.

## 요약

target 인 `spec/conventions/audit-actions.md` 는 §1~§2 명명 규약(구조·시제 3분류) 자체는 다른 영역과 충돌하지 않지만, §3 도메인별 분류 레지스트리의 "상태" 컬럼이 이미 병합된 구현(commit `d02bb422f`, #1081 — workflow/trigger/schedule/model_config CRUD 13개 액션)을 반영하지 못해 "미구현"으로 잘못 표시하고 있다. 같은 오류가 이 문서가 SoT 로 위임하는 `5-system/1-auth.md §4.1` 과 `data-flow/1-audit.md §1.1` 에도 동일하게 나타나 세 문서가 서로는 정합하지만 셋 다 코드와 어긋나는 "합의된 stale" 상태다. 이 갭은 `plan/in-progress/spec-sync-auth-gaps.md` 가 이미 "spec SoT 4곳 동기화 — planner 턴 필요"로 정확히 추적하고 있어 신규 미지 결함은 아니지만, 아직 처리되지 않은 채 살아있는 CRITICAL 이다. 부가적으로 `trigger.delete`/`trigger.update` 액션명 오기 3곳(target 의 §1/§2.1 명명 규약 위반)과, 존재하지 않는 "`trigger.delete` permission" 이라는 RBAC 서술 불일치도 같은 정정 커밋에서 함께 처리가 필요하다.

## 위험도
CRITICAL
