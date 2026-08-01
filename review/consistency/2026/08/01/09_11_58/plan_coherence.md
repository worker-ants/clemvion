# Plan 정합성 검토 — spec/data-flow/ (--impl-prep)

## 검토 범위·방법 메모

target 은 `spec/data-flow/` (git diff 는 origin/main 대비 0건 — 이 worktree 는 아직 코드/스펙을 건드리지
않은 순수 impl-prep 단계). 프롬프트 번들은 target 8/15 파일(`0-overview`·`1-audit`·`3-execution`·
`7-llm-usage`·`11-workflow`·`12-workspace`·`2-auth`·`4-file-storage`)과 plan/in-progress 7개 파일만
실었고, 나머지는 컨텍스트 예산 초과로 생략(각 섹션 하단에 생략 목록 명시)됐다. 생략 목록에 이번 작업
(worktree 이름 `audit-logging`)과 가장 직결되는 `plan/in-progress/spec-sync-auth-gaps.md` 와
`spec/data-flow/10-triggers.md` 가 포함돼 있어, 프롬프트 지시("여기 없다는 사실을 근거로 삼지 말 것")에
따라 두 파일 및 관련 파일(`spec/conventions/audit-actions.md`, `spec/data-flow/1-audit.md` 전문,
`spec/5-system/1-auth.md §4`)을 직접 Read/grep 으로 확인해 판단에 반영했다.

## 발견사항

