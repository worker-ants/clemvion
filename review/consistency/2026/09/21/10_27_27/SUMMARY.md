# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원(cross_spec/rationale_continuity/convention_compliance/plan_coherence/naming_collision) 전문 확보, Critical 0건.

## 전체 위험도
**LOW** — Critical 없음. WARNING 3건(모두 문서 커버리지/frontmatter 위생 이슈, 코드 계약 위반 아님) + INFO 다수.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | Integration 상태 전이 다이어그램이 `error` 상태의 삭제 종단을 누락 — target(`4-integration.md`)은 status 무관 삭제를 정확히 서술하는데 data-flow 짝문서만 좁게 말해, 지금 `remove()` 를 손대는 개발자가 이를 근거로 없던 status guard 를 잘못 추가할 위험 | `spec/data-flow/5-integration.md` §3.1 mermaid state diagram (L376-379) | `spec/2-navigation/4-integration.md` §6/§9.1/§2.1 (status 무관 삭제 허용을 이미 정확히 서술) | `error --> [*]: 삭제` 전이 한 줄 추가(다른 두 종단과 대칭). 이번 PR(`spec_impact: none`) 강제 대상은 아니나 구현 시 참조 우선순위 주의 |
| 2 | convention_compliance | frontmatter `pending_plans:` 가 이미 완료·반영된 plan 을 "미구현 surface" 로 계속 지목 | `spec/2-navigation/1-workflow-list.md` frontmatter (L11-13, `plan/complete/workflow-duplicate-nodes-edges.md` 항목) | `spec/conventions/spec-impl-evidence.md` §2.1(정의)·§3(라이프사이클) — 해당 plan 이 고치려던 결함은 본문 §2.6 이 이미 완료된 동작으로 서술 | `pending_plans:` 에서 해당 항목 제거, 또는 본문에 남은 책임을 "미구현 (Planned)" 으로 명시해 존재를 정당화(§R-11 절차 그대로 적용, 규약 갱신 불요) |
| 3 | plan_coherence | 이번 PR 이 만들 새 관측 가능 동작(`DELETE /api/integrations/:id` 두 번째 요청 → 404)이 반영될 문서 갱신 자리가 트래커 스코프에서 빠짐 — 워크플로/트리거/스케줄 선례(#1369-#1371)는 착수 시점마다 트래커 항목 스코프를 확장해 왔는데 이번(통합) 차례만 누락 | `spec/2-navigation/4-integration.md` §9.1/§9.4 (DELETE 행에 동시성/404 서술 없음) | `plan/in-progress/spec-draft-nullable-notation-followups.md` L4813 트래커 항목(스코프에 workflow/trigger/schedule 는 있으나 integration 없음) | L4813 항목 스코프에 `spec/2-navigation/4-integration.md §9` 추가, 또는 `integration-dup-delete.md` 체크리스트에 "트래커 문서-갱신 스코프에 4-integration.md 추가" 단계 명시. 저심각도 비차단 등재로 충분 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | "동시 DELETE → 두 번째 404" 계약이 트리거 문서에만 명시, workflow/schedule/integration 은 침묵(반대 주장은 아님) | `spec/2-navigation/2-trigger-list.md` §4.4 vs `1-workflow-list.md`/`3-schedule.md` | cross-cutting 절 신설(`5-system/2-api-convention.md`) 검토, 이번 PR 과 별도 트랙 |
| 2 | rationale_continuity | 계획된 무-lock 원자 `DELETE` 처방은 `4-integration.md` Rationale 이 기각한 advisory lock 의 재도입이 아님(기각 사유=HTTP-in-lock 비용, `remove()` 는 외부 호출 없음) | `plan/in-progress/integration-dup-delete.md` §B vs `spec/2-navigation/4-integration.md` Rationale | 조치 불요, 구현 커밋 메시지에 한 줄 연결 메모 권장 |
| 3 | rationale_continuity | `affected === 0` 명시 판정은 트래커에 이미 등재된 처방과 일치, 이탈 없음 | `plan/in-progress/integration-dup-delete.md` §B vs `spec-draft-nullable-notation-followups.md` L4793-4801 | 조치 불요 |
| 4 | rationale_continuity | `Integration.credentials` 는 인라인 암호화 컬럼이라 트리거식 `secret://` ref 2단계 정리 순서가 적용 대상 아님(잘못된 유추 방지 확인) | `spec/1-data-model.md` §2.10 vs `2-trigger-list.md` §4.3 | 조치 불요 |
| 5 | rationale_continuity | "동시 삭제→두 번째 404" 서술 공백은 이미 별도 저심각도 항목으로 추적 중, 이번 PR 이 새로 만든 갭 아님 | `spec/2-navigation/4-integration.md` §9.1 | 완료 후 트래커 L4813 항목에 `4-integration.md §9.1` 추가 권고(WARNING #3 과 동일 조치) |
| 6 | convention_compliance | bare `hh_mm_ss` 리뷰 인용은 `review-citations.md` 성문화(2026-09-05~06) 이전 커밋(`a17e1a0da`, 2026-08-27) 도입분이라 grandfather 대상, 재-flag 불필요 | `spec/2-navigation/14-execution-history.md:479` | 향후 해당 절 재편집 시 전체 경로 형태로 정리 |
| 7 | naming_collision | 삭제성 감사 액션 접미사가 `_DELETED`(workflow/trigger/schedule/integration) vs `_REMOVED`(`member.removed`) 로 기존에 이미 비일관 — 이번 PR 이 만든 충돌 아님, plan 도 범위 밖으로 명시 | `AUDIT_ACTIONS.*` 전반 | 별도 명명 통일 트랙에서 다룰 사안, 이번 착수 비차단 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | data-flow 상태 다이어그램의 `error` 삭제 종단 누락(WARNING) + 형제 문서 간 동시성 계약 서술 비대칭(INFO) |
| rationale_continuity | NONE | 처방이 기각된 advisory lock 재도입 아님, 트래커 선등재 처방과 일치, credentials 구조 차이로 트리거식 순서 불요 — 모두 이탈 없음 |
| convention_compliance | LOW | `pending_plans` frontmatter 가 완료 plan 을 계속 지목(WARNING) + grandfather 인용 1건(INFO) |
| plan_coherence | LOW | 동시-DELETE-404 문서 갱신 트래커 스코프에 `4-integration.md` 누락(WARNING) |
| naming_collision | NONE | 신규 식별자 없음(요구사항 ID/타입/endpoint/이벤트/ENV/경로 6축 전부), 기존 `_DELETED`/`_REMOVED` 비일관은 참고용 |

## 권장 조치사항
1. (비차단, 권장) `plan/in-progress/spec-draft-nullable-notation-followups.md` L4813 트래커 항목 스코프에 `spec/2-navigation/4-integration.md §9` 를 추가 — WARNING #3 / INFO #5 를 함께 해소.
2. (비차단, 권장) `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans:` 에서 완료된 `plan/complete/workflow-duplicate-nodes-edges.md` 항목을 제거하거나, 남은 책임을 본문에 명시.
3. (비차단, 선택) `spec/data-flow/5-integration.md` §3.1 상태 다이어그램에 `error --> [*]: 삭제` 전이 추가.
4. 위 세 항목 모두 `plan/in-progress/integration-dup-delete.md` 의 `spec_impact: none` 결정을 뒤집지 않으며, 이번 PR 착수를 차단하지 않음.
