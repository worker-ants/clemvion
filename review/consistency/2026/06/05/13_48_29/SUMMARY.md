# Consistency Check 통합 보고서 (impl-done spec/5-system/)

**BLOCK: NO** — Critical 없음. push 게이트 충족.

## 전체 위험도
MEDIUM — WARNING 5, INFO 9. 단 W2~W5 는 base-skew FP.

## Critical
없음.

## 경고 (WARNING)
| # | 위배 | 본 작업 관련 |
|---|------|------|
| W1 | `1-ai-agent.md` ragTopK/ragThreshold "(Planned)" 미갱신(rerank 구현됨) | 본 PR 미수정 파일(노트는 #455). 소규모 currency — followup/머지 후 |
| W2 | `17-agent-memory.md §3` extractionModel scope-freeze 번복 | **base-skew FP** — origin/main 이 내 base(#475) 이후 #476+ agent-memory 진전. 내 변경 아님 |
| W3 | `17-agent-memory.md §6` admin surface 제거 | **base-skew FP** (동일) |
| W4 | `4-execution-engine.md §1.3` schemaVersion 검증 제거 | **base-skew FP** (동일) |
| W5 | `4-execution-engine.md §6.2` durable commit 제거 | **base-skew FP** (동일) |

## 참고 (INFO) — 발췌
- I1: `0-overview §6.1` Rerank 미등재(currency, 선택).
- I2: `1-auth §4.1` rerank_config reveal 미등재(의도 — RerankConfig reveal 미노출).
- I6: `9-rag-search §2.2` `search_failed` lower_snake(기존 에러코드·범위 외).
- I7: `9-rag-search` status partial 유지 정당(followup 에 provider 확장·멀티-KB 잔여).
- I9: `rag-rerank-followup.md` frontmatter worktree stale → 후임 plan(-v2) 로 이관(주석).

## 결론
spec 연결 코드↔spec 정합 **BLOCK: NO**. rerank 신규 spec 내부 정합. W2~W5 는 origin/main 진전(#476+)에 의한 base-skew — 본 PR 무관, 머지 시 rebase 로 해소. naming-collision/plan-coherence NONE.
