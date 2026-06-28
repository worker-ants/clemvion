# Consistency Check 통합 보고서 (--impl-prep, 단위 3)

**BLOCK: NO** — Critical 0. 구현 착수 차단 사유 없음.

## 전체 위험도
MEDIUM (checker 집계) — 단, WARNING 5건 전부 **단위 3(코드 유지보수) 무관 pre-existing**. 단위 3 변경 파일(client-ip.ts / http-exception.filter.spec.ts / executions.service.ts / hooks.service.ts)과 직접 충돌 없음.

## WARNING 처분 (단위 3 관점)
| # | 위배 | 처분 |
|---|------|------|
| W-1 | 1-auth Rationale 2.3.B "세 경로" vs §2.3 "두 계열" 문구 | 본 PR 무관 (1-auth 미수정). #770/별도 spec 정비 대상. |
| W-2·W-4 | webhook-public-ip-failopen-hardening.md "결정 필요" 미결 ↔ §2.3 | **이 worktree 는 origin/main 기반(#770 미반영)** 이라 구판 plan 을 본 것. 단위 2(PR #770)에서 결정 확정·해소 완료. |
| W-3 | 1-auth §1.5.4 에러코드 이중 SoT | 본 PR 무관 pre-existing. |
| W-5·I-9 | 10-graph-rag.md graph_failed/graph_error 이벤트명 | 본 PR 무관(graph RAG). |

## INFO (단위 3 관련)
- **I-4**: M-1 `extractClientIpFromHeaders` null→undefined falsy 동등성 — 소비처 `if (!ip)`(guard)·`?? undefined`(hooks.service) 모두 undefined 호환. 기존 client-ip.spec(no-IP 반환)·guard.spec(IP 미식별 통과) 테스트가 커버하며, client-ip.spec `toBeNull()`(43·57행) → `toBeUndefined()` 로 갱신해 단언 정합.
- I-8: webhook-hardening-cleanup §범위 밖 C → #766(단위 1)에서 이미 처리됨(stale).

## 결론
단위 3(동작 보존 유지보수) Critical 0, BLOCK: NO. 진행.
