# 요구사항(Requirement) 리뷰 — audit-logging (workflow/trigger/schedule/model_config CRUD 감사)

## 발견사항

- **[WARNING] [SPEC-DRIFT]** `spec/5-system/1-auth.md` §4.1 "Planned" 표가 이번 커밋으로 구현된 `workflow.*`/`trigger.*`/`schedule.*`/`model_config.*` 를 여전히 미구현으로 표기한다.
  - 위치: `spec/5-system/1-auth.md:414-423`(현재 구현된 액션 표), `:429-436`(Planned 표), `:438`(model_config 통합 콜아웃) — 관련 근거는 리뷰 대상 `codebase/backend/src/modules/audit-logs/audit-action.const.ts` 게이트 32~36행("workflow/trigger/schedule/model_config 의 CRUD 액션은 spec-sync-auth-gaps §4.1 로 구현됐다 (2026-08-01)")이 이미 이 사실을 인지하고 있다.
  - 상세: 실제 코드(`triggers.service.ts`/`schedules.service.ts`/`workflows.service.ts`/`model-config.service.ts`)는 모두 `AuditLogsService.record`를 호출해 13개 액션(workflow.created/updated/deleted, trigger.created/updated/deleted, schedule.created/updated/deleted, model_config.create/update/delete/set_default)을 기록하지만, spec §4.1 은 이 4개 카테고리를 여전히 "Planned (미구현)" 표에 두고 있고, 438행의 "설정 CRUD 감사 로깅 자체는 현재 미구현이다" 콜아웃도 stale 이다. 코드는 spec 이 원래 의도한 목표 커버리지를 정확히 구현한 것이므로 코드가 옳고 spec 서술이 낡은 전형적 SPEC-DRIFT.
  - 제안: 코드 유지 + spec 반영. §4.1 "현재 구현된 액션" 표에 4개 카테고리 행 추가, "Planned" 표에서 해당 행 제거(`workflow.executed` 만 Planned 로 잔류 — 카디널리티·보존정책 사유로 의도적으로 별도 유지, `audit-action.const.ts` 게이트 46~51행 근거 타당), 438행 콜아웃을 "구현 완료"로 갱신. `developer` 는 `spec/` read-only 이므로 `project-planner` 턴 필요.

- **[WARNING] [SPEC-DRIFT]** `spec/data-flow/1-audit.md` §1.1 writer 표·"커버리지 갭" 문단·§5 외부 의존 표가 신규 writer 4곳을 반영하지 않는다.
  - 위치: `spec/data-flow/1-audit.md:33`(mermaid Caller 참여자 목록), `:45-71`(writer 표 — "8개 위치" 로 명시), `:82-88`("`workflow.*`/`trigger.*`/`schedule.*`/`model_config.*` … **여전히 미구현**이다 — workflows / triggers / alerts / schedules 모듈에는 AuditLogsService import 가 전혀 없다"), `:198`(§5 "그 외 도메인은 현재 audit 기록 없음").
  - 상세: 이 문서는 §Rationale(247-248행)에서 스스로를 "구현 현황의 SoT — 커버리지 확장 시 §1.1 표를 함께 갱신해야 한다"고 선언한다. 그런데 리뷰 대상 diff 가 정확히 그 "커버리지 확장"이며, 4개 서비스 모두 `import { AuditLogsService }`(triggers.service.ts:2, schedules.service.ts:2, workflows.service.ts 상단, model-config.service.ts:2)를 갖고 실제 기록한다 — 문서의 "AuditLogsService import 가 전혀 없다"는 서술이 이제 사실과 다르다.
  - 제안: 코드 유지 + spec 반영. §1.1 표에 4개 writer 행 추가(각 action/resource_type/비고), 82-88행 커버리지 갭 문단 갱신(4개 중 완료분 제거, `workflow.executed`만 잔류 명시), §5 외부 의존 표(198행)의 writer 도메인 목록 갱신.

- **[WARNING] [SPEC-DRIFT]** `spec/conventions/audit-actions.md` §3 "상태" 컬럼이 4개 리소스 행을 "미구현"으로 표기한다.
  - 위치: `spec/conventions/audit-actions.md:56-59` (`workflow`/`trigger`/`schedule`/`model_config` 행, 상태=미구현).
  - 상세: 동일한 이유로 stale. 67행 "구현 여부·커버리지 갭의 ground truth 는 data-flow/1-audit.md §1.1" 이라는 self-reference 도 위 두 번째 항목과 함께 갱신돼야 한다.
  - 제안: 코드 유지 + spec 반영. 4개 행 상태를 "구현"으로 갱신.

