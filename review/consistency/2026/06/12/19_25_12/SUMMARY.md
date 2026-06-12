# Consistency Check 통합 보고서 (impl-prep, spec/5-system/)

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능 (WARNING 이행 확인 권장).

## 전체 위험도
**MEDIUM** — CCH-CV-03 (b) 미구현이 R9 결정 미실현 상태 (본 구현이 해소 대상). 나머지 LOW/NONE.

## Critical 위배 (BLOCK 사유)
해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | 제안 | 본 작업 처리 |
|---|---------|------|------|------|
| 1 | Rationale Continuity | CCH-CV-03 (b) 미구현이 R9("running/pending 시 큐잉 금지, 즉시 안내+무시") 미실현 — `isActiveExecution` 이 비-terminal collapse | `isActiveExecution` 이 waiting_for_input/running/pending 구분하도록 수정 | **이행**: 본 구현(#1)이 정확히 이것 |
| 2 | Cross-Spec | `embedding-pipeline.md §8.2` 이벤트 6개 vs `graph-rag.md §6` 5개 불일치 | embedding-pipeline §8.2 동기화 | **범위 밖** — 미접촉 (graph RAG, 무관) |
| 3 | Plan Coherence | `auth-config-webhook-followups.md §3` auth-configs 엔드포인트 §5 표 경합 | §5 표에 추가 안 함 | **범위 밖** — 미접촉 |
| 4 | Plan Coherence | `security-backlog-invitation-token-hash.md` invitation 저장 방식 검토 중 | invitation 저장 방식 변경 금지 | **범위 밖** — 미접촉 |

## 참고 (INFO) — 본 작업 관련만
- **INFO#4**: CCH-NF-03 rate-limit 큐와 R9 lifecycle 큐는 맥락 다름(모순 아님). #3 구현 시 순서(rate-limit 큐 → lifecycle 상태 검사 → 분기) 명확히. (본 PR-2 는 #1/#4 만 — #3 은 후속)
- 나머지 INFO(RBAC 매트릭스, auth/integration cross-link, mcp-client plan 등): 무관/범위 밖.

## Checker별 위험도
| Checker | 위험도 | 핵심 |
|---------|--------|------|
| Cross-Spec | LOW | embedding-pipeline 이벤트 수 불일치(범위 밖) |
| Rationale Continuity | MEDIUM | CCH-CV-03(b) R9 미실현 — 본 구현이 해소 |
| Convention Compliance | NONE | INFO 등급만 |
| Plan Coherence | LOW | 활성 plan 경합 2건 — 모두 범위 회피로 해소 |
| Naming Collision | NONE | 신규 식별자 충돌 없음 |

## 결론
**BLOCK: NO** — #1(CCH-CV-03 b)·#4(§5.4 rotate 응답) 구현 착수. R9 이행이 핵심. 범위 밖 항목(embedding-pipeline·auth-configs·invitation) 미접촉.
