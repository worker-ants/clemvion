# Cross-Spec 일관성 검토 — `spec/data-flow/` (감사 로그 중심)

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=`spec/data-flow/`)

## 발견사항

### [WARNING] `spec/2-navigation/2-trigger-list.md` 가 미구현 `trigger.*` 감사 액션을 "이미 기록됨"으로 서술 — target(감사 도메인 SoT) 과 정면 모순

- **target 위치**: `spec/data-flow/1-audit.md` §1.1 (L82-88) — "`workflow.*` / `trigger.*` / `schedule.*` / `model_config.*` 액션은 **여전히 미구현**이다 — workflows / triggers / alerts / schedules 모듈에는 `AuditLogsService` import 가 전혀 없다." 같은 결론이 `spec/5-system/1-auth.md` §4.1 (L414-436, "현재 구현된 액션" 표 vs "Planned (미구현)" 표에 `trigger.created/updated/deleted` 분리 등재) 과 `spec/conventions/audit-actions.md` §3 (레지스트리 표, `trigger` 행 = "미구현") 3곳 모두 동일하게 확인한다.
- **충돌 대상**: `spec/2-navigation/2-trigger-list.md` (frontmatter `status: implemented`, 전체 문서가 구현완료 선언)
  - L182: "API 게이트는 [Spec 인증 §3] 의 `trigger.delete` permission 으로 보호되며 **audit log 의 `trigger.delete` action 항목으로 기록된다**"
  - L252 (Rationale): "**audit**: 활성/비활성 전환도 `trigger.update` 로 기록한다 (별도 `trigger.toggle` 동사 없음)."
  - 둘 다 현재형·단정문으로, "Planned"/"미구현" 같은 유보 표현이 전혀 없다.
- **상세**: 코드로 직접 검증한 결과 target 의 서술이 맞고 trigger-list.md 가 틀렸다 — `grep -rl AuditLogsService codebase/backend/src/modules/triggers/` 는 0건이다 (`workflows`/`schedules`/`alerts` 모듈도 0건). 즉 트리거 삭제·활성/비활성 전환은 현재 **어떤 audit_log row 도 남기지 않는다**. `git blame` 상 trigger-list.md 의 이 두 서술은 각각 2026-05-31/2026-06-04 마지막 수정인데, 감사 액션의 "구현/Planned" 2-트랙 분리(`AUDIT_ACTIONS` union 강제 G-01, `execution.re_run` 개명 G-02, `conventions/audit-actions.md` 신설)는 2026-06-11~06-14 에 이뤄졌다 — 즉 그 정리 작업이 `5-system/1-auth.md` 본문은 고쳤지만 `2-navigation/2-trigger-list.md` 의 동일 오류(2026-06-10 spec-coverage 리포트 G-02 가 이미 "trigger.delete 는 코드에 0건" 이라고 지목한 바로 그 예시)를 이 문서에는 반영하지 못한 채 약 2개월간 방치된 상태다. `spec-data-flow-structural-followups`, `spec-audit-actions-conventions` 등 최근 정리 plan 어디에도 trigger-list.md 갱신 항목은 없다.
  이는 이번 audit-logging 작업(현재 워크트리)의 범위 판단에 직접 영향을 준다 — trigger-list.md 만 읽으면 "trigger 삭제/토글 감사는 이미 구현됨"으로 오판해 target 의 Planned 항목(§1.1 커버리지 갭)을 스코프에서 빠뜨릴 위험이 있고, 반대로 이번 작업이 그 갭을 메우는 작업이라면 완료 후 trigger-list.md 의 이 서술은 (지금은 틀렸지만) 사후적으로 맞는 문장이 된다.
- **제안**:
  1. (즉시, project-planner) `2-navigation/2-trigger-list.md` L182/L252 를 "Planned(미구현) — [data-flow §1.1](../data-flow/1-audit.md)/[5-system/1-auth.md §4.1](../5-system/1-auth.md#41-기록-대상-액션) 참조" 로 정정 — target 과 정합화.
  2. 이번 audit-logging 작업이 `trigger.created/updated/deleted` 구현까지 포함한다면, 구현 완료 시 `data-flow/1-audit.md §1.1` 표 + `5-system/1-auth.md §4.1`(Planned→구현 이동) + `conventions/audit-actions.md §3`(상태 컬럼) + `2-navigation/2-trigger-list.md` L182/L252 를 **한 커밋에서 동시 갱신**해야 함 (커버리지 SoT 가 4곳에 흩어져 있어 하나만 고치면 다시 drift).

### [INFO] `spec/5-system/15-chat-channel.md` Rationale 이 동일한 미구현 전제(`trigger.update` 감사)를 재생산

