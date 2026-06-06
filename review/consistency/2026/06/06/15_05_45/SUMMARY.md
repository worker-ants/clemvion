# Consistency Check 통합 보고서 (--spec, pre-park window spec draft)

**BLOCK: NO** — Critical 발견 없음. 채택 차단 사유 없음.

## 전체 위험도
**LOW** — 5개 checker 전원 INFO 수준만. Critical/Warning 0건. 대상 draft(`spec-update-execution-engine-pre-park-window.md`)는 기존 spec·규약·식별자·Rationale 와 충돌하지 않으며 안전 반영 가능.

## Critical / Warning
_없음_

## 참고 (INFO) — 반영 시 적용
| # | Checker | 항목 | 조치 |
|---|---------|------|------|
| 1 | Cross-Spec | EIA getStatus/SSE 미구현 필드와 "모든 소비자" 선언 암묵 전제 | (선택) EIA spec 교차참조 — 본 PR 범위 외, 생략 |
| 2·3 | Cross-Spec | exec-park §1.1 삽입 순서/근접성 | main HEAD(0f40b7d1) 기준 §1.1 blockquote 끝(line 66) 재확인 완료 |
| 4 | Rationale | "의도적 중복 방어"는 Rationale 빈 영역 신규 기술 (기각대안 재도입 아님) | 그대로 진행 |
| 5 | Rationale | cross-entity 원자성은 intra-row 창 미차단 배경 | blockquote 에 포함 |
| 6 | Convention | frontmatter `spec_impact` 완료 시 강제 | draft 에 spec_impact 기재 |
| 7 | Convention | 체크박스 부재 | draft 에 작업 항목 추가 |
| 8 | Convention | Rationale `###`→`##` 승격 | spec 에 `## Rationale` 항목으로 반영 |
| 10 | Naming | 참조 경로 모호 | 완전 경로(`codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts`) 사용 |

## Checker별 위험도
| Checker | 위험도 |
|---------|--------|
| Cross-Spec | LOW (INFO만) |
| Rationale Continuity | NONE |
| Convention Compliance | LOW (INFO만) |
| Plan Coherence | NONE |
| Naming Collision | NONE |

## 결정
BLOCK: NO → spec §1.1 에 pre-park read-window 정규화 blockquote + `## Rationale` 항목 반영. 별도 PR 로 진행 (#498 머지 후 후속).
</content>
