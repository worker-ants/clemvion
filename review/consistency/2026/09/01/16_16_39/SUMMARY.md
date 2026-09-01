# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — target(`spec-draft-audit-resource-type-count.md`)의 정정 자체는 기존 spec·Rationale·명명 컨벤션과 모두 정합하나, target 이 서술하는 "동반 정정 3곳"이 실측 결과 이미 워킹트리에 반영돼 있어 실행 전제가 stale하고, `spec-sync-auth-gaps.md` 체크박스가 아직 미적용인 spec 본체 반영까지 완료로 표시하고 있다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec / convention_compliance / plan_coherence (3중 중복) | "동반 정정" 3곳(`business-metrics.service.ts` JSDoc·`spec-sync-auth-gaps.md`·`plan/complete/spec-draft-audit-write-failed-metric.md`)이 실측 결과 **이미 전부 적용**돼 있어 target 의 "함께 고친다"는 실행 전제가 stale함 | `plan/in-progress/spec-draft-audit-resource-type-count.md` §"동반 정정 (spec 밖 — 같은 오기산이 전파된 3곳)" | `business-metrics.service.ts:174`(이미 "distinct 10종"), `spec-sync-auth-gaps.md:129`(이미 `[x]` 체크·"17개 producer" 문구 grep 0건), `plan/complete/spec-draft-audit-write-failed-metric.md:135~161`(정정 노트 이미 원문 보존 형태로 존재) | §동반 정정을 재실측해 이미 완료된 항목은 "완료 확인됨(참조용)"으로 표시하고 재정정 지시를 제거. 실질적으로 남은 작업은 `spec/5-system/_product-overview.md` §NF-OB-07 표의 `실측 12종` → `실측 10종` 갱신 하나뿐임을 명시 |
| 2 | plan_coherence | `spec-sync-auth-gaps.md` L129 체크박스가 "spec·JSDoc·plan 2곳 전파분 동반 정정"을 `[x]` 완료로 표시하지만, 실제로 `spec/5-system/_product-overview.md` L91 은 여전히 "실측 12종"으로 미반영(target 자체가 그 write 를 게이팅하는 `--spec` 입력) | `plan/in-progress/spec-sync-auth-gaps.md:129` | `spec/5-system/_product-overview.md:91`("실측 12종" 미반영 상태) | 이번 planner 턴에서 `spec/5-system/_product-overview.md` 실제 반영까지 마쳐 체크박스 문구를 사실로 만들거나(권장), 안 되면 체크박스 문구를 "spec(반영 대기 — 게이트 통과 후)"처럼 조건부로 좁힐 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | target 이 검증한 "producer 12개" 수치가 `spec/data-flow/1-audit.md:55` 의 "8개 위치" 문장(2026-08-01 CRUD 확장 이전 stale 문구, §1.1 표는 이미 12개 writer)을 반증 | `spec/data-flow/1-audit.md:55` | target 스코프 밖. 별도 소정정으로 "8개 위치"→"12개 위치"(5→9 service 모듈 + 3 controller) 동반 정정 권장 |
| 2 | cross_spec | target 의 핵심 수치(10종)는 `spec/data-flow/1-audit.md` §1.1 Writer 표(독립 큐레이션)와 본 검토의 직접 소스 재실측(27개 `record()` 호출 지점) 양쪽에서 동일하게 확인됨 — 기존 spec 과 완전 정합 | `spec/data-flow/1-audit.md` §1.1 | 없음(참고용) |
| 3 | rationale_continuity | 클램핑 유지/닫힌 유니온 미채택 결론이 `spec/data-flow/9-observability.md` Rationale("소스 시그니처가 `string` 인 라벨은 클램핑")과 정확히 재확인됨 — 기각된 대안 재도입 아님 | `## 변경 제안` 마지막 문단 | `_product-overview.md` 표 정정 시 해당 Rationale 을 각주로 교차 참조하면 다음 사람의 재추론 부담 감소(선택) |
| 4 | rationale_continuity | "문서가 구현보다 넓어지면 안 된다" 원칙과 정합 — 12→10 정정은 표를 실제 배선에 맞춰 좁히는 방향 | `## Overview`, `## 실측` | 없음 |
| 5 | rationale_continuity | `alert_rule`/`workspace_invitation` 을 감사 리소스에서 배제한 판단이 `spec/1-data-model.md` §2.25(2026-08-31 신규 등재)와 독립적으로 합치 | `## 실측` | 없음 |
| 6 | convention_compliance | `worktree:` frontmatter 가 전체 경로(`.claude/worktrees/audit-record-factory`)를 사용, `plan-lifecycle.md §4` 예시는 basename만 — `_normalize_worktree_value` 가 정규화하므로 기능 결함 아님. 같은 날짜 자매 문서도 동일 패턴 | frontmatter 3행 | 실제 관행과 문서 예시를 한쪽으로 수렴(basename 통일 또는 문서에 전체 경로 허용 명시). 낮은 우선순위 |
| 7 | naming_collision | 신규 요구사항 ID·엔티티·API endpoint·이벤트명·환경변수 도입 없음. `NF-OB-07`/`clemvion.audit.write_failed` 는 재참조일 뿐 신규 ID 아님. 신규 plan 파일명은 `spec-draft-<주제>.md` 컨벤션과 정합 | 전체 | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 10종 정정은 기존 spec(data-flow/1-audit.md)과 완전 정합. 다만 "동반 정정 3곳"이 이미 적용됨(전제 stale) + 인접 문서(`1-audit.md:55`)의 별도 오기산 발견 |
| rationale_continuity | NONE | 클램핑/닫힌 유니온 미채택 Rationale 과 정확히 정합, 기각된 대안 재도입 없음 |
| convention_compliance | LOW | conventions 직접 위반 없음. §동반 정정 stale 서술(INFO) + worktree frontmatter 형식 편차(INFO) |
| plan_coherence | LOW | 다른 in-progress plan 과 충돌 없음. `spec-sync-auth-gaps.md` 체크박스가 아직 미적용된 spec 반영을 완료로 표시(WARNING) |
| naming_collision | NONE | 신규 식별자 도입 없음, 구조적 충돌 표면 자체가 없음 |

## 권장 조치사항
1. (BLOCK 해소 우선 항목 없음 — BLOCK:NO) `spec/5-system/_product-overview.md` §NF-OB-07 표의 `실측 12종` → `실측 10종` 반영을 이번 planner 턴에서 완료해, target 의 "동반 정정 3곳 완료" 서술과 `spec-sync-auth-gaps.md:129` 체크박스가 가리키는 상태를 실제와 일치시킨다(3/4 항목은 이미 완료되어 마무리 비용이 작음).
2. `plan/in-progress/spec-draft-audit-resource-type-count.md` §동반 정정 섹션을 재실측해 이미 완료된 항목을 "완료 확인됨(참조용)"으로 전환하거나 섹션을 축소한다.
3. (선택, 별도 소정정) `spec/data-flow/1-audit.md:55` 의 "8개 위치" 문장을 §1.1 Writer 표 실측치(12개)에 맞춰 정정한다.
4. (선택, 낮은 우선순위) `worktree:` frontmatter 값의 형식(전체 경로 vs basename)을 문서 예시와 실제 관행 중 한쪽으로 수렴한다.