- **target 위치**: `spec/data-flow/1-audit.md` §1.1 (trigger.* 미구현 — 위 항목과 동일 근거)
- **충돌 대상**: `spec/5-system/15-chat-channel.md` §5.4.1 L377, L609-611 — "PATCH 로 직접 `botTokenRef` 교체 시 … audit log 가 `trigger.update` 와 `chat-channel.rotate-bot-token` 으로 mixed. 따라서 single-path" (rejected-alternative 근거 서술)
- **상세**: 이 문장은 기각된 대안을 정당화하는 Rationale 이라 "현재 상태" 단정은 아니지만, "PATCH 로 트리거를 고치면 `trigger.update` 로 감사된다"는 전제를 깔고 있다 — 첫 finding 과 같은 뿌리의 가정이 두 번째 문서에 번져 있다는 신호. `chat-channel.rotate-bot-token` 이라는 액션명 자체도 `AUDIT_ACTIONS`/`audit-actions.md` 레지스트리 어디에도 없다(가상의 이름).
- **제안**: 급하지 않음 — trigger.* 감사가 실제 구현될 때 이 문구도 실제 액션명(`trigger.update` 확정 여부, `chat-channel.*` 네임스페이스 채택 여부)에 맞춰 함께 정정. 지금 당장 blocking 은 아님.

### [INFO] `spec/0-overview.md` §6 로드맵 표에 "Audit Log" 백엔드 기능 자체가 등재되지 않음

- **target 위치**: `spec/data-flow/1-audit.md` §2.1 (`GET /audit-logs` 워크스페이스 단위 조회 API, 구현됨) / `spec/5-system/1-auth.md` §3.2 RBAC 매트릭스의 `Audit Log | R | R | — | —` 행
- **충돌 대상**: `spec/0-overview.md` §6.1(완료)/§6.2(백엔드만 존재)/§6.3(로드맵) 세 표 — "Audit Log" 관련 행이 하나도 없다. §6.1 "내비게이션" 행도 대시보드~프로필까지 나열하지만 감사 로그 화면은 없다. 실제로 `codebase/frontend/src` 전체에 audit-log 관련 페이지가 0건이라 UI 는 없는 게 맞다 — 그렇다면 이 기능은 "Parallel 노드"처럼 §6.2(백엔드만 존재)에 등재되는 게 자연스러운데 빠져 있다.
- **상세**: 직접적 "모순"은 아니고 root overview 문서의 커버리지 누락(침묵)이다. 다만 cross-spec 관점에서 "계층 책임" 문서인 0-overview.md 의 현황 표가 이미 구현된 백엔드 표면(감사 로그 API+RBAC)을 하나도 반영하지 않는 것은 spec-coverage 관점에서 놓치기 쉬운 사각지대다.
- **제안**: 이번 audit-logging 작업이 감사 로그 열람 UI(신규 내비게이션 페이지)를 포함한다면 완료 후 `0-overview.md §6.1` 내비게이션 행 + `spec/2-navigation/_product-overview.md` IA 에 신규 진입점을 등재. 백엔드 유지 범위라면 project-planner 후속으로 `§6.2` 에 "Audit Log(API-only, UI 없음)" 한 줄 추가를 권장 (비차단).

## 요약

target(`spec/data-flow/` 번들, 특히 `1-audit.md`)은 그 자체로 내적 일관성이 높고 실제 코드(`AuditLogsService` 호출부 8곳, RBAC 가드, 스키마 컬럼)와 정확히 일치하며, `5-system/1-auth.md` §3.2/§4·`1-data-model.md` §2.18/§2.18.1/§2.18.2·`conventions/audit-actions.md` 와도 필드·RBAC·명명 규약이 모두 정합했다. 유일하게 실질적인 cross-spec 충돌은 target 자신이 아니라 **다른 영역**(`spec/2-navigation/2-trigger-list.md`, `status: implemented`)이 target 이 명시적으로 "미구현(Planned)"이라 밝힌 `trigger.delete`/`trigger.update` 감사 기록을 이미 존재하는 것처럼 단정 서술하는 것이다 — 코드로 재확인해도 실제 미구현이 맞으므로 trigger-list.md 쪽이 stale 하다. 이 drift 는 2026-06-11~06-14 감사 액션 정리 작업이 `5-system/1-auth.md` 는 고치고 `2-navigation/2-trigger-list.md` 는 놓친 데서 비롯된 것으로 추정되며, 약 2개월간 미수정 상태로 남아 있어 이번 audit-logging 작업의 스코프 판단(이미 됐다고 오판 vs 구현 후 문서 동기화 누락)에 실제 영향을 줄 수 있다. 그 외 `15-chat-channel.md` 의 같은 전제 재생산과 `0-overview.md` 로드맵 표의 침묵은 부수적 INFO 다.

## 위험도

MEDIUM
