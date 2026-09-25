# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 성공(전문 확보), CRITICAL 없음. WARNING 5건(cross_spec 1, rationale_continuity 2, convention_compliance 1, plan_coherence 1)만 발견.

## 전체 위험도
**MEDIUM** — CRITICAL·명명 충돌은 없으나, `ai-assistant.md`(워크플로우 어시스턴트 통합 후보 필터 계약)와 `error-codes.md §5`(rename 이력) 두 SoT 문서가 이번 PR 의 변경 범위·추적 목록에서 빠져 있어 구현 착수 전 보강이 권장됨.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `list_integrations` 도구 · `integration-selector`/`mcp-server-selector` 노드 후보의 SoT 문서가 신규 소유자 필터(§8)를 반영하지 않음 | `spec/2-navigation/4-integration.md §8` 판정 규칙 블록 | `spec/3-workflow-editor/4-ai-assistant.md` §4.2(`list_integrations` 행, L201) · §4.3.1 필터 표(L371-372) | 변경안·`spec_impact`에 `ai-assistant.md` 추가, 두 행에 "남의 personal 제외(§8)" 명시. 최소한 followup plan 의 "아직 강제되지 않는 것" 목록에 추가 |
| 2 | rationale_continuity | Personal 소유자 판정을 컨트롤러/서비스 핸들러별 수동 호출로 배치 — 이 프로젝트가 두 차례(73개·15개 라우트) 겪은 "opt-in 누락" 패턴과 구조적으로 동일, 완결성 안전망 없음 | `plan/in-progress/integration-personal-owner.md` `## 설계` (컨트롤러별 `resolveRole` 호출) | `spec/data-flow/12-workspace.md` Rationale "멤버십 검증은 가드 1곳에서" (기각된 대안: 라우트별 수동 부착) 및 "경로 파라미터 워크스페이스도 가드가 본다(2026-09-25)" 재발 이력 | plan 에 전수 커버리지 안전망 명시 — 신규 `:id`/`integrationId` 핸들러 전수가 공유 판정 함수를 거치는지 검증하는 부트 캐너리(`assertWorkspaceIdReflectionWorks` 선례) 또는 인터셉터/데코레이터 방식으로 전환. 최소한 체크리스트에 "신규 경로 추가 시 자동 강제 여부" 완료 조건 추가 |
| 3 | rationale_continuity | `ai-assistant.md` candidate-lookup 계약("워크스페이스 스코프로 쿼리")이 이번 구현(`IntegrationsService.findAll` owner 필터)으로 사실상 좁혀지는데 그 문서의 spec_impact·Rationale 미갱신 | `plan/in-progress/integration-personal-owner.md` §요구1, frontmatter `spec_impact`(= `4-integration.md` 뿐) | `spec/3-workflow-editor/4-ai-assistant.md` ED-AI-39 Rationale "구현자가 기억해야 할 계약" 1번, §4.3.1/§4.1 표 | "## 영향 — 다른 spec" 및 `spec_impact` 리스트에 `ai-assistant.md` 추가, 해당 표 행에 "본인 personal 만(§8)" 구절 또는 ED-AI-39 Rationale 각주 추가 |
| 4 | convention_compliance | `FORBIDDEN → ADMIN_REQUIRED` 승격(6곳)이 `error-codes.md §5` Rename 이력 표에 미등재 — 직전 `--spec` 검토가 조건부로 요구했던 후속 등재 누락 | `spec/2-navigation/4-integration.md §8` 4번째 불릿 및 Rationale "Personal 통합 소유자 강제(2026-09-25)" | `spec/conventions/error-codes.md §5` "Rename 이력(Retired codes)" 표 (SoT) | `error-codes.md §5`에 `FORBIDDEN → ADMIN_REQUIRED` 행 추가(대상 6곳, 등급 A — 프런트엔드 참조 0건 실측, 비고에 plan 인용). 또는 `--impl-done` 시점 등재로 미루되 plan 체크리스트에 그 항목을 명시 |
| 5 | plan_coherence | `error-handling.md §1.2` `ADMIN_REQUIRED` 행이 다른 열린 planner 항목(`spec-draft-nullable-notation-followups.md`)의 표적과 부분 중복 편집 — `removeMember` 의 `throwAdminRequired()` 발행처 누락 | `spec/5-system/3-error-handling.md:46` (`ADMIN_REQUIRED` 행) | `plan/in-progress/spec-draft-nullable-notation-followups.md:5093`(G) 표 #2(`:5103`) | 이번 PR 또는 후속 정정 커밋에서 `removeMember`도 같은 행에 함께 등재해 (G) 항목의 표 #2를 동시에 닫거나, 그 항목에 "이 행은 2026-09-25 PR이 먼저 편집, 남은 것은 `removeMember` 한 발행처" 각주 추가 |

## 참고 (INFO)

(없음 — naming_collision 은 위험도 NONE, 신규 식별자 전부 기존 재사용 또는 무충돌 확인)

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `ai-assistant.md`(워크플로우 어시스턴트 통합 후보 필터 계약)가 §8 신규 소유자 필터를 반영하지 않음 |
| rationale_continuity | MEDIUM | 판정 로직의 수동 배치(완결성 안전망 부재) + `ai-assistant.md` candidate-lookup 계약 미갱신 |
| convention_compliance | LOW | `FORBIDDEN→ADMIN_REQUIRED` 승격의 `error-codes.md §5` rename 이력 등재 누락 |
| plan_coherence | LOW | `ADMIN_REQUIRED` 발행처 행의 다른 열린 plan 항목과 부분 중복 편집 |
| naming_collision | NONE | 신규 식별자(`integration-visibility.ts` 등) 전부 무충돌, 기존 식별자(`ADMIN_REQUIRED`·`resolveRole` 등) 재사용 확인 |

## 권장 조치사항
1. `spec/3-workflow-editor/4-ai-assistant.md`를 이번 PR의 "변경안 — 다른 spec" 및 `spec_impact`에 추가 — §4.1(`list_integrations`)·§4.3.1(`integration-selector`/`mcp-server-selector`) 두 행에 "남의 personal 제외(§8)" 명시 (cross_spec #1, rationale_continuity #3 통합 해소).
2. `plan/in-progress/integration-personal-owner.md` 설계에 신규 `:id`/`integrationId` 핸들러 추가 시 판정 함수 강제 여부를 검증하는 전수 커버리지 안전망(부트 캐너리 또는 인터셉터)을 명시 (rationale_continuity #2).
3. `spec/conventions/error-codes.md §5`에 `FORBIDDEN → ADMIN_REQUIRED` rename 이력 행을 추가하거나, `--impl-done` 시점 등재를 plan 체크리스트에 명시 (convention_compliance #1).
4. `spec/5-system/3-error-handling.md:46` `ADMIN_REQUIRED` 행에 `removeMember`의 `throwAdminRequired()` 발행처를 함께 등재하고 `spec-draft-nullable-notation-followups.md`(G)에 각주로 조율 사실을 남긴다 (plan_coherence #1).
5. 위 4건은 모두 WARNING이며 BLOCK 사유가 아니므로 구현 착수 자체를 막지는 않으나, 1·3번(spec SoT 정합)은 구현 코드가 해당 표면(`workflow-assistant/tools/candidate-lookup`, `error-codes.md`)을 직접 건드리기 전에 처리하는 것이 재작업 비용이 가장 낮다.
