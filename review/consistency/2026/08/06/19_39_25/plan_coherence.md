# Plan 정합성 검토 — spec/conventions/audit-actions.md

## 발견사항

- **[WARNING]** 트리거 시크릿/토큰 회전 감사 액션 — "같은 planner 턴" 번들 지시가 이행되지 않은 채 그 턴이 이미 종료됨
  - target 위치: `spec/conventions/audit-actions.md` §3 도메인별 분류 레지스트리 (표 전체) — `trigger.rotate*` 계열 액션이 레지스트리에 없음. §Rationale 에도 언급 없음.
  - 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md` 미구현 항목 목록
    - 완료 항목 (line 18): "**spec SoT 4곳 동기화** — 완료 (2026-08-06, planner 턴)". `conventions/audit-actions.md §3` 상태 컬럼 갱신 + 액션명 오기 3곳 정정을 이 턴에서 수행.
    - 미해결 항목 (line 56): "**트리거 시크릿/토큰 회전 3종 감사 — planner 선행 필요**". `TriggersService.rotateNotificationSecret`/`revokePerTriggerToken`/`rotateBotToken` 이 `recordAudit` 를 호출하지 않고, 대응 액션이 `spec/` 카탈로그에 0건이라 `1-auth.md §4.1` + `conventions/audit-actions.md` 개정이 **선행**돼야 한다고 명시. 이어서 "아래 'spec SoT 동기화' 항목과 **같은 planner 턴에서 함께** 처리하는 것이 맞다" 라고 명시적으로 번들을 지시한다.
  - 상세: plan 이 두 항목을 **같은 planner 턴**으로 묶어야 한다고 명시했는데, 실제로 완료된 SoT 동기화 턴(2026-08-06)은 상태 컬럼 갱신·오기 3곳 정정·Rationale 승격만 수행했고 `trigger.rotate*` 카탈로그 추가는 포함하지 않았다(target §3 레지스트리에 부재로 확인됨). 즉 plan 이 지시한 번들이 깨진 채로 "같은 턴" 기회가 이미 지나갔다 — 이제 이 항목은 **별도의 새 planner 턴**이 필요한 상태인데, plan 문서는 여전히 "아래 항목과 같은 턴에서" 라는, 이미 유효기간이 지난 지시 문구를 그대로 두고 있다(참조 대상인 "spec SoT 동기화" 항목은 실제로는 그 항목의 **위**에 위치해 "아래" 표현 자체도 stale). Target 문서 자체가 이 미해결 결정을 침해하거나 앞지르진 않았지만(레지스트리에 미구현 액션을 넣지 않은 것은 정확), plan 이 명시한 번들 기회가 소실된 사실이 plan 에 반영돼 있지 않아 다음 진입자가 "이미 처리됐으려니" 오판할 위험이 있다.
  - 제안: `plan/in-progress/spec-sync-auth-gaps.md` line 56-63 항목을 갱신 — (a) "아래 'spec SoT 동기화' 항목과 같은 planner 턴에서" 문구를 "2026-08-06 SoT 동기화 턴에서 번들되지 못했음 — 별도 planner 턴 필요" 로 정정하고, (b) 이 항목을 위 완료 SoT 동기화 항목과 인접하게 재배치하거나 상호 참조를 명시해 두 항목이 더 이상 자동으로 묶이지 않는다는 점을 드러낼 것. target(`audit-actions.md`) 쪽은 수정 불필요 — 카탈로그에 미구현 액션을 미리 넣지 않은 현재 상태가 맞다.

## 요약
`spec/conventions/audit-actions.md` 자체는 `plan/in-progress/spec-sync-auth-gaps.md` 가 완료로 표시한 항목들(§3 상태 컬럼 구현 전환, `workflow.executed`/1:1 결합 리소스 Rationale 승격)과 정확히 정합하며, 미해결 항목(`workflow.executed` 보존 정책, LDAP/SAML)에 대해 target 이 앞서가거나 우회하는 서술은 없다. 유일한 정합성 갭은 plan 이 명시적으로 "같은 planner 턴에 번들" 하라고 지시한 트리거 시크릿/토큰 회전 감사 액션의 카탈로그 등재가, 실제로 완료된 그 턴(2026-08-06)에서 빠졌는데도 plan 문서가 이 사실을 반영하지 못해 지시 문구가 stale 해졌다는 점이다. target 문서 자체의 결함이 아니라 plan 쪽 갱신이 필요한 WARNING 이다. 검토 범위 내 다른 `plan/in-progress/**` 문서(ai-agent-tool-connection-rewrite, cafe24-backlog-residual, eia-context-schema-followups, execution-engine-residual-gaps, harness-consistency-summary-downgrade-rule, ie-resume-turn-boundary-cancel, marketplace-and-plugin-sdk)는 audit-actions.md 와 무관해 충돌 대상이 없다.

## 위험도
LOW
