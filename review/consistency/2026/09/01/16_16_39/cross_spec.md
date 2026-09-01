# Cross-Spec 일관성 검토 — `spec-draft-audit-resource-type-count.md`

## 발견사항

- **[WARNING]** "동반 정정" 3곳 중 3곳 모두 이미 적용된 상태 — target 의 실행 전제가 stale
  - target 위치: `plan/in-progress/spec-draft-audit-resource-type-count.md` §"동반 정정 (spec 밖 — 같은 오기산이 전파된 3곳)" (라인 95~105)
  - 충돌 대상:
    - `codebase/backend/src/modules/metrics/business-metrics.service.ts:174` — 이미 `distinct 10종` 으로 기재돼 있음 (target 이 "고쳐야 한다"고 지목한 JSDoc)
    - `plan/in-progress/spec-sync-auth-gaps.md:129` — `[x]` 체크된 상태로 "`resource_type` "실측 12종" 오기산 정정 → 10종 (2026-09-01)" 항목이 이미 존재하고, `spec-draft-audit-resource-type-count.md` 자신을 "정정 경위" 로 인용 중. "17개 감사 producer" 문구는 grep 0건 — 이미 제거됨(현재는 `producer 12개 모듈` 로 정정돼 있음, 라인 122)
    - `plan/complete/spec-draft-audit-write-failed-metric.md:135~161` — target 이 요구하는 "정정 노트를 덧붙인다(원문 보존)" 형태가 **이미 문자 그대로 존재**(§`## 정정 (2026-09-01, --impl-done consistency 16_02_03 WARNING)`, distinct 10종 표까지 동일)
  - 상세: target 문서는 이 3곳을 "함께 고친다"(현재형/미완료 전제)고 서술하지만, 실측 결과 세 곳 모두 이미 정정이 반영돼 있다. 유일하게 아직 미반영인 것은 target 이 실제로 쓰기 권한을 갖는 `spec/5-system/_product-overview.md` §NF-OB-07 카탈로그 표(현재도 `실측 12종` 그대로, 직접 확인)뿐이다. 이 changeset 은 developer 세션(같은 worktree, 같은 날짜 `2026-09-01`)이 이미 3곳을 나란히 고쳤고, 이 draft 는 그 사실을 반영하지 못한 채 작성된 것으로 보인다(병렬/선행 세션 머지 패턴).
  - 제안: target 의 "동반 정정" 섹션을 실행하기 전에 3개 파일의 현재 상태를 재확인하고, 이미 완료된 항목은 "완료 확인됨(참조용)" 으로 표시만 하고 재정정을 지시하지 않도록 draft 를 갱신한다. 실질적으로 남은 유일한 작업은 `spec/5-system/_product-overview.md` §NF-OB-07 표의 `실측 12종` → `실측 10종` 갱신 하나뿐임을 명시한다.

- **[INFO]** `spec/data-flow/1-audit.md` 자체 내부에 인접한 오기산(카운트 8 vs 12) — target 이 안 건드리는 자리지만 같은 근거로 반증됨
  - target 위치: (target 문서 자체는 이 문장을 인용하지 않음 — target §"실측" 표의 "producer 12개" 항목이 간접적으로 관련)
  - 충돌 대상: `spec/data-flow/1-audit.md:55` — "`AuditLogsService.record` 의 실제 호출자는 **8개 위치(5개 service 모듈 + 3개 auth/user controller)**다"
  - 상세: 바로 아래 §1.1 Writer 표(스스로 "이 표가 현재 코드에서 실제로 기록되는 action 의 SoT" 라고 선언)를 세면 Writer module 열의 distinct 파일이 **12개**(integrations/workspaces/workspace-invitations/executions/auth-configs/users.controller/auth.controller/webauthn.controller/workflows/triggers/schedules/model-config)다 — 본 검토에서 `grep -rln "private readonly auditLogsService: AuditLogsService"` 로 직접 재확인, target 의 "producer 12개" 측정치와 정확히 일치한다. "8개 위치" 문장은 2026-08-01 에 추가된 workflow/trigger/schedule/model_config 4개 CRUD 모듈(같은 문서 §"커버리지 갭" 문단이 그 도입일을 명시)이 반영되기 전 문구로 보이며, 표 갱신 시 요약 문장이 같이 갱신되지 않은 것으로 판단된다. target 이 검증한 "12개 producer 파일" 수치가 이 stale 문장의 반증 증거이기도 하다.
  - 제안: target 의 스코프는 아니므로 target 자체를 막을 사유는 아니다. 다만 이 PR 이 "세는 대상 교체로 인한 오기산" 을 주제로 삼고 있으므로, 발견 김에 `spec/data-flow/1-audit.md:55` 의 "8개 위치" 를 "12개 위치(5개→9개 service 모듈 + 3개 controller, 2026-08-01 CRUD 확장 반영)" 로 동반 정정하는 것을 권장한다 — 별도 planner 턴(작은 소정정)으로 처리 가능.