- **[WARNING] [SPEC-DRIFT]** `spec/2-navigation/2-trigger-list.md` 가 실제 구현 액션명과 다른 표기(`trigger.delete`/`trigger.update`)를 쓴다.
  - 위치: `spec/2-navigation/2-trigger-list.md:182`("audit log 의 `trigger.delete` action 항목으로 기록된다"), `:250`("활성/비활성 전환도 `trigger.update` 로 기록한다").
  - 상세: 실제 구현(`AUDIT_ACTIONS.TRIGGER_DELETED = 'trigger.deleted'`, `TRIGGER_UPDATED = 'trigger.updated'`, `audit-action.const.ts` 게이트 79-81행)과 명명 규약 SoT(`conventions/audit-actions.md` §2.1 과거분사)는 모두 과거분사형인데, 본 navigation 문서만 현재형으로 오기돼 있다. 이는 이번 diff 이전부터 있던 문서 간 불일치이며, 이번 CRUD 구현으로 실제 DB 에 적재되는 값과 이 문서가 안내하는 값이 처음으로 어긋나게 됐다.
  - 제안: 코드 유지 + spec 반영. 182행·250행 모두 `trigger.deleted`/`trigger.updated` 로 정정.

  > 참고: 위 4개 spec 위치는 이미 `plan/in-progress/spec-sync-auth-gaps.md:18-22`에 "spec SoT 4곳 동기화 — planner 턴 필요"로 미체크(`- [ ]`) TODO 로 추적 중이다(같은 4곳을 정확히 지목: `1-auth.md §4.1`, `data-flow/1-audit.md §1.1`, `conventions/audit-actions.md §3`, `2-navigation/2-trigger-list.md`). `developer` 는 `spec/` read-only 라 이번 커밋에서 반영이 불가능했던 것으로 보이며, plan 자체가 "한 커밋에서 동시에 고쳐야 재drift 하지 않는다"고 명시한다 — 이 리뷰는 그 백로그 항목이 diff 시점까지도 미해결임을 재확인한다.

- **[INFO]** 코드 레벨(비-spec) 결함은 발견되지 않았다. 4개 서비스(`triggers.service.ts`/`schedules.service.ts`/`workflows.service.ts`/`model-config.service.ts`) 전부에서 다음이 일관되게 지켜진다: (1) "커밋 후 기록" 순서(트랜잭션/저장 성공 후에만 `recordAudit` 호출, 실패 시 감사 미기록 — 각 서비스 spec 에 순서 고정 테스트 존재), (2) `remove()` 에서 TypeORM 이 엔티티 id 를 지우기 전에 `resourceId`/부가 필드를 미리 읽어두는 패턴, (3) named-parameter `recordAudit` 헬퍼로 workspaceId/userId 포지셔널 스왑 방지, (4) 컨트롤러→서비스 actor(userId) 배선을 위치까지 고정하는 전용 테스트(`*.controller.spec.ts`), (5) `AUDIT_ACTIONS` 상수 34개 전부가 실제로 최소 1곳에서 사용됨(미사용 상수 없음). `workflow.executed`·`saveCanvas`/`restoreVersion` 감사 미기록은 `plan/in-progress/spec-sync-auth-gaps.md` 에 의도적 defer 항목으로 이미 추적 중이라 이번 리뷰에서 별도 결함으로 제기하지 않는다.

- **[INFO]** RBAC — `model-config.controller.ts`/`schedules.controller.ts`/`triggers.controller.ts`/`workflows.controller.ts` 의 create/update/remove/setDefault 전부 `@Roles('editor')` 이며, `spec/5-system/1-auth.md` §3.2 RBAC 매트릭스(369-372, 384행: Workflow/Trigger/Schedule/Model Config = Owner·Admin·Editor 는 CRUD, Viewer 는 R)와 일치한다.

## 요약

이번 diff 는 spec §4.1 이 "Planned"로 선언했던 `workflow.*`/`trigger.*`/`schedule.*`/`model_config.*` CRUD 감사 로깅 13개 액션을 정확히, 그리고 매우 높은 테스트 밀도(커밋-후-기록 순서 고정, actor 배선 고정, 실패 시 미기록 등 뮤턴트 수준 가드)로 구현했다. 코드 자체의 기능 완전성·엣지 케이스·에러 시나리오·반환값·비즈니스 로직(1:1 결합 리소스 주(主) 리소스만 기록 등)은 모두 견고하며 code-level 결함은 발견되지 않았다. 유일한 실질 이슈는 spec fidelity 축(관점 9)에서, 구현이 앞서가면서 `spec/5-system/1-auth.md §4.1`·`spec/data-flow/1-audit.md §1.1`·`spec/conventions/audit-actions.md §3`·`spec/2-navigation/2-trigger-list.md` 4곳이 여전히 "미구현"으로 서술돼 stale 해졌다는 것이다 — 이는 코드 버그가 아니라 spec 갱신 누락(SPEC-DRIFT)이며, 이미 `plan/in-progress/spec-sync-auth-gaps.md` 에 planner 턴이 필요한 미체크 TODO 로 정확히 같은 4곳이 추적되고 있다.

## 위험도

LOW