- **[INFO]** 번들 생략된 `spec-sync-auth-gaps.md` 직접 확인 — target 과 정합, 충돌 없음
  - target 위치: `spec/data-flow/1-audit.md:82-86`(§1.1 "커버리지 갭": `workflow.*`/`trigger.*`/
    `schedule.*`/`model_config.*` 미구현), `spec/5-system/1-auth.md:429-438`(§4.1 Planned 카탈로그)
  - 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md:13-31`
  - 상세: 이 plan 파일은 프롬프트 번들에서 컨텍스트 예산 초과로 생략됐다(하단 "생략된 파일 53개"
    목록). 직접 Read 로 확인한 결과 target 의 "workflow/trigger/schedule/model_config 감사 미구현"
    서술과 정확히 일치하며 상충 없음 — repo 전체에서 `AuditLogsService`/`audit-log` 를 언급하는
    `plan/in-progress/**` 파일은 이 파일 하나뿐이다(`grep -rl` 확인). 이 plan 은 오히려 "**`status:
    implemented` 승격 금지 조건** — LDAP/SAML 이 닫히더라도 §4.1 감사 로깅 갭이 남아 있는 한
    `spec/5-system/1-auth.md` 를 `implemented` 로 올리면 안 된다"(`:28-29`)를 명시하며, 명명·시제
    규약(`spec/conventions/audit-actions.md` §3 레지스트리, `workflow`/`trigger`/`schedule`/
    `model_config` 4행 모두 "미구현" 상태로 이미 패턴까지 확정돼 있음)도 열려 있는 결정 없이 완결돼
    있다. 즉 target 이 plan 의 미해결 결정을 우회하거나 선행 조건을 무시하는 지점은 없다.
  - 제안: 충돌 없음(조치 불요). 다만 구현 완료 후 ① `spec-sync-auth-gaps.md` §4.1 항목 체크,
    ② `spec/conventions/audit-actions.md` §3 레지스트리의 4개 행 "미구현"→"구현" 갱신,
    ③ `spec/5-system/1-auth.md` §4.1 Planned 표에서 해당 행을 "구현된 액션" 표로 이동을 함께
    수행할 것. `spec/5-system/1-auth.md` 의 `status` 는 LDAP/SAML(§1.3) 이 별도로 남아 있어 이번
    작업만으로는 `implemented` 승격 불가함을 인지할 것(동일 plan `:28-29`).

- **[INFO]** `audit_log` 보존 정책 "미정" 상태에서 고빈도 후보 액션(`workflow.executed`)이 Planned 목록에 존재 — 이를 다루는 plan 부재
  - target 위치: `spec/data-flow/1-audit.md:162`(§3 보존 정책 — "정책 미정 — 현재 무제한 (pruner
    없음)"), `spec/5-system/1-auth.md:433`(`workflow.executed` Planned 액션), `:448`(§4.2 "보존 정책
    미정")
  - 관련 plan: 없음 — `plan/` 전체에서 `audit_log` 보존/prune 을 다루는 in-progress 항목 0건
    (`login_history` 180일 pruner 는 이미 구현된 별개 대상이며 무관).
  - 상세: target 의 Planned 카탈로그(`workflow.*`)에는 `created`/`updated`/`deleted` 외에
    `executed` 가 포함된다. CRUD 3종은 저빈도(편집 시점)이지만 `executed` 는 의미상 트리거(webhook
    포함) 발동마다 기록될 가능성이 있어 카디널리티가 다르다. 반면 `audit_log` 는 pruner 가 없고
    보존 정책이 spec 자체에서 "미정" 으로 정직하게 명시돼 있으며, 이 정책 결정을 담당하는 plan 이
    어디에도 없다. target 은 이 상태를 숨기지 않고 명시하므로 "미해결 결정 우회" 는 아니지만,
    금번 audit-logging 구현이 `workflow.executed` 까지 포함할 경우 결정 공백 상태에서 고빈도·무제한
    쓰기가 그대로 실배포될 위험이 있다.
  - 제안: 이번 작업 범위에 `workflow.executed` 가 포함되는지 먼저 확인할 것. 포함된다면 착수 전
    보존 정책(예: `login_history` 와 동일한 pruner 도입 여부)을 사용자/planner 결정 항목으로 명시적
    으로 올릴 것을 권장. 범위를 CRUD 3종(`created`/`updated`/`deleted`)으로 한정하고 `executed` 는
    보존 정책 결정과 묶어 별도 plan 으로 분리하는 대안도 가능.

- **[INFO]** 동일 target 폴더를 다루던 선행 plan(`spec-data-flow-structural-followups.md`) 마감 잔여 — 이번 작업과 직접 충돌 없음
  - target 위치: `spec/data-flow/0-overview.md`, `12-workspace.md`, `3-execution.md` (이번 target
    스코프에 포함된 파일들)
  - 관련 plan: `plan/in-progress/spec-data-flow-structural-followups.md:71-93`(체크리스트),
    `:95-104`(§4 잔여)
  - 상세: 체크리스트 5항목 중 4항목이 `[x]` 완료 상태이며, 그 내용(RBAC 섹션 승격·SIGTERM 상호참조
    각주·data-flow 범위 "LLM Config"→"Model Config" 명칭 통일)은 커밋 `0d20a9cc9`("docs(spec):
    data-flow 구조 후속 3건", 이미 `origin/main` 병합 — `git log` 로 확인)로 실현되어 현재 target
    파일에 이미 반영돼 있다. 마지막 "push + PR" 체크박스만 미체크로 남아 plan 이
    `plan/in-progress/` 에 계속 남아 있고, §4 "서술형 LLM Config 표기 잔여"(`3-workflow-editor/`·
    `4-nodes/`·`5-system/`, data-flow 밖 범위)는 이 plan 의 체크리스트 항목이 아니라서 후속 backlog
    로 분리되지 않은 채 방치돼 있다.
  - 제안: 이번 audit-logging 작업과는 무관해 차단 사유 아님. 다만 같은 target 디렉터리를 다루는
    후속 검토에서 혼선을 막기 위해 planner 턴에서 이 plan 을 `plan/complete/` 로 이동(또는 push+PR
    체크 확정)하고, §4 잔여를 별도 plan 항목으로 분리할 것을 권장.

## 요약

`spec/data-flow/`(특히 이번 작업 대상인 `1-audit.md` 의 감사 로깅 커버리지 갭 서술)는 `plan/in-progress`
와 충돌하는 미해결 결정을 우회하지 않는다 — 관련 명명·시제 규약(`spec/conventions/audit-actions.md`)이
이미 완결돼 있고, 유일하게 직결되는 plan(`spec-sync-auth-gaps.md`, 자동 번들에서는 컨텍스트 예산으로
생략됐으나 직접 확인)도 동일한 갭을 정확히 추적할 뿐 상충하는 결정을 내리지 않는다. `3-execution.md`
의 SIGTERM 분류 미결 항목(`spec-update-node-cancellation-shutdown-classification.md`)도 이미 "어느
쪽도 선점하지 않는" 중립 서술로 hedging 돼 있어 이번 target 범위에서 문제 없다. 다만 `audit_log`
보존 정책이 spec 자체에서 "미정" 으로 남아 있는 채 Planned 목록에 고빈도 후보 액션(`workflow.executed`)
이 함께 있어, 이 액션까지 구현 범위에 포함된다면 착수 전 보존 정책을 결정 항목으로 명시적으로 올릴
필요가 있다(정보 제공 수준, 차단 아님). 그 외 같은 target 폴더를 다루던 선행 plan 의 마감 잔여
정리는 이번 작업과 무관한 별도 hygiene 사안이다. 종합적으로 CRITICAL/WARNING 급 충돌은 발견되지
않았다.

## 위험도

LOW