- **[INFO]** 검증 결과 — target 의 핵심 수치(10종)는 두 개의 독립 경로로 일치 확인됨
  - target 위치: `plan/in-progress/spec-draft-audit-resource-type-count.md` §"실측" 표, §"변경 제안"
  - 충돌 대상: `spec/data-flow/1-audit.md` §1.1 Writer 표 (resource_type 열)
  - 상세: (1) data-flow/1-audit.md §1.1 표의 41개 action 행에서 distinct `resource_type` 값을 세면 `integration·workspace·member·execution·auth_config·user·workflow·trigger·schedule·model_config` = 정확히 10종. (2) 본 검토에서 `auditLogsService.record(` 호출 지점 27곳(코드 직접 grep, `*.spec.ts` 제외)을 전수 대조해도 동일한 10종이 나온다. 두 독립 경로(스펙 문서의 큐레이션된 표 vs 소스 재실측)가 모두 target 의 "10종" 결론과 일치하므로, 이 수정은 CRITICAL/WARNING 성격의 모순이 아니라 **기존 spec(data-flow/1-audit.md)과 완전히 정합**하는 정정이다. `workspace_invitation`(workspace-invitations.service.ts:220)·`alert_rule`(alerts-evaluator.service.ts:216)이 알림(`NotificationsService.notify`) 값이라 감사 카운터에서 제외된다는 target 의 판단도 코드 확인 결과 옳다.
  - 제안: 없음(참고용 — 이 항목은 결함이 아니라 target 의 정정이 기존 spec 과 상충하지 않음을 명시하기 위한 기록).

## 요약

target 은 `spec/5-system/_product-overview.md` NF-OB-07 카탈로그의 `resource_type` 카디널리티 오기산("12종"→"10종")을 정정하는 좁은 범위의 spec draft다. 핵심 수치는 `spec/data-flow/1-audit.md` §1.1 Writer 표(기존 spec, 독립 큐레이션)와 본 검토의 직접 소스 재실측(27개 `record()` 호출 지점 grep) 양쪽 모두에서 "10종" 으로 재확인되어, target 이 제안하는 변경 자체는 기존 spec 과 충돌하지 않고 오히려 기존 SoT 표와 지금까지 어긋나 있던 `_product-overview.md` 쪽을 정합시킨다. 다만 target 이 "함께 고친다" 고 명시한 3개 동반 정정 파일(`business-metrics.service.ts` JSDoc·`spec-sync-auth-gaps.md`·`spec-draft-audit-write-failed-metric.md`)은 실측 결과 **이미 전부 적용되어 있어** target 의 실행 전제가 stale하다 — 병렬/선행 세션이 먼저 반영한 것으로 보이며, 실제로 미반영 상태인 곳은 target 이 쓰기 권한을 갖는 `spec/5-system/_product-overview.md` 그 한 곳뿐이다. 부수적으로 `spec/data-flow/1-audit.md:55` 의 "8개 위치" 문장이 자신의 SoT 표(12개 writer)와 이미 어긋나 있다는 것도 이번 실측 과정에서 함께 드러났으나 target 의 직접 책임 범위는 아니다.

## 위험도

LOW
