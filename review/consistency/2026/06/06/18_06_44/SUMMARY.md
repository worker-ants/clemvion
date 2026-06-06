# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현을 차단할 사유가 없다.

## 전체 위험도
**LOW** — 모든 Critical 위배 없음. WARNING 1건(plan 문서 갱신 누락), INFO 5건(문서 수준 불일치). 구현 자체는 안전하고 spec §3.4 와 정합한다.

## Critical 위배 (BLOCK 사유)

해당 없음.

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | Critical 발견 없음 | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | spec §3.4 follow-up 노트 및 `rag-quality-improvement §7.E` 가 "측정 후 조건부 적용" 으로 열려 있는 상태에서 구현이 먼저 완료됨 — 기술적 충돌이 아닌 문서 갱신 누락 | `rag-search.service.ts` `searchVectorGroup` — `SET LOCAL hnsw.ef_search` 무조건 적용 | `plan/in-progress/rag-quality-improvement.md §7.E`, `spec/5-system/9-rag-search.md §3.4` follow-up 노트 | (1) `rag-quality-improvement.md §7.E` 체크박스를 `[x]` 완료 처리하고 "SET LOCAL LIMIT×2 clamp 방식으로 구현 완료" 기록. (2) spec §3.4 follow-up 노트를 "구현됨; 운영 측정 후 clamp 범위 재검토 가능" 으로 보완. (3) `rag-dynamic-cut.md §비차단 후속` 에 선행 advisory 해소 기록. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | spec frontmatter `pending_plans` 에 driving plan `rag-followup-efsearch.md` 누락 — spec↔plan traceability 단절 | `spec/5-system/9-rag-search.md` frontmatter line 9–11 | frontmatter 에 `- plan/in-progress/rag-followup-efsearch.md` 추가, 또는 완료 후 `complete/` 이동 시 제거 |
| 2 | Cross-Spec | `spec/9-rag-search.md §3.4` 의 "ivfflat 미사용" 선언이 `spec/1-data-model.md §3` 및 `spec/5-system/17-agent-memory.md` 의 `HNSW/IVFFlat` 병기 표현과 불일치 | `spec/1-data-model.md` line 810, `spec/5-system/17-agent-memory.md` line 44 | 실제 마이그레이션 SQL 확인 후 `HNSW` 단독으로 정정하거나, `9-rag-search.md` 의 "document_chunk 한정" 범위를 명시 |
| 3 | Convention Compliance | spec frontmatter `status: partial` 유지 — 현 상태 규약 적합, `rag-dynamic-cut.md` 완료 시 `status: implemented` 승격 검토 필요 | `spec/5-system/9-rag-search.md` frontmatter | `rag-dynamic-cut.md` plan 완료 이동 시 `status: implemented` 승격 (가드 자동 강제). 현재 조치 불요 |
| 4 | Plan Coherence | `rag-dynamic-cut.md` plan 이 `plan/in-progress/` 에 잔존, worktree `rag-dynamic-cut-12fac1` 는 물리 부재 (PR #500 MERGED) | `plan/in-progress/rag-dynamic-cut.md` `worktree` 필드 | worktree 필드를 `(merged, cleanup 대기)` 로 표시. eval-retrieval 추적 완료 시 `plan/complete/` 이동 |
| 5 | Plan Coherence | stale worktree 2건 — `exec-park-polish-080a4d` (main 조상), `rag-dynamic-cut-12fac1` (PR #500 MERGED) | `.claude/worktrees/` | `cleanup-worktree-all.sh --yes --force` 실행 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 데이터 모델·API 계약·요구사항 ID·RBAC 충돌 없음. INFO 2건: spec frontmatter pending_plans 누락, agent_memory 인덱스 HNSW/IVFFlat 표현 불일치 |
| Rationale Continuity | NONE | 기각 대안 재도입 없음. spec §3.4 합의 원칙 전면 준수. 결정 번복 없음 |
| Convention Compliance | NONE | spec-impl-evidence frontmatter 스키마 완비. 상수명 UPPER_SNAKE_CASE 규약 준수. 에러 코드 도메인 prefix 규약 준수 |
| Plan Coherence | LOW | WARNING 1건: spec §3.4 follow-up 노트 미갱신(구현 선완료). INFO 2건: stale worktree, rag-dynamic-cut plan 잔존. 병렬 worktree 파일 충돌 없음 |
| Naming Collision | NONE | 신규 식별자 3개(HNSW_EF_SEARCH_DEFAULT, HNSW_EF_SEARCH_MAX, hnswEfSearchFor) 모두 프로젝트 전체에서 유일. 충돌 없음 |

## 권장 조치사항

1. **[WARNING 해소]** `plan/in-progress/rag-quality-improvement.md §7.E` 의 ANN 파라미터 조정 항목을 `[x]` 완료 처리하고 채택 공식(`SET LOCAL LIMIT×2 clamp, [40,1000], SET LOCAL transaction scope`) 기록.
2. **[WARNING 해소]** `spec/5-system/9-rag-search.md §3.4` follow-up 노트를 "구현됨; 운영 측정 후 clamp 범위 재검토 가능" 으로 갱신. graph seed 미적용 근거(`seedTopK < 40`) 명문화.
3. **[WARNING 해소]** `plan/in-progress/rag-dynamic-cut.md §비차단 후속` 에 ef_search 구현이 해당 advisory 항목을 해소했음을 기록.
4. **[INFO]** `spec/5-system/9-rag-search.md` frontmatter `pending_plans` 에 `- plan/in-progress/rag-followup-efsearch.md` 추가 (plan 완료 후 자동 제거).
5. **[INFO]** stale worktree 2건(`exec-park-polish-080a4d`, `rag-dynamic-cut-12fac1`) 정리.
6. **[INFO, 낮은 우선순위]** `spec/1-data-model.md §3` 및 `spec/5-system/17-agent-memory.md` 의 `HNSW/IVFFlat` 표현을 실제 마이그레이션 SQL 확인 후 `HNSW` 단독으로 정정 또는 `9-rag-search.md` 범위 명시 보완.