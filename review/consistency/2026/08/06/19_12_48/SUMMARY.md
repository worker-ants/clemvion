# Consistency Check 통합 보고서

**BLOCK: YES** — `cross_spec` checker 가 CRITICAL 1건을 발견함 (spec SoT 3곳이 이미 병합된 구현과 어긋나는 "합의된 stale" 상태)

## 전체 위험도
**CRITICAL** — `audit-actions.md`/`1-auth.md`/`data-flow/1-audit.md` 3개 spec 문서가 서로는 정합하지만 셋 다 실제 구현(commit `d02bb422f`, #1081)과 어긋나 workflow/trigger/schedule/model_config 감사 로깅을 "미구현"으로 오기하고 있음. 이번 세션의 실제 diff(harness CI 백스톱, packages `prepare` 스크립트) 자체는 `spec/` 을 건드리지 않지만, target 으로 번들된 `spec/conventions` 스냅샷 안에서 기존에 살아있던 CRITICAL 이 발견됨.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `audit-actions.md` §3 레지스트리 "상태" 컬럼이 workflow/trigger/schedule/model_config 를 "미구현"으로 표시하나 실제로는 이미 구현·병합됨 | `spec/conventions/audit-actions.md` §3 (56~59행) | `spec/5-system/1-auth.md` §4.1 (429~436행 Planned 표), `spec/data-flow/1-audit.md` §1.1 (45~71/82~88행), 코드 `audit-action.const.ts`(13개 액션 기정의) + `workflows/triggers/schedules/model-config.service.ts`(전부 AuditLogsService 호출, commit `d02bb422f` #1081) | 한 커밋에서 3곳 동시 정정: ① `1-auth.md §4.1` 해당 CRUD 를 Planned→구현됨 표로 이동, ② `data-flow/1-audit.md §1.1` Writer 표에 4개 서비스 추가 + 커버리지 갭 문단 정정, ③ `audit-actions.md §3` 4행의 상태를 `구현`으로 변경. `plan/in-progress/spec-sync-auth-gaps.md` 가 이미 추적 중(미처리) — planner 턴 필요, developer 는 spec read-only |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `<resource>.<verb>` 과거분사 명명 규약(§2.1) 위반 — `trigger.delete`/`trigger.update` 오기 3곳 (실재하지 않는 액션명) | `spec/conventions/audit-actions.md` §1(67~69행)·§3(57행) | `spec/2-navigation/2-trigger-list.md:182,252`, `spec/5-system/15-chat-channel.md:377` | 3곳을 `trigger.deleted`/`trigger.updated` 로 정정 |
| 2 | cross_spec | 존재하지 않는 "`trigger.delete` permission" 서술 — 실제 인가 모델은 역할 기반 CRUD 매트릭스, 개별 permission 아님 | (간접) `audit-actions.md` vs `1-auth.md` §3.2 | `spec/2-navigation/2-trigger-list.md:182` | "`§3.2 리소스별 권한 매트릭스`(Trigger CRUD)로 보호되며 audit log 의 `trigger.deleted` action 으로 기록"으로 정정. `plan/in-progress/spec-sync-auth-gaps.md`(24~27행)가 이미 동일 지적 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 코드 주석에만 있는 도메인 결정 2건(1:1 결합 리소스 주 리소스만 기록 / 고빈도 액션 보존정책 유예)이 spec `## Rationale` 미승격 | `spec/conventions/audit-actions.md` §Rationale, `audit-action.const.ts` 주석 | 위 CRITICAL 정정 커밋과 같은 planner 턴에서 Rationale 에 추가 |
| 2 | rationale_continuity | 이번 diff(harness CI 백스톱)는 `spec/` 을 전혀 건드리지 않는데 target 이 `spec/conventions` 전체를 번들링 — 비교할 신규 결정 자체가 없음 | target 전체 | scope 산정 로직 재확인 (기능상 해는 없음, 토큰 예산만 소모) |
| 3 | convention_compliance | 동일하게 diff 0건 확인 — `code_areas=["codebase"]` diff 는 7개 패키지 `package.json` prepare 스크립트뿐, conventions 표면과 무관 | target 전체 | 조치 불요 |
| 4 | plan_coherence | `--impl-done` scope 산정이 diff 부재를 사전 확인하지 않는 기존 harness 결함의 재발 — `plan/in-progress/harness-consistency-summary-downgrade-rule.md` 에 이미 미체크 항목으로 추적 중 | target 전체 | 해당 plan 에 2026-08-06 재발 사례 기록 또는 orchestrator 에 "diff 0건이면 scope 미채택" 사전검사 추가 |
| 5 | plan_coherence | governing plan(`harness-review-gate-ci-backstop.md`)은 이번 diff 와 직교, 충돌 없음 | `plan/in-progress/harness-review-gate-ci-backstop.md` | 조치 불요 |
| 6 | naming_collision | target 6개 문서 전부 diff-base 대비 바이트 단위 동일(수 주 전 병합) — 신규 식별자 도입 없음, BYPASS | target 전체 | 조치 불요 |
| 7 | naming_collision | 기존 잠재 혼동 2건(`privacy_*` id prefix, "Cafe24 request envelope" vs "노드 출력 envelope") — 각 문서가 이미 자체 인지·각주로 구분 | `cafe24-api-catalog/_overview.md` §5, `chat-channel-adapter.md` §Rationale | 조치 불요 (기존 합의 사항) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | CRITICAL | 3개 spec SoT(`audit-actions.md`/`1-auth.md`/`data-flow/1-audit.md`)가 이미 병합된 구현(#1081)을 반영 못해 "미구현"으로 합의된 채 정지 + `trigger.delete/update` 오기 3곳 + 존재하지 않는 permission 서술 |
| rationale_continuity | NONE | 이번 diff 가 spec 을 안 건드려 평가 대상 없음. scope 번들링 절차적 관찰만 INFO |
| convention_compliance | NONE | diff 는 packages `prepare` 스크립트뿐, conventions 표면과 무관 |
| plan_coherence | NONE | target-diff 0건, governing plan 과 직교. 기존 harness scope 결함 재발만 INFO |
| naming_collision | NONE | target 문서 전부 diff-base 대비 무변경(BYPASS), 신규 식별자 없음 |

## 권장 조치사항
1. **(BLOCK 해소)** `project-planner` 턴으로 `audit-actions.md §3` / `1-auth.md §4.1` / `data-flow/1-audit.md §1.1` 3곳을 한 커밋에서 "구현됨"으로 동시 정정 (workflow/trigger/schedule/model_config CRUD, `workflow.executed` 만 Planned 잔류). `plan/in-progress/spec-sync-auth-gaps.md` 가 이미 이 작업을 추적 중이므로 그 plan 을 실행하면 됨.
2. 같은 정정 커밋에서 `trigger.delete`→`trigger.deleted`, `trigger.update`→`trigger.updated` 오기 3곳(`2-trigger-list.md:182,252`, `15-chat-channel.md:377`) 및 존재하지 않는 "`trigger.delete` permission" 서술(`2-trigger-list.md:182`)을 함께 정정.
3. `audit-actions.md §Rationale` 에 코드 주석에만 있는 2개 도메인 결정(1:1 결합 리소스 처리, 고빈도 액션 보존정책 유예)을 승격.
4. (비차단, harness 위생) `plan/in-progress/harness-consistency-summary-downgrade-rule.md` 의 "--impl-done/--impl-prep scope 가 diff 부재를 사전 확인하지 않는다" 미체크 항목에 이번 재발 사례(2026-08-06, `spec/conventions` scope, diff 0건)를 추가 기록.