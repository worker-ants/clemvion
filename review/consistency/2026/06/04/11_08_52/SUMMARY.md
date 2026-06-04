# Consistency Check 통합 보고서 (impl-done spec/5-system/)

**BLOCK: NO** — Critical 발견 없음. push 게이트 충족.

## 전체 위험도
**MEDIUM** — WARNING 3(비차단), INFO 10. 즉각 동작 불가 모순 없음.

## Critical
해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | 처리 |
|---|---------|------|------|
| W1 | Plan Coherence | `1-ai-agent.md §1 ragThreshold` 의미 보강 — 본 구현 미수정 파일(#455 에서 이미 반영). ai-context-memory 와 직렬화 | 본 PR 무관(out-of-scope). 머지 순서 조율 |
| W2 | Plan Coherence | `ai-context-memory-9c7e6e`(OPEN) 가 `1-data-model.md` 동시편집 → ER 라인 충돌 가능 | 나중 머지 PR rebase (기지 사항) |
| W3 | Convention | `5-system/_product-overview.md` spec 맵 링크 삭제 | 본 구현 미수정 파일 — diff 잡음/타 브랜치. 확인 권장 |

## 참고 (INFO) — followup 추적
- I1·I2: `1-auth.md §3.2/§4.1` RerankConfig RBAC 행·감사로그 미등록 → followup.
- I3: `1-data-model §2.16.1` 제목 "(Planned)" 잔존 — 앵커(`#2161-rerankconfig-planned`) 보존 위해 유지(tei+cohere 만 구현·나머지 Planned 라 부분 정확).
- I4: `5-knowledge-base.md` 리랭킹 행 표기 동기화 → followup.
- I9: `rag-rerank-followup.md` 정책판단 KB 메모 추가.
- I10: `6-config.md` `/api/rerank-configs` endpoint 절 미등록 → followup.
- I6: `15-chat-channel.md` `../4-execution-engine.md` 링크(본 구현 무관·기존).
- I7: `1-auth §1.5.4` 에러코드 표기(기존·범위 외).

## Checker별 위험도
| Checker | 위험도 |
|---------|--------|
| Cross-Spec | LOW (RBAC/감사/(Planned) INFO) |
| Rationale Continuity | NONE (Rationale 신설 정합) |
| Convention Compliance | LOW |
| Plan Coherence | MEDIUM (out-of-scope 경합) |
| Naming Collision | NONE |

## 결론
spec 연결 코드 변경의 code↔spec 정합 BLOCK:NO. WARNING 은 전부 본 구현 미수정 파일/병렬 PR 경합(out-of-scope). INFO(RBAC·감사·endpoint 문서·표기 동기화)는 RerankConfig 리소스 spec 완결성 항목으로 `rag-rerank-followup.md` 추적.
