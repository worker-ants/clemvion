# Consistency Check (--impl-done) 통합 — 메모리 백로그 그루밍

**BLOCK: NO** — Critical 0. 5 checker(cross-spec/rationale/convention/plan-coherence/naming) 전원 BLOCK:NO.

## 조치한 발견
| # | checker | 발견 | 조치 |
|---|---|---|---|
| 1 | cross-spec(W1) | `embeddingModel` widget 'text'→'expression' 이 spec §1 타입·§3 차원 일관성 불변식과 긴장 | **'text' 로 롤백** — embeddingModel 은 scope 전 메모리와 차원 일치 불변식이라 per-exec expression 평가가 footgun(recall 무음실패). summary/extraction(stateless)과 의도적 차이, 코드 주석 명시. spec 무변경(원래 String/text 와 정합 복원). |
| 2 | convention(Gate C) | grooming plan 전 항목 [x] → complete 이동 + spec_impact | `plan/complete/` 이동 + `spec_impact: [17-agent-memory.md]` (lifecycle "마지막 작업 PR 안에서 이동") |

## False positive (반증)
- convention(W1) "pending_plans 의 두 plan 삭제 → 빌드차단": diff 는 grooming plan **추가만**, `agent-memory-admin-ui.md`/`agent-memory-summary-model.md` 는 HEAD 실존·pending_plans 전부 resolve. checker 가 merge-base diff 의 main 전진분 오독.

## 확인(정상)
- rationale: embeddingModel widget·listScopes 단일쿼리 모두 spec Rationale 의 기각결정 번복 아님(NONE).
- naming: 신규 식별자(grooming plan명·CTE `grouped`·raw `total`) 충돌 없음(NONE).
- cross-spec: listScopes total=0(over-page) 동작 §6 명시 완료. 데이터모델·ID·상태전이 충돌 없음.

## 후속(project-planner 영역, 본 PR 범위 밖 — 별도 grooming 권고)
- `ai-context-memory-followup-v2.md` 체크박스: A1(#471)·A3(#473)·B3(#474) 완료분 `[x]` 갱신 + PR 주석.
- `ai-context-memory-auto.md §3.1` "scope-freeze" 결정이 A3 로 번복됨 → 번복 주석.
- 잔존 stale worktree `agent-memory-embedding-model`(#467 era, branch=main 조상) 디스크 정리.

## checker별 BLOCK: cross-spec NO · rationale NO · convention NO · plan-coherence NO · naming NO
