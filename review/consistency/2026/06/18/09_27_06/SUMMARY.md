# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

> 재검토(09_15_57 BLOCK:YES 의 Critical/Warning 해소 후 re-run). 직전 BLOCK 사유였던 `started:` 누락은 해소됨.

## 전체 위험도
**LOW** — 5개 checker 모두 Critical 없음. WARNING 2건(Gate C spec_impact 누락 리스크, applyRetryLastTurn 이중 표기 혼동 가능성)이 있으나 실행 차단 사유 아님.

## Critical 위배 (BLOCK 사유)

_없음_

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `spec_impact` 필드 미선언 — `complete/` 이동 시 Gate C build guard 강제 (`started: 2026-06-18` ≥ cutoff `2026-06-04`) | frontmatter (라인 1–8) | `.claude/docs/plan-lifecycle.md §5 Gate C` + `spec/conventions/spec-impl-evidence.md §4.2` | 완료 이동 commit 시 `spec_impact:` 필드에 변경 대상 spec 파일 목록 추가 |
| 2 | naming_collision | `applyRetryLastTurn` 이 `RetryTurnService` 이전 목록과 엔진 잔류 delegator 목록 두 곳에 동시 등장 — 의도된 이중 역할이나 독자 혼동 가능성 | `spec/5-system/4-execution-engine.md` Rationale C-1 항 | 동 파일 내 두 절 | 열거에 "실체=RetryTurnService, 엔진=thin forwarding delegator" 인라인 주석 추가 권장 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | target 제안 spec 변경 항목 전체가 현행 spec 에 이미 반영됨 | `plan/in-progress/spec-update-engine-split.md` 전체 | `plan/complete/` 이동 및 c1-engine-split.md PR4 DoD 완료 처리만 남음 |
| 2 | rationale_continuity | `spec/data-flow/3-execution.md` 다이어그램 actor 갱신은 선택(차단 아님) | 동 파일 actor 명칭 | 조치 불요 |
| 3 | convention_compliance | frontmatter 에 `created:` 비표준 중복 필드 존재 (`started:` 와 동일 날짜) | frontmatter | `created:` 제거 권고 |
| 4 | convention_compliance | `parent:` 필드가 plan-lifecycle 비표준 자유 확장 | frontmatter | 본문 링크로 대체 가능 |
| 5 | convention_compliance | `interaction-type-registry.md` frontmatter `code:` 에 이미 등재됨 — 중복 추가 금지 | 동 파일 frontmatter | 중복 추가 불요 (적용 완료) |
| 6 | plan_coherence | target 실행 절차에 "4 PR 머지 완료 확인" 체크 스텝 미명시 | `## 실행 절차 (planner)` §1 | 실행 절차 상단에 머지 확인 체크 추가 권장 |
| 7 | plan_coherence | `node-output-redesign` 재개 시 `previousOutput` 완전 제거 검토 필요 — 현재 충돌 없음 | `node-output.md` §4.2 예외 | c1-engine-split.md `## 후속 고려` 메모 추가 권장 |
| 8 | naming_collision | 신규 식별자 8개 전체가 이미 spec 선반영 — 충돌 없음 | 각 spec 파일 | 중복 추가 방지 (적용 완료) |
| 9 | naming_collision | `1-ai-agent.md` frontmatter `code:` 에 이미 존재 — 중복 추가 금지 | `1-ai-agent.md` L12 | 이중 추가 금지 (적용 완료) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | target 제안 변경 항목 전체가 현행 spec 에 이미 반영. 데이터 모델·API·상태 전이·계층 충돌 없음 |
| rationale_continuity | NONE | 기각된 대안 재도입·합의 invariant 위반·결정 번복 없음. C-1 옵션 A 선택과 완전 일치 |
| convention_compliance | LOW | 필수 frontmatter 3개 필드 충족. Gate C `spec_impact` 미선언(WARNING — 이동 commit 시 해소), `created:` 중복·`parent:` 비표준(INFO) |
| plan_coherence | NONE | 미해결 결정 우회·선행 plan 미해소·후속 항목 누락 없음 |
| naming_collision | LOW | 신규 식별자 전체 선반영으로 실질 충돌 없음. `applyRetryLastTurn` 이중 표기 혼동 가능성(WARNING) |

## 권장 조치사항 + 처분 (planner, 2026-06-18)

1. **BLOCK 해소 없음** — Critical 없으므로 spec 확정 진행.
2. (WARNING-1 spec_impact) → **해소**: `plan/complete/` 이동 commit 에서 frontmatter 에 `spec_impact:` 8개 spec 파일 목록 추가 (Gate C `spec-plan-completion.test.ts` 통과).
3. (WARNING-2 applyRetryLastTurn 이중표기) → **해소**: execution-engine.md Rationale C-1 항 RetryTurnService 열거에 "실체=RetryTurnService / 엔진 thin forwarding delegator" 구분 인라인 명시.
4. (INFO-3 created 중복) → **해소**: frontmatter `created:` 제거(`started:` 유지).
5. (INFO-6 머지 확인 스텝) → **해소**: 실행 절차에 "0. PR #622·#625·#626·#627 머지 완료 확인" 추가.
6. (INFO-7 previousOutput 후속) → **해소**: c1-engine-split.md `## 후속 고려` 에 node-output-redesign Phase 3 메모 추가.
7. (INFO-5/8/9 이미 반영) → no-op: apply-first-then-check 아티팩트, 중복 편집 없음 확인.
